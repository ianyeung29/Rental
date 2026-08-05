export type LocationContextPlace = {
  name: string;
  category: string;
};

export type LocationContextTransit = {
  name: string;
  mode: string;
  walkMinutes?: number;
};

export type LocationContext = {
  source: "google" | "none";
  approximateArea: string;
  nearby: LocationContextPlace[];
  transit: LocationContextTransit[];
  notes: string[];
};

type LocationContextRequest = {
  areaEn: string;
  areaZh: string;
  boroughEn?: string;
  boroughZh?: string;
  locale?: "zh" | "en";
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

const CONTEXT_CACHE_TTL = 30 * 60 * 1000;
const contextCache = new Map<string, { expiresAt: number; value: LocationContext }>();

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function emptyContext(area: string, note: string): LocationContext {
  return { source: "none", approximateArea: area, nearby: [], transit: [], notes: [note] };
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

async function searchPlaces(apiKey: string, body: Record<string, unknown>, languageCode: string) {
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
}

async function walkingMinutes(apiKey: string, origin: Coordinates, destination: Coordinates) {
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
      travelMode: "WALK",
      languageCode: "en-US",
      units: "IMPERIAL",
    }),
    cache: "no-store",
  });
  if (!response.ok) return undefined;
  const data = await response.json() as { routes?: Array<{ duration?: unknown }> };
  const duration = data.routes?.[0]?.duration;
  const seconds = typeof duration === "string" ? Number(duration.replace(/s$/, "")) : Number(duration);
  return Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : undefined;
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
  const queryArea = [areaEn || areaZh, boroughEn || boroughZh, "New York"].filter(Boolean).join(", ");
  const locale = request.locale === "en" ? "en" : "zh";
  if (!area || !queryArea) return emptyContext(area, locale === "zh" ? "请先填写公开区域，再生成周边参考。" : "Add a public area before generating neighborhood context.");

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return emptyContext(area, locale === "zh"
      ? "未配置服务器端地图服务；AI不会编造附近设施或交通时间。"
      : "Server-side map context is not configured; AI will not invent nearby places or travel times.");
  }

  const cacheKey = JSON.stringify({ areaEn, areaZh, boroughEn, boroughZh, locale });
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const languageCode = locale === "zh" ? "zh-CN" : "en";
  const centerResults = await searchPlaces(apiKey, { textQuery: queryArea, pageSize: 1 }, languageCode);
  const center = centerResults[0]?.coordinates || null;
  const locationBias = center ? { circle: { center, radius: 5_000 } } : undefined;
  const nearbyQueries = [
    { query: `grocery store near ${queryArea}`, category: locale === "zh" ? "生活便利" : "Everyday shopping" },
    { query: `park near ${queryArea}`, category: locale === "zh" ? "公园休闲" : "Parks and recreation" },
    { query: `library near ${queryArea}`, category: locale === "zh" ? "图书馆" : "Libraries" },
  ];
  const transitQueries = [
    { query: `subway station near ${queryArea}`, mode: locale === "zh" ? "地铁" : "Subway" },
    { query: `train station near ${queryArea}`, mode: locale === "zh" ? "火车 / 通勤铁路" : "Train / commuter rail" },
    { query: `bus station near ${queryArea}`, mode: locale === "zh" ? "公交" : "Bus" },
  ];
  const [nearbyResults, transitResults] = await Promise.all([
    Promise.all(nearbyQueries.map((item) => searchPlaces(apiKey, { textQuery: item.query, pageSize: 1, ...(locationBias ? { locationBias } : {}) }, languageCode).then((places) => ({ ...item, place: places[0] || null })))),
    Promise.all(transitQueries.map((item) => searchPlaces(apiKey, { textQuery: item.query, pageSize: 1, ...(locationBias ? { locationBias } : {}) }, languageCode).then((places) => ({ ...item, place: places[0] || null })))),
  ]);
  const nearby = nearbyResults.flatMap((item) => item.place ? [{ name: item.place.name, category: item.category }] : []);
  const transitPlaces = uniquePlaces(transitResults.flatMap((item) => item.place ? [item.place] : []));
  const transit = await Promise.all(transitPlaces.slice(0, 3).map(async (place) => {
    const source = transitResults.find((item) => item.place?.name === place.name);
    const walk = center && place.coordinates ? await walkingMinutes(apiKey, center, place.coordinates) : undefined;
    return { name: place.name, mode: source?.mode || (locale === "zh" ? "公共交通" : "Public transit"), ...(walk ? { walkMinutes: walk } : {}) };
  }));
  const cleanTransit = transit;
  const hasFacts = nearby.length > 0 || cleanTransit.length > 0;
  const result: LocationContext = {
    source: hasFacts ? "google" : "none",
    approximateArea: area,
    nearby,
    transit: cleanTransit,
    notes: [
      hasFacts
        ? (locale === "zh" ? "周边信息按所选区域估算，不代表精确房址；交通时间为步行到站时间，请发布前复核。" : "Nearby facts use the selected area, not the exact address; travel times are walks to stations. Review before publishing.")
        : (locale === "zh" ? "地图服务没有返回可用的周边或交通结果；AI不会补写未经验证的说法。" : "The map service returned no usable nearby or transit facts; AI will not add unverified claims."),
    ],
  };
  contextCache.set(cacheKey, { expiresAt: Date.now() + CONTEXT_CACHE_TTL, value: result });
  return result;
}
