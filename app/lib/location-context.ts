import { readLocationContextCache, writeLocationContextCache } from "./db";

export const LOCATION_LOOKUP_OPTIONS = [
  "community",
  "grocery",
  "park",
  "library",
  "pharmacy",
  "school",
  "restaurant",
  "transit",
] as const;

export type LocationLookupOption = typeof LOCATION_LOOKUP_OPTIONS[number];

export const DEFAULT_LOCATION_LOOKUP_OPTIONS: readonly LocationLookupOption[] = ["grocery", "transit"];
export const MAX_LOCATION_LOOKUP_OPTIONS = 3;

export type LocationContextPlace = {
  name: string;
  category: string;
};

export type LocationContextTransit = {
  name: string;
  mode: string;
  walkMinutes?: number;
};

export type LocationContextDestination = {
  name: string;
  category: string;
  mode: "drive" | "walk";
  minutes?: number;
};

export type LocationContext = {
  source: "google" | "none";
  approximateArea: string;
  lookupOptions: LocationLookupOption[];
  nearby: LocationContextPlace[];
  transit: LocationContextTransit[];
  destinations: LocationContextDestination[];
  notes: string[];
  cached: boolean;
};

type LocationContextRequest = {
  areaEn: string;
  areaZh: string;
  boroughEn?: string;
  boroughZh?: string;
  locale?: "zh" | "en";
  lookupOptions?: unknown;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type PlaceResult = {
  id: string;
  name: string;
  coordinates: Coordinates | null;
};

type NearbyDefinition = {
  query: string;
  categoryZh: string;
  categoryEn: string;
  includedType: string;
};

type CommunityDefinition = {
  query: string;
  categoryZh: string;
  categoryEn: string;
};

const CONTEXT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const contextCache = new Map<string, { expiresAt: number; value: LocationContext }>();

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeLocationLookupOptions(value: unknown, fallback = DEFAULT_LOCATION_LOOKUP_OPTIONS): LocationLookupOption[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is LocationLookupOption => typeof item === "string" && LOCATION_LOOKUP_OPTIONS.includes(item as LocationLookupOption)))).slice(0, MAX_LOCATION_LOOKUP_OPTIONS);
}

function emptyContext(area: string, note: string, lookupOptions: LocationLookupOption[]): LocationContext {
  return { source: "none", approximateArea: area, lookupOptions, nearby: [], transit: [], destinations: [], notes: [note], cached: false };
}

function displayName(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const text = (value as { text?: unknown }).text;
  return clean(text, 120);
}

function coordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { latitude?: unknown; longitude?: unknown };
  const latitude = typeof record.latitude === "number" ? record.latitude : Number(record.latitude);
  const longitude = typeof record.longitude === "number" ? record.longitude : Number(record.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function placeFromValue(value: unknown): PlaceResult | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { id?: unknown; displayName?: unknown; location?: unknown };
  const name = displayName(record.displayName);
  if (!name) return null;
  return {
    id: clean(record.id, 180),
    name,
    coordinates: coordinates(record.location),
  };
}

function locationContextFromCache(value: unknown, fallbackOptions: LocationLookupOption[]): LocationContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.source !== "google" || typeof record.approximateArea !== "string") return null;
  const nearby = Array.isArray(record.nearby)
    ? record.nearby.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const place = item as Record<string, unknown>;
      return typeof place.name === "string" && typeof place.category === "string" ? [{ name: place.name, category: place.category }] : [];
    }).slice(0, 6)
    : [];
  const transit = Array.isArray(record.transit)
    ? record.transit.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const station = item as Record<string, unknown>;
      if (typeof station.name !== "string" || typeof station.mode !== "string") return [];
      const walkMinutes = Number(station.walkMinutes);
      return [{ name: station.name, mode: station.mode, ...(Number.isFinite(walkMinutes) && walkMinutes > 0 ? { walkMinutes: Math.round(walkMinutes) } : {}) }];
    }).slice(0, 3)
    : [];
  const destinations = Array.isArray(record.destinations)
    ? record.destinations.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const destination = item as Record<string, unknown>;
      if (typeof destination.name !== "string" || typeof destination.category !== "string" || (destination.mode !== "drive" && destination.mode !== "walk")) return [];
      const minutes = Number(destination.minutes);
      const mode: LocationContextDestination["mode"] = destination.mode === "drive" ? "drive" : "walk";
      return [{ name: destination.name, category: destination.category, mode, ...(Number.isFinite(minutes) && minutes > 0 ? { minutes: Math.round(minutes) } : {}) }];
    }).slice(0, 3)
    : [];
  if (!nearby.length && !transit.length && !destinations.length) return null;
  return {
    source: "google",
    approximateArea: clean(record.approximateArea),
    lookupOptions: normalizeLocationLookupOptions(record.lookupOptions, fallbackOptions),
    nearby,
    transit,
    destinations,
    notes: Array.isArray(record.notes) ? record.notes.filter((note): note is string => typeof note === "string").slice(0, 3) : [],
    cached: true,
  };
}

