import { createHash } from "node:crypto";
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

export const DEFAULT_LOCATION_LOOKUP_OPTIONS: readonly LocationLookupOption[] = ["community", "transit"];
export const MAX_LOCATION_LOOKUP_OPTIONS = 3;
export const MAX_PLACES_CALLS_PER_LOOKUP = 3;
export const MAX_ROUTE_CALLS_PER_LOOKUP = 2;

export type LocationContextPlace = {
  name: string;
  category: string;
};

export type LocationContextTransitLine = {
  name: string;
  shortName?: string;
  vehicleType?: string;
};

export type LocationContextTransit = {
  name: string;
  mode: string;
  walkMinutes?: number;
  lines?: LocationContextTransitLine[];
};

export type LocationContextDestination = {
  name: string;
  category: string;
  mode: "drive" | "walk" | "transit";
  minutes?: number;
  transitLines?: LocationContextTransitLine[];
};

export type LocationContextUsage = {
  placesCalls: number;
  routeCalls: number;
  cacheHit: boolean;
};

export type LocationContextRouteOrigin = "privateAddress" | "approximateArea";

export type CommuteMode = "drive" | "walk" | "transit";

export type CommuteEstimate = {
  source: "google" | "none";
  approximateArea: string;
  destination: string;
  mode: CommuteMode;
  minutes?: number;
  transitLines?: LocationContextTransitLine[];
  cached: boolean;
  note: string;
  usage: LocationContextUsage;
};

