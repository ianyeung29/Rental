import { createHash } from "node:crypto";
import {
  DEFAULT_LOCATION_LOOKUP_SETTINGS,
  readLocationContextCache,
  readLocationLookupSettings,
  writeLocationContextCache,
} from "./db";
import {
  hasRailTransitLine as ruleHasRailTransitLine,
  hasUrbanTransitLine as ruleHasUrbanTransitLine,
  isAcceptableNearbyWalkMinutes,
  isChineseOrAsianMarket as ruleIsChineseOrAsianMarket,
  isLongIslandHighway as ruleIsLongIslandHighway,
  placeNameKey as rulePlaceNameKey,
  selectUrbanTransitPlaces,
  transitLineTypes as ruleTransitLineTypes,
  transitRegion as ruleTransitRegion,
  uniqueNamedPlaces,
  uniquePlaces as ruleUniquePlaces,
  urbanTransitKind,
  type TransitRegion as RuleTransitRegion,
} from "./location-context-rules";

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
export const DEFAULT_PLACES_CALLS_PER_LOOKUP = DEFAULT_LOCATION_LOOKUP_SETTINGS.placesCallsPerLookup;
export const DEFAULT_ROUTE_CALLS_PER_LOOKUP = DEFAULT_LOCATION_LOOKUP_SETTINGS.routeCallsPerLookup;

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
  driveMinutes?: number;
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