async function searchPlaces(apiKey: string, body: Record<string, unknown>, languageCode: string) {
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location",
      },
      body: JSON.stringify({ ...body, languageCode, regionCode: "US" }),
      cache: "no-store",
    });
    if (!response.ok) return [] as PlaceResult[];
    const data = await response.json() as { places?: unknown };
    return Array.isArray(data.places)
      ? data.places.map(placeFromValue).filter((place): place is PlaceResult => Boolean(place))
      : [];
  } catch {
    return [] as PlaceResult[];
  }
}

async function routeMinutes(apiKey: string, origin: Coordinates, destination: Coordinates, travelMode: "DRIVE" | "WALK", languageCode: string) {
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode,
        languageCode,
        units: "IMPERIAL",
      }),
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const data = await response.json() as { routes?: Array<{ duration?: unknown }> };
    const duration = data.routes?.[0]?.duration;
    const seconds = typeof duration === "string" ? Number(duration.replace(/s$/, "")) : Number(duration);
    return Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : undefined;
  } catch {
    return undefined;
  }
}

function communityDefinition(areaEn: string, areaZh: string, boroughEn: string, boroughZh: string): CommunityDefinition | null {
  const values = [boroughEn, boroughZh, areaEn, areaZh].join(" ").toLocaleLowerCase();
  if (values.includes("brooklyn") || values.includes("布鲁克林")) {
    return {
      query: "8th Avenue Brooklyn NY Chinese shopping district",
      categoryZh: "布鲁克林八大道华人商圈",
      categoryEn: "Brooklyn 8th Avenue Chinese commercial area",
    };
  }
  if (values.includes("queens") || values.includes("皇后") || values.includes("flushing") || values.includes("法拉盛")) {
    return {
      query: "Downtown Flushing Main Street Queens NY Chinese shopping district",
      categoryZh: "法拉盛市中心华人商圈",
      categoryEn: "Downtown Flushing Chinese commercial area",
    };
  }
  return null;
}