export type LocationContext = {
  source: "google" | "none";
  approximateArea: string;
  routeOrigin: LocationContextRouteOrigin;
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
  privateAddress?: string;
  locale?: "zh" | "en";
  lookupOptions?: unknown;
  onUsage?: (usage: LocationContextUsage) => void;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type PlaceResult = {
  id: string;
  name: string;
  coordinates: Coordinates | null;
  types: string[];
  primaryType: string;
  transitLines: LocationContextTransitLine[];
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

type LocationLookupBudget = {
  placesCalls: number;
  routeCalls: number;
};

const CONTEXT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const contextCache = new Map<string, { expiresAt: number; value: LocationContext }>();
const commuteCache = new Map<string, { expiresAt: number; value: CommuteEstimate }>();

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function placeNameKey(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC").replace(/[\s\-_.,/()'’&·]+/g, "");
}

const ASIAN_MARKET_NAME_MARKERS = [
  "h mart",
  "hmart",
  "99 ranch",
  "hong kong supermarket",
  "new kam man",
  "kam man",
  "great wall supermarket",
  "gw supermarket",
  "hualian",
  "hua lian",
  "asian food market",
  "asian grocery",
  "asian market",
  "asian supermarket",
  "chinese supermarket",
  "chinese grocery",
  "chinese market",
  "super 88",
  "t&t supermarket",
  "t & t",
  "m2m",
  "lotte market",
  "lotte plaza",
  "tan a",
  "g mart",
  "gmarket",
  "seafood city",
];

function isChineseOrAsianMarket(place: PlaceResult) {
  const name = place.name.toLocaleLowerCase();
  const normalizedName = placeNameKey(place.name);
  return ASIAN_MARKET_NAME_MARKERS.some((marker) => name.includes(marker) || normalizedName.includes(placeNameKey(marker))) || /华联|华人|亚洲|香港|大华|永和|美东|金门|中国超市|亚洲超市/.test(place.name);
}

function uniqueContextPlaces(places: LocationContextPlace[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = placeNameKey(place.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function privateAddressCacheHash(value: string) {
  return createHash("sha256").update(value.toLocaleLowerCase()).digest("hex").slice(0, 24);
}

export function normalizeLocationLookupOptions(value: unknown, fallback = DEFAULT_LOCATION_LOOKUP_OPTIONS): LocationLookupOption[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is LocationLookupOption => typeof item === "string" && LOCATION_LOOKUP_OPTIONS.includes(item as LocationLookupOption)))).slice(0, MAX_LOCATION_LOOKUP_OPTIONS);
}

function emptyContext(area: string, note: string, lookupOptions: LocationLookupOption[], routeOrigin: LocationContextRouteOrigin = "approximateArea"): LocationContext {
  return { source: "none", approximateArea: area, routeOrigin, lookupOptions, nearby: [], transit: [], destinations: [], notes: [note], cached: false };
}

function displayName(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const text = (value as { text?: unknown }).text;
  return clean(text, 120);
}

function localizedTextOrString(value: unknown) {
  if (typeof value === "string") return clean(value, 120);
  return displayName(value);
}

function contextTransitLine(value: unknown): LocationContextTransitLine | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = localizedTextOrString(record.name) || localizedTextOrString(record.displayName);
  const shortName = localizedTextOrString(record.nameShort) || localizedTextOrString(record.shortDisplayName);
  const vehicleType = clean(record.vehicleType, 50) || (record.vehicle && typeof record.vehicle === "object" ? clean((record.vehicle as Record<string, unknown>).type, 50) : "");
  if (!name && !shortName) return null;
  return { name: name || shortName, ...(shortName && shortName !== name ? { shortName } : {}), ...(vehicleType ? { vehicleType } : {}) };
}

function uniqueTransitLines(lines: LocationContextTransitLine[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = placeNameKey(line.shortName || line.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function transitStationLines(value: unknown) {
  if (!value || typeof value !== "object") return [] as LocationContextTransitLine[];
  const station = value as Record<string, unknown>;
  const agencies = Array.isArray(station.agencies) ? station.agencies : [];
  return uniqueTransitLines(agencies.flatMap((agency) => {
    if (!agency || typeof agency !== "object") return [];
    const lines = (agency as Record<string, unknown>).lines;
    return Array.isArray(lines) ? lines.map(contextTransitLine).filter((line): line is LocationContextTransitLine => Boolean(line)) : [];
  }));
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
  const record = value as { id?: unknown; displayName?: unknown; location?: unknown; types?: unknown; primaryType?: unknown; transitStation?: unknown };
  const name = displayName(record.displayName);
  if (!name) return null;
  return {
    id: clean(record.id, 180),
    name,
    coordinates: coordinates(record.location),
    types: Array.isArray(record.types) ? record.types.filter((type): type is string => typeof type === "string").slice(0, 12) : [],
    primaryType: clean(record.primaryType, 80),
    transitLines: transitStationLines(record.transitStation),
  };
}

function locationContextFromCache(value: unknown, fallbackOptions: LocationLookupOption[]): LocationContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.source !== "google" || typeof record.approximateArea !== "string") return null;
  const nearbyCandidates = Array.isArray(record.nearby)
    ? record.nearby.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const place = item as Record<string, unknown>;
      return typeof place.name === "string" && typeof place.category === "string" ? [{ name: place.name, category: place.category }] : [];
    })
    : [];
  const transit = Array.isArray(record.transit)
    ? record.transit.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const station = item as Record<string, unknown>;
      if (typeof station.name !== "string" || typeof station.mode !== "string") return [];
      const walkMinutes = Number(station.walkMinutes);
      const lines = Array.isArray(station.lines) ? station.lines.map(contextTransitLine).filter((line): line is LocationContextTransitLine => Boolean(line)) : [];
      return [{ name: station.name, mode: station.mode, ...(Number.isFinite(walkMinutes) && walkMinutes > 0 ? { walkMinutes: Math.round(walkMinutes) } : {}), ...(lines.length ? { lines: uniqueTransitLines(lines) } : {}) }];
    }).slice(0, 3)
    : [];
  const destinations = Array.isArray(record.destinations)
    ? record.destinations.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const destination = item as Record<string, unknown>;
      if (typeof destination.name !== "string" || typeof destination.category !== "string" || (destination.mode !== "drive" && destination.mode !== "walk" && destination.mode !== "transit")) return [];
      const minutes = Number(destination.minutes);
      const mode: LocationContextDestination["mode"] = destination.mode === "drive" ? "drive" : destination.mode === "transit" ? "transit" : "walk";
      const transitLines = Array.isArray(destination.transitLines) ? destination.transitLines.map(contextTransitLine).filter((line): line is LocationContextTransitLine => Boolean(line)) : [];
      return [{ name: destination.name, category: destination.category, mode, ...(Number.isFinite(minutes) && minutes > 0 ? { minutes: Math.round(minutes) } : {}), ...(transitLines.length ? { transitLines: uniqueTransitLines(transitLines) } : {}) }];
    }).slice(0, 3)
    : [];
  const routedNames = new Set(destinations.map((destination) => placeNameKey(destination.name)));
  const nearby = uniqueContextPlaces(nearbyCandidates).filter((place) => !routedNames.has(placeNameKey(place.name))).slice(0, 6);
  if (!nearby.length && !transit.length && !destinations.length) return null;
  return {
    source: "google",
    approximateArea: clean(record.approximateArea),
    routeOrigin: record.routeOrigin === "privateAddress" ? "privateAddress" : "approximateArea",
    lookupOptions: normalizeLocationLookupOptions(record.lookupOptions, fallbackOptions),
    nearby,
    transit,
    destinations,
    notes: Array.isArray(record.notes) ? record.notes.filter((note): note is string => typeof note === "string").slice(0, 3) : [],
    cached: true,
  };
}