export type LocationContextDiagnostics = {
  checkedAt: string;
  placesAttempted: number;
  routesAttempted: number;
  placesQualityIssues: number;
  routesQualityIssues: number;
  rejectionReasons: string[];
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
  checkedAt?: string;
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
  checkedAt?: string;
  diagnostics?: LocationContextDiagnostics;
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

type TransitRegion = RuleTransitRegion;

type LocationLookupBudget = {
  placesCalls: number;
  routeCalls: number;
  placesLimit: number;
  routeLimit: number;
};

async function currentLocationLookupSettings() {
  try {
    return await readLocationLookupSettings();
  } catch {
    return { ...DEFAULT_LOCATION_LOOKUP_SETTINGS };
  }
}

const CONTEXT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const contextCache = new Map<string, { expiresAt: number; value: LocationContext }>();
const commuteCache = new Map<string, { expiresAt: number; value: CommuteEstimate }>();

export function clearLocationContextMemoryCache() {
  const cleared = contextCache.size + commuteCache.size;
  contextCache.clear();
  commuteCache.clear();
  return cleared;
}

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function placeNameKey(value: string) {
  return rulePlaceNameKey(value);
}

function isChineseOrAsianMarket(place: PlaceResult) {
  return ruleIsChineseOrAsianMarket(place);
}

function uniqueContextPlaces(places: LocationContextPlace[]) {
  return uniqueNamedPlaces(places);
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
  const checkedAt = new Date().toISOString();
  return {
    source: "none",
    approximateArea: area,
    routeOrigin,
    lookupOptions,
    nearby: [],
    transit: [],
    destinations: [],
    notes: [note],
    cached: false,
    checkedAt,
    diagnostics: { checkedAt, placesAttempted: 0, routesAttempted: 0, placesQualityIssues: 0, routesQualityIssues: 0, rejectionReasons: [] },
  };
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

function locationContextDiagnostics(value: unknown): LocationContextDiagnostics {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const integer = (candidate: unknown) => Number.isFinite(Number(candidate)) ? Math.max(0, Math.round(Number(candidate))) : 0;
  return {
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : new Date().toISOString(),
    placesAttempted: integer(record.placesAttempted),
    routesAttempted: integer(record.routesAttempted),
    placesQualityIssues: integer(record.placesQualityIssues),
    routesQualityIssues: integer(record.routesQualityIssues),
    rejectionReasons: Array.isArray(record.rejectionReasons) ? record.rejectionReasons.filter((reason): reason is string => typeof reason === "string").slice(0, 8) : [],
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
      const driveMinutes = Number(station.driveMinutes);
      const lines = Array.isArray(station.lines) ? station.lines.map(contextTransitLine).filter((line): line is LocationContextTransitLine => Boolean(line)) : [];
      return [{ name: station.name, mode: station.mode, ...(Number.isFinite(walkMinutes) && walkMinutes > 0 ? { walkMinutes: Math.round(walkMinutes) } : {}), ...(Number.isFinite(driveMinutes) && driveMinutes > 0 ? { driveMinutes: Math.round(driveMinutes) } : {}), ...(lines.length ? { lines: uniqueTransitLines(lines) } : {}) }];
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
    ...(typeof record.checkedAt === "string" ? { checkedAt: record.checkedAt } : {}),
    ...(record.diagnostics && typeof record.diagnostics === "object" && !Array.isArray(record.diagnostics) ? { diagnostics: locationContextDiagnostics(record.diagnostics) } : {}),
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

type RouteWaypoint = Coordinates | string;

function routeWaypoint(value: RouteWaypoint) {
  return typeof value === "string" ? { address: value } : { location: { latLng: value } };
}

async function routeMinutes(apiKey: string, origin: RouteWaypoint, destination: Coordinates, travelMode: "DRIVE" | "WALK" | "TRANSIT", languageCode: string): Promise<RouteResult> {
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
        origin: routeWaypoint(origin),
        destination: routeWaypoint(destination),
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
  if (budget.placesCalls >= budget.placesLimit) return [] as PlaceResult[];
  budget.placesCalls += 1;
  return searchPlaces(apiKey, body, languageCode, includeTransitDetails);
}

async function routeMinutesWithinBudget(
  apiKey: string,
  origin: RouteWaypoint,
  destination: Coordinates,
  travelMode: "DRIVE" | "WALK" | "TRANSIT",
  languageCode: string,
  budget: LocationLookupBudget,
) : Promise<RouteResult> {
  if (budget.routeCalls >= budget.routeLimit) return { transitLines: [] };
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

function transitRegion(areaEn: string, areaZh: string, boroughEn: string, boroughZh: string): TransitRegion {
  return ruleTransitRegion(areaEn, areaZh, boroughEn, boroughZh);
}

function transitLineTypes(place: PlaceResult) {
  return ruleTransitLineTypes(place);
}

function hasUrbanTransitLine(place: PlaceResult) {
  return ruleHasUrbanTransitLine(place);
}

function hasRailTransitLine(place: PlaceResult) {
  return ruleHasRailTransitLine(place);
}

function isLongIslandHighway(place: PlaceResult) {
  return ruleIsLongIslandHighway(place);
}

function nearbyQuery(query: string, routeOriginQuery: string) {
  return `${query} near ${routeOriginQuery}`;
}

function uniquePlaces(places: PlaceResult[]) {
  return ruleUniquePlaces(places);
}

function transitModeLabel(place: PlaceResult, locale: "zh" | "en", isLongIsland: boolean) {
  if (isLongIsland) return locale === "zh" ? "LIRR \u8f66\u7ad9" : "LIRR station";
  const kind = urbanTransitKind(place);
  if (locale === "zh") return kind === "both" ? "\u5730\u94c1 / \u516c\u4ea4\u7ad9" : kind === "subway" ? "\u5730\u94c1\u7ad9" : kind === "bus" ? "\u516c\u4ea4\u7ad9" : "\u516c\u5171\u4ea4\u901a\u7ad9\u70b9";
  return kind === "both" ? "Subway / bus stop" : kind === "subway" ? "Subway station" : kind === "bus" ? "Bus stop" : "Public transit stop";
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

  const lookupSettings = await currentLocationLookupSettings();
  const cacheKey = JSON.stringify({ version: 10, areaEn, areaZh, boroughEn, boroughZh, locale, lookupOptions, lookupSettings: { placesCallsPerLookup: lookupSettings.placesCallsPerLookup, routeCallsPerLookup: lookupSettings.routeCallsPerLookup }, privateAddressHash: privateAddress ? privateAddressCacheHash(privateAddress) : "" });
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
  const budget: LocationLookupBudget = {
    placesCalls: 0,
    routeCalls: 0,
    placesLimit: lookupSettings.placesCallsPerLookup,
    routeLimit: lookupSettings.routeCallsPerLookup,
  };
  const routeOrigin = privateAddress ? "privateAddress" : "approximateArea";
  const routeOriginQuery = privateAddress || queryArea;
  const routeOriginValue: RouteWaypoint = privateAddress || queryArea;
  const region = transitRegion(areaEn, areaZh, boroughEn, boroughZh);
  let placesQualityIssues = 0;
  let routesQualityIssues = 0;
  const rejectionReasons: string[] = [];
  const addRejectionReason = (reason: string) => {
    if (!rejectionReasons.includes(reason)) rejectionReasons.push(reason);
  };
  const nearbyDefinitions: Record<Exclude<LocationLookupOption, "transit" | "community">, NearbyDefinition> = {
    grocery: { query: "Chinese supermarket Chinese grocery Asian supermarket", categoryZh: "中文超市 / 亚洲超市", categoryEn: "Chinese / Asian supermarket", includedType: "supermarket" },
    park: { query: "park", categoryZh: "公园休闲", categoryEn: "Parks and recreation", includedType: "park" },
    library: { query: "library", categoryZh: "图书馆", categoryEn: "Libraries", includedType: "library" },
    pharmacy: { query: "pharmacy", categoryZh: "药房", categoryEn: "Pharmacies", includedType: "pharmacy" },
    school: { query: "school", categoryZh: "学校", categoryEn: "Schools", includedType: "school" },
    restaurant: { query: "restaurant", categoryZh: "餐饮", categoryEn: "Restaurants", includedType: "restaurant" },
  };
  const community = lookupOptions.includes("community") ? communityDefinition(areaEn, areaZh, boroughEn, boroughZh) : null;
  const communityPlacesBeforeLookup = budget.placesCalls;
  const communityPlace = community
    ? (await searchPlacesWithinBudget(apiKey, { textQuery: nearbyQuery(community.query, routeOriginQuery), pageSize: 3 }, languageCode, budget))[0] || null
    : null;
  const communityAttempted = budget.placesCalls > communityPlacesBeforeLookup;
  if (community && !communityPlace) {
    placesQualityIssues += 1;
    addRejectionReason(communityAttempted ? "community-place-not-found" : "community-place-budget-exhausted");
  }
  let transitPlaces: PlaceResult[] = [];
  if (lookupOptions.includes("transit")) {
    if (region === "urban") {
      // Search for the most local mode first. A broad "subway or bus" text
      // search can return a recognizable but very distant subway station even
      // when a nearby bus stop exists.
      transitPlaces = await searchPlacesWithinBudget(apiKey, {
        textQuery: nearbyQuery("bus stop", routeOriginQuery),
        pageSize: 10,
        includedType: "bus_station",
        strictTypeFiltering: true,
        rankPreference: "DISTANCE",
      }, languageCode, budget, true);
      const hasBusResult = transitPlaces.some((place) => {
        const kind = urbanTransitKind(place);
        return kind === "bus" || kind === "both";
      });
      if (!hasBusResult && budget.placesCalls < budget.placesLimit) {
        transitPlaces = await searchPlacesWithinBudget(apiKey, {
          textQuery: nearbyQuery("subway station", routeOriginQuery),
          pageSize: 8,
          includedType: "subway_station",
          strictTypeFiltering: true,
          rankPreference: "DISTANCE",
        }, languageCode, budget, true);
      }
    } else {
      const transitQuery = region === "longIsland" ? "LIRR station" : "public transit station";
      transitPlaces = await searchPlacesWithinBudget(apiKey, { textQuery: nearbyQuery(transitQuery, routeOriginQuery), pageSize: 8, includedType: "transit_station", strictTypeFiltering: true, rankPreference: "DISTANCE" }, languageCode, budget, true);
    }
  }
  const nearbyOptions = lookupOptions.filter((option): option is Exclude<LocationLookupOption, "transit" | "community"> => option !== "transit" && option !== "community");
  const nearbyResults = await Promise.all(nearbyOptions.map(async (option) => {
    const definition = nearbyDefinitions[option];
    const placesBeforeLookup = budget.placesCalls;
    let places = await searchPlacesWithinBudget(apiKey, { textQuery: nearbyQuery(definition.query, routeOriginQuery), pageSize: option === "grocery" ? 10 : 1, includedType: definition.includedType, strictTypeFiltering: true, rankPreference: "DISTANCE" }, languageCode, budget);
    let rejectedCandidates = 0;
    if (option === "grocery") {
      let place = places.find(isChineseOrAsianMarket) || null;
      rejectedCandidates += place ? 0 : places.length;
      if (!place) {
        places = await searchPlacesWithinBudget(apiKey, { textQuery: nearbyQuery("Asian grocery store", routeOriginQuery), pageSize: 10, includedType: definition.includedType, strictTypeFiltering: true, rankPreference: "DISTANCE" }, languageCode, budget);
        place = places.find(isChineseOrAsianMarket) || null;
        rejectedCandidates += place ? 0 : places.length;
      }
      const attempted = budget.placesCalls > placesBeforeLookup;
      if (!place && attempted) placesQualityIssues += 1;
      if (rejectedCandidates > 0) {
        placesQualityIssues += Math.min(2, rejectedCandidates);
        addRejectionReason("non-matching-supermarket-candidate");
      } else if (!place) {
        addRejectionReason(attempted ? "grocery-place-not-found" : "grocery-place-budget-exhausted");
      }
      return { option, place, attempted, rejectedCandidates };
    }
    const place = places[0] || null;
    const attempted = budget.placesCalls > placesBeforeLookup;
    if (!place && attempted) {
      placesQualityIssues += 1;
      addRejectionReason(`${option}-place-not-found`);
    } else if (!place) {
      placesQualityIssues += 1;
      addRejectionReason(`${option}-place-budget-exhausted`);
    }
    return { option, place, attempted, rejectedCandidates };
  }));
  const transitCandidates = uniquePlaces(transitPlaces).filter((place) => region === "urban" ? hasUrbanTransitLine(place) : region === "longIsland" ? hasRailTransitLine(place) : true);
  const transitPlacesForResults = region === "urban" ? selectUrbanTransitPlaces(transitCandidates) : transitCandidates.slice(0, 1);
  const transitPlace = transitPlacesForResults[0] || null;
  if (lookupOptions.includes("transit") && !transitPlace) {
    placesQualityIssues += 1;
    addRejectionReason(budget.placesCalls >= budget.placesLimit ? "transit-place-budget-exhausted" : "transit-place-not-found");
  }
  // Start the primary transit route before other optional destinations so the
  // two-route budget is spent on the nearby bus/LIRR result first.
  const transitResultPromise: Promise<LocationContextTransit | null> = transitPlace
    ? (() => {
      const isLongIsland = region === "longIsland";
       const route = transitPlace.coordinates
         ? routeMinutesWithinBudget(apiKey, routeOriginValue, transitPlace.coordinates, isLongIsland ? "DRIVE" : "WALK", languageCode, budget)
         : Promise.resolve({ transitLines: [] } as RouteResult);
       return route.then((routeResult) => {
         if (!routeResult.minutes) {
           routesQualityIssues += 1;
           addRejectionReason(transitPlace.coordinates ? "transit-route-not-verifiable" : "transit-place-no-coordinates");
           return null;
         }
         if (!isLongIsland && !isAcceptableNearbyWalkMinutes(routeResult.minutes)) {
           routesQualityIssues += 1;
           addRejectionReason("transit-route-too-far");
           return null;
         }
         const mode = transitModeLabel(transitPlace, locale, isLongIsland);
        return { name: transitPlace.name, mode, ...(isLongIsland ? { driveMinutes: routeResult.minutes } : { walkMinutes: routeResult.minutes }), ...(transitPlace.transitLines.length ? { lines: transitPlace.transitLines } : {}) };
      });
    })()
    : Promise.resolve(null);
  const nearbyCandidates = nearbyResults.flatMap(({ option, place }) => {
    if (!place) return [];
    const definition = nearbyDefinitions[option];
    return [{ name: place.name, category: locale === "zh" ? definition.categoryZh : definition.categoryEn }];
  });

  const highwayPlacesBeforeLookup = budget.placesCalls;
  const highwayPlaces = region === "longIsland" && lookupOptions.includes("transit")
    ? await searchPlacesWithinBudget(apiKey, { textQuery: nearbyQuery("Long Island Expressway I-495 entrance", routeOriginQuery), pageSize: 5 }, languageCode, budget)
    : [];
  const highwayAttempted = budget.placesCalls > highwayPlacesBeforeLookup;
  const highwayPlace = uniquePlaces(highwayPlaces).find(isLongIslandHighway) || null;
  if (region === "longIsland" && lookupOptions.includes("transit") && !highwayPlace) {
    placesQualityIssues += 1;
    addRejectionReason(highwayAttempted ? "highway-place-not-found" : "highway-place-budget-exhausted");
  }
  const groceryPlace = nearbyResults.find((result) => result.option === "grocery")?.place;
  const groceryRoutePlanned = Boolean(groceryPlace?.coordinates && (region !== "longIsland" || !lookupOptions.includes("transit") || !highwayPlace));
  const routeJobs: Array<{ place: PlaceResult; name: string; category: string; mode: "drive" | "walk" | "transit"; travelMode: "DRIVE" | "WALK" | "TRANSIT" }> = [];
  if (region === "longIsland" && highwayPlace?.coordinates) {
    routeJobs.push({ place: highwayPlace, name: highwayPlace.name, category: locale === "zh" ? "主要高速公路（I-495）" : "Main highway (I-495)", mode: "drive", travelMode: "DRIVE" });
  }
  // Validate the supermarket before allowing it into the nearby list. The
  // Places text endpoint can return a well-known market that matches the
  // query but is not actually close to the private listing address.
  if (groceryRoutePlanned && groceryPlace) {
    routeJobs.push({ place: groceryPlace, name: groceryPlace.name, category: locale === "zh" ? nearbyDefinitions.grocery.categoryZh : nearbyDefinitions.grocery.categoryEn, mode: "walk", travelMode: "WALK" });
  }
  if (region !== "longIsland" && community && communityPlace?.coordinates) {
    routeJobs.push({ place: communityPlace, name: communityPlace.name, category: locale === "zh" ? community.categoryZh : community.categoryEn, mode: "transit", travelMode: "TRANSIT" });
  }
  const destinationResults: Array<LocationContextDestination | null> = await Promise.all(routeJobs.map(async (job) => {
    const route = job.place.coordinates ? await routeMinutesWithinBudget(apiKey, routeOriginValue, job.place.coordinates, job.travelMode, languageCode, budget) : { transitLines: [] };
    if (!route.minutes) {
      routesQualityIssues += 1;
      addRejectionReason(job.travelMode === "WALK" ? (job.place.coordinates ? "walking-route-not-verifiable" : "walking-place-no-coordinates") : `${job.mode}-route-not-verifiable`);
      return null;
    }
    if (job.travelMode === "WALK" && !isAcceptableNearbyWalkMinutes(route.minutes)) {
      routesQualityIssues += 1;
      addRejectionReason("walking-route-too-far");
      return null;
    }
    return { name: job.name, category: job.category, mode: job.mode, minutes: route.minutes, ...(route.transitLines.length ? { transitLines: route.transitLines } : {}) };
  }));
  const destinations = destinationResults.filter((destination): destination is LocationContextDestination => destination !== null);
  const routedNames = new Set(destinations.map((destination) => placeNameKey(destination.name)));
  const groceryDestination = groceryPlace ? destinations.find((destination) => placeNameKey(destination.name) === placeNameKey(groceryPlace.name)) : null;
  const nearby = uniqueContextPlaces(nearbyCandidates).filter((place) => !routedNames.has(placeNameKey(place.name)) && !(groceryPlace && placeNameKey(place.name) === placeNameKey(groceryPlace.name)));

  const transitResult = await transitResultPromise;
  const secondaryTransitPlace = transitPlacesForResults[1] || null;
  const secondaryTransitResult: Promise<LocationContextTransit | null> = secondaryTransitPlace
     ? (secondaryTransitPlace.coordinates
       ? routeMinutesWithinBudget(apiKey, routeOriginValue, secondaryTransitPlace.coordinates, region === "longIsland" ? "DRIVE" : "WALK", languageCode, budget)
       : Promise.resolve({ transitLines: [] } as RouteResult)
     ).then((routeResult) => {
       if (!routeResult.minutes) {
         routesQualityIssues += 1;
         addRejectionReason(secondaryTransitPlace.coordinates ? "secondary-transit-route-not-verifiable" : "secondary-transit-place-no-coordinates");
         return null;
       }
       if (region !== "longIsland" && !isAcceptableNearbyWalkMinutes(routeResult.minutes)) {
         routesQualityIssues += 1;
         addRejectionReason("secondary-transit-route-too-far");
         return null;
       }
       return {
        name: secondaryTransitPlace.name,
        mode: transitModeLabel(secondaryTransitPlace, locale, region === "longIsland"),
        ...(region === "longIsland" ? { driveMinutes: routeResult.minutes } : { walkMinutes: routeResult.minutes }),
        ...(secondaryTransitPlace.transitLines.length ? { lines: secondaryTransitPlace.transitLines } : {}),
      };
    })
    : Promise.resolve(null);
  const transitResults = [transitResult, await secondaryTransitResult].filter((result): result is LocationContextTransit => Boolean(result));
  const hasFacts = nearby.length > 0 || transitResults.length > 0 || destinations.length > 0;
  const groceryFound = Boolean(groceryDestination);
  const groceryAttempted = nearbyResults.find((result) => result.option === "grocery")?.attempted ?? false;
  const groceryNote = lookupOptions.includes("grocery") && !groceryFound
    ? !groceryAttempted
      ? (locale === "zh" ? "中文 / 亚洲超市查询达到本次地图调用上限；普通超市不会被标注为中文超市。" : "The Chinese / Asian supermarket lookup reached this map lookup's call limit; generic supermarkets are not labeled as Chinese supermarkets.")
      : groceryPlace && !groceryRoutePlanned
        ? (locale === "zh" ? "找到了候选中文 / 亚洲超市，但本次路线预算无法确认它距房源足够近；因此没有把它显示为附近超市。" : "A candidate Chinese / Asian supermarket was found, but the route budget could not confirm that it is near the listing, so it was not shown as a nearby supermarket.")
        : groceryPlace
          ? (locale === "zh" ? "没有找到距房源约 45 分钟步行以内的可验证中文 / 亚洲超市；普通超市不会被标注为中文超市。" : "No verifiable Chinese or Asian supermarket was found within about a 45-minute walk of the listing; generic supermarkets are not labeled as Chinese supermarkets.")
      : (locale === "zh" ? "未找到可验证的中文 / 亚洲超市；普通超市不会被标注为中文超市。" : "No verifiable Chinese or Asian supermarket was found; generic supermarkets are not labeled as Chinese supermarkets.")
    : "";
  const transitNote = lookupOptions.includes("transit") && !transitResults.length
    ? region === "urban"
      ? (locale === "zh" ? "未找到可验证的附近地铁或公交站；没有用长岛铁路或其他铁路站替代。" : "No verifiable nearby subway or bus stop was returned; a commuter-rail or other rail station was not substituted.")
      : region === "longIsland"
        ? (locale === "zh" ? "未找到可验证的附近 LIRR 车站；没有把普通公共交通站点当作 LIRR。" : "No verifiable nearby LIRR station was returned; a generic transit stop was not labeled as LIRR.")
        : (locale === "zh" ? "未找到可验证的附近公共交通站点。" : "No verifiable nearby public-transit station was returned.")
    : "";
  const highwayNote = region === "longIsland" && lookupOptions.includes("transit") && !highwayPlace
    ? !highwayAttempted
      ? (locale === "zh" ? "主要高速公路查询达到本次地图调用上限；发布前请自行核实最近的高速入口。" : "The main-highway lookup reached this map lookup's call limit; verify the nearest highway entrance before publishing.")
      : (locale === "zh" ? "未找到可验证的长岛主要高速公路（优先查询 I-495）；发布前请自行核实最近的高速入口。" : "No verifiable Long Island main highway was returned (I-495 was prioritized); verify the nearest highway entrance before publishing.")
    : "";
  const contextNote = routeOrigin === "privateAddress"
    ? (locale === "zh" ? "周边和出行时间使用发布者填写的私密地址计算；精确地址不会发送给 AI 或显示在公开页面，发布前请复核。" : "Nearby facts and travel times use the poster's private address on the server; the exact address is not sent to AI or shown publicly. Review before publishing.")
    : (locale === "zh" ? "周边和目的地时间按所选大致区域估算，不代表精确房址；车程、公共交通和步行时间请发布前复核。" : "Nearby facts and destination times use the selected area, not the exact property address; driving, public-transit, and walking times are approximate. Review before publishing.");
  const checkedAt = new Date().toISOString();
  const result: LocationContext = {
    source: hasFacts ? "google" : "none",
    approximateArea: area,
    routeOrigin,
    lookupOptions,
    nearby,
    transit: transitResults,
    destinations,
    notes: [
      hasFacts
        ? contextNote
        : (locale === "zh" ? "地图服务没有返回所选类别的可用结果；AI不会补写未经验证的说法。" : "The map service returned no usable results for the selected categories; AI will not add unverified claims."),
      ...(groceryNote ? [groceryNote] : []),
      ...(transitNote ? [transitNote] : []),
      ...(highwayNote ? [highwayNote] : []),
      ...(placesQualityIssues > 0 || routesQualityIssues > 0
        ? [locale === "zh" ? "部分地图地点或路线因类别、距离或调用预算无法验证，未加入房源文案；请发布前复核。" : "Some map places or routes could not be verified because of category, distance, or call-budget checks; they were left out of the listing copy."]
        : []),
    ],
    cached: false,
    checkedAt,
    diagnostics: {
      checkedAt,
      placesAttempted: budget.placesCalls,
      routesAttempted: budget.routeCalls,
      placesQualityIssues,
      routesQualityIssues,
      rejectionReasons: rejectionReasons.slice(0, 8),
    },
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
    ...(typeof record.checkedAt === "string" ? { checkedAt: record.checkedAt } : {}),
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
    checkedAt: new Date().toISOString(),
    note,
    usage: { placesCalls: 0, routeCalls: 0, cacheHit: cached },
  });

  if (!area || !destination) return noResult(locale === "zh" ? "请填写大致区域和目的地。" : "Add an approximate area and a destination.");
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return noResult(locale === "zh" ? "服务器端地图服务尚未配置。" : "Server-side map context is not configured.");

  const queryArea = [areaEn || areaZh, boroughEn || boroughZh, "New York"].filter(Boolean).join(", ");
  const privateTarget = privateDestination(destination);
  const lookupSettings = await currentLocationLookupSettings();
  const cacheKey = JSON.stringify({
    version: 3,
    kind: "commute",
    areaEn,
    areaZh,
    boroughEn,
    boroughZh,
    destinationHash: createHash("sha256").update(destination.toLocaleLowerCase()).digest("hex").slice(0, 24),
    mode,
    locale,
    lookupSettings: { placesCallsPerLookup: lookupSettings.placesCallsPerLookup, routeCallsPerLookup: lookupSettings.routeCallsPerLookup },
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
  const budget: LocationLookupBudget = {
    placesCalls: 0,
    routeCalls: 0,
    placesLimit: lookupSettings.placesCallsPerLookup,
    routeLimit: lookupSettings.routeCallsPerLookup,
  };
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
      checkedAt: new Date().toISOString(),
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