function uniquePlaces(places: PlaceResult[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = place.name.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function buildLocationContext(request: LocationContextRequest): Promise<LocationContext> {
  const areaEn = clean(request.areaEn);
  const areaZh = clean(request.areaZh);
  const boroughEn = clean(request.boroughEn);
  const boroughZh = clean(request.boroughZh);
  const area = areaZh || areaEn;
  const lookupOptions = normalizeLocationLookupOptions(request.lookupOptions);
  const locale = request.locale === "en" ? "en" : "zh";
  const noLookupNote = locale === "zh"
    ? "未选择附近查找类别；AI只会润色你填写的房源事实。"
    : "No nearby lookup categories selected; AI will polish only the listing facts you provided.";
  if (!lookupOptions.length) return emptyContext(area, noLookupNote, lookupOptions);
  const queryArea = [areaEn || areaZh, boroughEn || boroughZh, "New York"].filter(Boolean).join(", ");
  if (!area || !queryArea) return emptyContext(area, locale === "zh" ? "请先填写公开区域，再生成附近参考。" : "Add a public area before generating neighborhood context.", lookupOptions);

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return emptyContext(area, locale === "zh"
      ? "未配置服务器端地图服务；AI不会编造附近设施或交通时间。"
      : "Server-side map context is not configured; AI will not invent nearby places or travel times.", lookupOptions);
  }

  const cacheKey = JSON.stringify({ version: 3, areaEn, areaZh, boroughEn, boroughZh, locale, lookupOptions });
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };
  try {
    const stored = locationContextFromCache(await readLocationContextCache(cacheKey), lookupOptions);
    if (stored) {
      contextCache.set(cacheKey, { expiresAt: Date.now() + CONTEXT_CACHE_TTL, value: stored });
      return stored;
    }
  } catch {
    // Neon caching is an optimization; a cache outage should not block polishing.
  }

  const languageCode = locale === "zh" ? "zh-CN" : "en";
  const centerResults = await searchPlaces(apiKey, { textQuery: queryArea, pageSize: 1 }, languageCode);
  const center = centerResults[0]?.coordinates || null;
  const locationBias = center ? { circle: { center, radius: 5_000 } } : undefined;
  const nearbyDefinitions: Record<Exclude<LocationLookupOption, "transit" | "community">, NearbyDefinition> = {
    grocery: { query: `Chinese supermarket near ${queryArea}`, categoryZh: "中文超市 / 亚洲超市", categoryEn: "Chinese / Asian supermarket", includedType: "supermarket" },
    park: { query: `park near ${queryArea}`, categoryZh: "公园休闲", categoryEn: "Parks and recreation", includedType: "park" },
    library: { query: `library near ${queryArea}`, categoryZh: "图书馆", categoryEn: "Libraries", includedType: "library" },
    pharmacy: { query: `pharmacy near ${queryArea}`, categoryZh: "药房", categoryEn: "Pharmacies", includedType: "pharmacy" },
    school: { query: `school near ${queryArea}`, categoryZh: "学校", categoryEn: "Schools", includedType: "school" },
    restaurant: { query: `restaurant near ${queryArea}`, categoryZh: "餐饮", categoryEn: "Restaurants", includedType: "restaurant" },
  };
  const nearbyOptions = lookupOptions.filter((option): option is Exclude<LocationLookupOption, "transit" | "community"> => option !== "transit" && option !== "community");
  const nearbyResults = await Promise.all(nearbyOptions.map(async (option) => {
    const definition = nearbyDefinitions[option];
    let places = await searchPlaces(apiKey, { textQuery: definition.query, pageSize: 1, includedType: definition.includedType, ...(locationBias ? { locationBias } : {}) }, languageCode);
    if (!places.length && option === "grocery") {
      places = await searchPlaces(apiKey, { textQuery: `Asian supermarket near ${queryArea}`, pageSize: 1, includedType: definition.includedType, ...(locationBias ? { locationBias } : {}) }, languageCode);
    }
    return { option, place: places[0] || null };
  }));
  const nearby = nearbyResults.flatMap(({ option, place }) => {
    if (!place) return [];
    const definition = nearbyDefinitions[option];
    return [{ name: place.name, category: locale === "zh" ? definition.categoryZh : definition.categoryEn }];
  });

  const community = lookupOptions.includes("community") ? communityDefinition(areaEn, areaZh, boroughEn, boroughZh) : null;
  const communityPlace = community
    ? (await searchPlaces(apiKey, { textQuery: community.query, pageSize: 1 }, languageCode))[0] || null
    : null;

  const routeJobs: Array<{ place: PlaceResult; name: string; category: string; mode: "drive" | "walk"; travelMode: "DRIVE" | "WALK" }> = [];
  if (community && communityPlace?.coordinates && center) {
    routeJobs.push({ place: communityPlace, name: communityPlace.name, category: locale === "zh" ? community.categoryZh : community.categoryEn, mode: "drive", travelMode: "DRIVE" });
  }
  const groceryPlace = nearbyResults.find((result) => result.option === "grocery")?.place;
  if (groceryPlace?.coordinates && center) {
    routeJobs.push({ place: groceryPlace, name: groceryPlace.name, category: locale === "zh" ? "中文超市 / 亚洲超市" : "Chinese / Asian supermarket", mode: "walk", travelMode: "WALK" });
  }
  const destinationResults: Array<LocationContextDestination | null> = await Promise.all(routeJobs.map(async (job) => {
    const minutes = center && job.place.coordinates ? await routeMinutes(apiKey, center, job.place.coordinates, job.travelMode, languageCode) : undefined;
    return minutes ? { name: job.name, category: job.category, mode: job.mode, minutes } : null;
  }));
  const destinations = destinationResults.filter((destination): destination is LocationContextDestination => destination !== null);

  const transitPlaces = lookupOptions.includes("transit")
    ? await searchPlaces(apiKey, { textQuery: `public transit station near ${queryArea}`, pageSize: 1, includedType: "transit_station", ...(locationBias ? { locationBias } : {}) }, languageCode)
    : [];
  const transit = await Promise.all(uniquePlaces(transitPlaces).slice(0, 1).map(async (place) => {
    const walk = center && place.coordinates ? await routeMinutes(apiKey, center, place.coordinates, "WALK", languageCode) : undefined;
    return { name: place.name, mode: locale === "zh" ? "公共交通" : "Public transit", ...(walk ? { walkMinutes: walk } : {}) };
  }));
  const hasFacts = nearby.length > 0 || transit.length > 0 || destinations.length > 0;
  const result: LocationContext = {
    source: hasFacts ? "google" : "none",
    approximateArea: area,
    lookupOptions,
    nearby,
    transit,
    destinations,
    notes: [
      hasFacts
        ? (locale === "zh" ? "周边和目的地时间按所选大致区域估算，不代表精确房址；车程和步行时间请发布前复核。" : "Nearby facts and destination times use the selected area, not the exact address; drive and walking times are approximate. Review before publishing.")
        : (locale === "zh" ? "地图服务没有返回所选类别的可用结果；AI不会补写未经验证的说法。" : "The map service returned no usable results for the selected categories; AI will not add unverified claims."),
    ],
    cached: false,
  };
  if (hasFacts) {
    contextCache.set(cacheKey, { expiresAt: Date.now() + CONTEXT_CACHE_TTL, value: result });
    try {
      await writeLocationContextCache(cacheKey, result);
    } catch {
      // Keep the in-memory result even if the optional persistent cache is unavailable.
    }
  }
  return result;
}