async function searchPlaces(apiKey: string, body: Record<string, unknown>, languageCode: string, includeTransitDetails = false) {
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": `places.id,places.displayName,places.location,places.types,places.primaryType${includeTransitDetails ? ",places.transitStation" : ""}`,
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

type RouteResult = {
  minutes?: number;
  transitLines: LocationContextTransitLine[];
};

async function routeMinutes(apiKey: string, origin: Coordinates, destination: Coordinates, travelMode: "DRIVE" | "WALK" | "TRANSIT", languageCode: string): Promise<RouteResult> {
  const emptyRoute: RouteResult = { transitLines: [] };
  try {
    const transitFieldMask = "routes.legs.steps.transitDetails";
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": travelMode === "TRANSIT" ? `routes.duration,${transitFieldMask}` : "routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode,
        languageCode,
        units: "IMPERIAL",
        ...(travelMode === "TRANSIT" ? {
          transitPreferences: {
            allowedTravelModes: ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL", "RAIL"],
            routingPreference: "FEWER_TRANSFERS",
          },
        } : {}),
      }),
      cache: "no-store",
    });
    if (!response.ok) return emptyRoute;
    const data = await response.json() as {
      routes?: Array<{
        duration?: unknown;
        legs?: Array<{ steps?: Array<{ transitDetails?: { transitLine?: unknown } }> }>;
      }>;
    };
    const route = data.routes?.[0];
    const transitLines = uniqueTransitLines((route?.legs || []).flatMap((leg) => (leg.steps || []).flatMap((step) => {
      const line = contextTransitLine(step.transitDetails?.transitLine);
      return line ? [line] : [];
    })));
    const duration = route?.duration;
    const seconds = typeof duration === "string" ? Number(duration.replace(/s$/, "")) : Number(duration);
    return { transitLines, ...(Number.isFinite(seconds) && seconds > 0 ? { minutes: Math.max(1, Math.round(seconds / 60)) } : {}) };
  } catch {
    return emptyRoute;
  }
}

async function searchPlacesWithinBudget(
  apiKey: string,
  body: Record<string, unknown>,
  languageCode: string,
  budget: LocationLookupBudget,
  includeTransitDetails = false,
) {
  if (budget.placesCalls >= MAX_PLACES_CALLS_PER_LOOKUP) return [] as PlaceResult[];
  budget.placesCalls += 1;
  return searchPlaces(apiKey, body, languageCode, includeTransitDetails);
}

async function routeMinutesWithinBudget(
  apiKey: string,
  origin: Coordinates,
  destination: Coordinates,
  travelMode: "DRIVE" | "WALK" | "TRANSIT",
  languageCode: string,
  budget: LocationLookupBudget,
) : Promise<RouteResult> {
  if (budget.routeCalls >= MAX_ROUTE_CALLS_PER_LOOKUP) return { transitLines: [] };
  budget.routeCalls += 1;
  return routeMinutes(apiKey, origin, destination, travelMode, languageCode);
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
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  return places.filter((place) => {
    const nameKey = placeNameKey(place.name);
    if ((place.id && seenIds.has(place.id)) || (nameKey && seenNames.has(nameKey))) return false;
    if (place.id) seenIds.add(place.id);
    if (nameKey) seenNames.add(nameKey);
    return true;
  });
}

export async function buildLocationContext(request: LocationContextRequest): Promise<LocationContext> {
  const areaEn = clean(request.areaEn);
  const areaZh = clean(request.areaZh);
  const boroughEn = clean(request.boroughEn);
  const boroughZh = clean(request.boroughZh);
  const privateAddress = clean(request.privateAddress, 240);
  const area = areaZh || areaEn;
  const lookupOptions = normalizeLocationLookupOptions(request.lookupOptions);
  const locale = request.locale === "en" ? "en" : "zh";
  const reportUsage = (usage: LocationContextUsage) => request.onUsage?.(usage);
  const noLookupNote = locale === "zh"
    ? "未选择附近查找类别；AI只会润色你填写的房源事实。"
    : "No nearby lookup categories selected; AI will polish only the listing facts you provided.";
  if (!lookupOptions.length) {
    reportUsage({ placesCalls: 0, routeCalls: 0, cacheHit: false });
    return emptyContext(area, noLookupNote, lookupOptions);
  }
  const queryArea = [areaEn || areaZh, boroughEn || boroughZh, "New York"].filter(Boolean).join(", ");
  if (!area || !queryArea) {
    reportUsage({ placesCalls: 0, routeCalls: 0, cacheHit: false });
    return emptyContext(area, locale === "zh" ? "请先填写公开区域，再生成附近参考。" : "Add a public area before generating neighborhood context.", lookupOptions);
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    reportUsage({ placesCalls: 0, routeCalls: 0, cacheHit: false });
    return emptyContext(area, locale === "zh"
      ? "未配置服务器端地图服务；AI不会编造附近设施或交通时间。"
      : "Server-side map context is not configured; AI will not invent nearby places or travel times.", lookupOptions);
  }

  const cacheKey = JSON.stringify({ version: 6, areaEn, areaZh, boroughEn, boroughZh, locale, lookupOptions, privateAddressHash: privateAddress ? privateAddressCacheHash(privateAddress) : "" });
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    reportUsage({ placesCalls: 0, routeCalls: 0, cacheHit: true });
    return { ...cached.value, cached: true };
  }
  try {
    const stored = locationContextFromCache(await readLocationContextCache(cacheKey), lookupOptions);
    if (stored) {
      contextCache.set(cacheKey, { expiresAt: Date.now() + CONTEXT_CACHE_TTL, value: stored });
      reportUsage({ placesCalls: 0, routeCalls: 0, cacheHit: true });
      return stored;
    }
  } catch {
    // Neon caching is an optimization; a cache outage should not block polishing.
  }

  const languageCode = locale === "zh" ? "zh-CN" : "en";
  const budget: LocationLookupBudget = { placesCalls: 0, routeCalls: 0 };
  const privateOriginResults = privateAddress
    ? await searchPlacesWithinBudget(apiKey, { textQuery: privateAddress, pageSize: 1 }, languageCode, budget)
    : [];
  const centerResults = privateOriginResults[0]?.coordinates
    ? privateOriginResults
    : await searchPlacesWithinBudget(apiKey, { textQuery: queryArea, pageSize: 1 }, languageCode, budget);
  const center = centerResults[0]?.coordinates || null;
  const routeOrigin = privateOriginResults[0]?.coordinates ? "privateAddress" : "approximateArea";
  const locationBias = center ? { circle: { center, radius: 5_000 } } : undefined;
  const nearbyDefinitions: Record<Exclude<LocationLookupOption, "transit" | "community">, NearbyDefinition> = {
    grocery: { query: "Chinese supermarket", categoryZh: "中文超市 / 亚洲超市", categoryEn: "Chinese / Asian supermarket", includedType: "supermarket" },
    park: { query: "park", categoryZh: "公园休闲", categoryEn: "Parks and recreation", includedType: "park" },
    library: { query: "library", categoryZh: "图书馆", categoryEn: "Libraries", includedType: "library" },
    pharmacy: { query: "pharmacy", categoryZh: "药房", categoryEn: "Pharmacies", includedType: "pharmacy" },
    school: { query: "school", categoryZh: "学校", categoryEn: "Schools", includedType: "school" },
    restaurant: { query: "restaurant", categoryZh: "餐饮", categoryEn: "Restaurants", includedType: "restaurant" },
  };
  const community = lookupOptions.includes("community") ? communityDefinition(areaEn, areaZh, boroughEn, boroughZh) : null;
  const communityPlace = community
    ? (await searchPlacesWithinBudget(apiKey, { textQuery: community.query, pageSize: 1 }, languageCode, budget))[0] || null
    : null;
  // Transit is a priority lookup. Reserve its Places call before optional grocery fallback searches use the budget.
  const transitPlaces = lookupOptions.includes("transit")
    ? await searchPlacesWithinBudget(apiKey, { textQuery: "subway station or bus stop", pageSize: 1, includedType: "transit_station", strictTypeFiltering: true, rankPreference: "DISTANCE", ...(locationBias ? { locationBias } : {}) }, languageCode, budget, true)
    : [];
  const nearbyOptions = lookupOptions.filter((option): option is Exclude<LocationLookupOption, "transit" | "community"> => option !== "transit" && option !== "community");
  const nearbyResults = await Promise.all(nearbyOptions.map(async (option) => {
    const definition = nearbyDefinitions[option];
    let places = await searchPlacesWithinBudget(apiKey, { textQuery: definition.query, pageSize: option === "grocery" ? 5 : 1, includedType: definition.includedType, strictTypeFiltering: true, rankPreference: "DISTANCE", ...(locationBias ? { locationBias } : {}) }, languageCode, budget);
    if (option === "grocery") {
      let place = places.find(isChineseOrAsianMarket) || null;
      if (!place) {
        places = await searchPlacesWithinBudget(apiKey, { textQuery: "Asian grocery store", pageSize: 5, includedType: definition.includedType, strictTypeFiltering: true, rankPreference: "DISTANCE", ...(locationBias ? { locationBias } : {}) }, languageCode, budget);
        place = places.find(isChineseOrAsianMarket) || null;
      }
      return { option, place };
    }
    return { option, place: places[0] || null };
  }));
  const nearbyCandidates = nearbyResults.flatMap(({ option, place }) => {
    if (!place) return [];
    const definition = nearbyDefinitions[option];
    return [{ name: place.name, category: locale === "zh" ? definition.categoryZh : definition.categoryEn }];
  });

  const routeJobs: Array<{ place: PlaceResult; name: string; category: string; mode: "drive" | "walk" | "transit"; travelMode: "DRIVE" | "WALK" | "TRANSIT" }> = [];
  if (community && communityPlace?.coordinates && center) {
    routeJobs.push({ place: communityPlace, name: communityPlace.name, category: locale === "zh" ? community.categoryZh : community.categoryEn, mode: "transit", travelMode: "TRANSIT" });
  }
  const groceryPlace = nearbyResults.find((result) => result.option === "grocery")?.place;
  if (!community && groceryPlace?.coordinates && center) {
    routeJobs.push({ place: groceryPlace, name: groceryPlace.name, category: locale === "zh" ? "中文超市 / 亚洲超市" : "Chinese / Asian supermarket", mode: "walk", travelMode: "WALK" });
  }
  const destinationResults: Array<LocationContextDestination | null> = await Promise.all(routeJobs.map(async (job) => {
    const route = center && job.place.coordinates ? await routeMinutesWithinBudget(apiKey, center, job.place.coordinates, job.travelMode, languageCode, budget) : { transitLines: [] };
    return route.minutes ? { name: job.name, category: job.category, mode: job.mode, minutes: route.minutes, ...(route.transitLines.length ? { transitLines: route.transitLines } : {}) } : null;
  }));
  const destinations = destinationResults.filter((destination): destination is LocationContextDestination => destination !== null);
  const routedNames = new Set(destinations.map((destination) => placeNameKey(destination.name)));
  const nearby = uniqueContextPlaces(nearbyCandidates).filter((place) => !routedNames.has(placeNameKey(place.name)));

  const transit = await Promise.all(uniquePlaces(transitPlaces).slice(0, 1).map(async (place) => {
    const route = center && place.coordinates ? await routeMinutesWithinBudget(apiKey, center, place.coordinates, "WALK", languageCode, budget) : { transitLines: [] };
    const lineTypes = new Set(place.transitLines.map((line) => line.vehicleType));
    const hasSubway = lineTypes.has("SUBWAY") || lineTypes.has("METRO_RAIL");
    const hasBus = lineTypes.has("BUS");
    const mode = locale === "zh"
      ? hasSubway && hasBus ? "地铁 / 公交站" : hasSubway ? "地铁站" : hasBus ? "公交站" : "公共交通站点"
      : hasSubway && hasBus ? "Subway / bus stop" : hasSubway ? "Subway station" : hasBus ? "Bus stop" : "Public transit stop";
    return { name: place.name, mode, ...(route.minutes ? { walkMinutes: route.minutes } : {}), ...(place.transitLines.length ? { lines: place.transitLines } : {}) };
  }));
  const hasFacts = nearby.length > 0 || transit.length > 0 || destinations.length > 0;
  const groceryFound = Boolean(groceryPlace);
  const groceryNote = lookupOptions.includes("grocery") && !groceryFound
    ? budget.placesCalls >= MAX_PLACES_CALLS_PER_LOOKUP
      ? (locale === "zh" ? "本次地图查询优先保留给华人生活圈和公共交通；中文 / 亚洲超市查询达到调用上限。" : "This map lookup prioritized the Chinese community and public transit; the Chinese / Asian supermarket lookup reached the call limit.")
      : (locale === "zh" ? "未找到可验证的中文 / 亚洲超市；普通超市不会被标注为中文超市。" : "No verifiable Chinese or Asian supermarket was found; generic supermarkets are not labeled as Chinese supermarkets.")
    : "";
  const contextNote = routeOrigin === "privateAddress"
    ? (locale === "zh" ? "周边和出行时间使用发布者填写的私密地址计算；精确地址不会发送给 AI 或显示在公开页面，发布前请复核。" : "Nearby facts and travel times use the poster's private address on the server; the exact address is not sent to AI or shown publicly. Review before publishing.")
    : (locale === "zh" ? "周边和目的地时间按所选大致区域估算，不代表精确房址；车程、公共交通和步行时间请发布前复核。" : "Nearby facts and destination times use the selected area, not the exact property address; driving, public-transit, and walking times are approximate. Review before publishing.");
  const result: LocationContext = {
    source: hasFacts ? "google" : "none",
    approximateArea: area,
    routeOrigin,
    lookupOptions,
    nearby,
    transit,
    destinations,
    notes: [
      hasFacts
        ? contextNote
        : (locale === "zh" ? "地图服务没有返回所选类别的可用结果；AI不会补写未经验证的说法。" : "The map service returned no usable results for the selected categories; AI will not add unverified claims."),
      ...(groceryNote ? [groceryNote] : []),
    ],
    cached: false,
  };
  reportUsage({ placesCalls: budget.placesCalls, routeCalls: budget.routeCalls, cacheHit: false });
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

function commuteMode(value: unknown): CommuteMode {
  return value === "walk" || value === "transit" ? value : "drive";
}

function privateDestination(value: string) {
  return /(^|\s)\d{1,6}\s+[^,]+(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|way|place|pl)\b/i.test(value);
}

function commuteCacheValue(value: unknown): CommuteEstimate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "commute" || (record.source !== "google" && record.source !== "none")) return null;
  const mode = commuteMode(record.mode);
  const minutes = Number(record.minutes);
  const usage = record.usage && typeof record.usage === "object" ? record.usage as Record<string, unknown> : {};
  return {
    source: record.source as "google" | "none",
    approximateArea: clean(record.approximateArea),
    destination: clean(record.destination),
    mode,
    ...(Number.isFinite(minutes) && minutes > 0 ? { minutes: Math.round(minutes) } : {}),
    ...(Array.isArray(record.transitLines) ? { transitLines: uniqueTransitLines(record.transitLines.map(contextTransitLine).filter((line): line is LocationContextTransitLine => Boolean(line))) } : {}),
    cached: true,
    note: clean(record.note, 300),
    usage: {
      placesCalls: Number(usage.placesCalls) || 0,
      routeCalls: Number(usage.routeCalls) || 0,
      cacheHit: true,
    },
  };
}

export async function buildCommuteEstimate(request: {
  areaEn: string;
  areaZh: string;
  boroughEn?: string;
  boroughZh?: string;
  destination: string;
  mode?: unknown;
  locale?: "zh" | "en";
}): Promise<CommuteEstimate> {
  const areaEn = clean(request.areaEn);
  const areaZh = clean(request.areaZh);
  const boroughEn = clean(request.boroughEn);
  const boroughZh = clean(request.boroughZh);
  const area = areaZh || areaEn;
  const destination = clean(request.destination);
  const mode = commuteMode(request.mode);
  const locale = request.locale === "en" ? "en" : "zh";
  const noResult = (note: string, source: "google" | "none" = "none", cached = false): CommuteEstimate => ({
    source,
    approximateArea: area,
    destination,
    mode,
    cached,
    note,
    usage: { placesCalls: 0, routeCalls: 0, cacheHit: cached },
  });

  if (!area || !destination) return noResult(locale === "zh" ? "请填写大致区域和目的地。" : "Add an approximate area and a destination.");
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return noResult(locale === "zh" ? "服务器端地图服务尚未配置。" : "Server-side map context is not configured.");

  const queryArea = [areaEn || areaZh, boroughEn || boroughZh, "New York"].filter(Boolean).join(", ");
  const privateTarget = privateDestination(destination);
  const cacheKey = JSON.stringify({
    version: 2,
    kind: "commute",
    areaEn,
    areaZh,
    boroughEn,
    boroughZh,
    destinationHash: createHash("sha256").update(destination.toLocaleLowerCase()).digest("hex").slice(0, 24),
    mode,
    locale,
  });
  if (!privateTarget) {
    const cached = commuteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true, usage: { placesCalls: 0, routeCalls: 0, cacheHit: true } };
    try {
      const stored = commuteCacheValue(await readLocationContextCache(cacheKey));
      if (stored) {
        commuteCache.set(cacheKey, { expiresAt: Date.now() + CONTEXT_CACHE_TTL, value: stored });
        return { ...stored, cached: true, usage: { placesCalls: 0, routeCalls: 0, cacheHit: true } };
      }
    } catch {
      // Persistent caching is an optimization; an unavailable cache should not block a route estimate.
    }
  }

  const languageCode = locale === "zh" ? "zh-CN" : "en";
  const budget: LocationLookupBudget = { placesCalls: 0, routeCalls: 0 };
  try {
    const centerResults = await searchPlacesWithinBudget(apiKey, { textQuery: queryArea, pageSize: 1 }, languageCode, budget);
    const center = centerResults[0]?.coordinates || null;
    const destinationResults = await searchPlacesWithinBudget(apiKey, { textQuery: `${destination} near ${queryArea}`, pageSize: 1 }, languageCode, budget);
    const destinationPlace = destinationResults[0] || null;
    if (!center || !destinationPlace?.coordinates) {
      return { ...noResult(locale === "zh" ? "地图没有找到可计算路线的区域或目的地；请尝试输入附近地标、学校或商圈。" : "The map could not find a routeable area or destination; try a nearby landmark, school, or commercial district."), usage: { ...budget, cacheHit: false } };
    }
    const travelMode = mode === "walk" ? "WALK" : mode === "transit" ? "TRANSIT" : "DRIVE";
    const route = await routeMinutesWithinBudget(apiKey, center, destinationPlace.coordinates, travelMode, languageCode, budget);
    if (!route.minutes) {
      return { ...noResult(locale === "zh" ? "地图暂时没有返回路线时间；请发布前自行核实。" : "The map did not return a travel time; verify the route before relying on it."), usage: { ...budget, cacheHit: false } };
    }
    const result: CommuteEstimate = {
      source: "google",
      approximateArea: area,
      destination: destinationPlace.name || destination,
      mode,
      minutes: route.minutes,
      ...(route.transitLines.length ? { transitLines: route.transitLines } : {}),
      cached: false,
      note: locale === "zh"
        ? "这是从所选大致区域中心计算的估算，不代表精确房址或固定通勤时间；公共交通班次会随日期和时段变化。"
        : "This is an estimate from the selected approximate area, not the exact property address or a guaranteed commute time; transit schedules vary by date and departure time.",
      usage: { ...budget, cacheHit: false },
    };
    if (!privateTarget) {
      commuteCache.set(cacheKey, { expiresAt: Date.now() + CONTEXT_CACHE_TTL, value: result });
      try {
        await writeLocationContextCache(cacheKey, { kind: "commute", ...result }, 7);
      } catch {
        // Keep the in-memory result if the optional persistent cache is unavailable.
      }
    }
    return result;
  } catch {
    return { ...noResult(locale === "zh" ? "地图服务暂时不可用；请稍后重试。" : "Map services are temporarily unavailable; try again later."), usage: { ...budget, cacheHit: false } };
  }
}
