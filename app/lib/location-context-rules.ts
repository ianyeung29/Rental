export type LocationRuleTransitLine = {
  vehicleType?: string;
};

export type LocationRulePlace = {
  id?: string;
  name: string;
  primaryType?: string;
  types?: string[];
  transitLines?: LocationRuleTransitLine[];
};

export type TransitRegion = "urban" | "longIsland" | "general";
export type UrbanTransitKind = "subway" | "bus" | "both" | null;

// A result called "nearby" should remain useful to a renter. Anything beyond
// this walking time is treated as an area-level result, not a nearby stop or
// supermarket. This also protects the UI from malformed route durations.
export const MAX_NEARBY_WALK_MINUTES = 45;

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
  "walfood",
  "go fresh 365",
  "gofresh365",
  "jmart",
];

const LONG_ISLAND_HIGHWAY_MARKERS = [
  "long island expressway",
  "i-495",
  "interstate 495",
  "northern state parkway",
  "southern state parkway",
  "cross island parkway",
  "meadowbrook state parkway",
  "wantagh state parkway",
];

function normalizedText(value: string) {
  return value.toLocaleLowerCase();
}

export function placeNameKey(value: string) {
  return normalizedText(value).normalize("NFKC").replace(/[\s\-_.\,/()'&]+/g, "");
}

export function isChineseOrAsianMarket(place: LocationRulePlace) {
  const name = normalizedText(place.name);
  const normalizedName = placeNameKey(place.name);
  const hasCjkMarketMarker = /\u534e\u8054|\u534e\u4eba|\u4e9a\u6d32|\u9999\u6e2f|\u5927\u534e|\u6c38\u548c|\u7f8e\u4e1c|\u91d1\u95e8|\u4e2d\u56fd\u8d85\u5e02|\u4e9a\u6d32\u8d85\u5e02/.test(place.name);
  return hasCjkMarketMarker || ASIAN_MARKET_NAME_MARKERS.some((marker) => name.includes(marker) || normalizedName.includes(placeNameKey(marker)));
}

export function uniqueNamedPlaces<T extends { name: string }>(places: T[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = placeNameKey(place.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function uniquePlaces<T extends LocationRulePlace>(places: T[]) {
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

export function transitRegion(areaEn: string, areaZh: string, boroughEn: string, boroughZh: string): TransitRegion {
  const values = [boroughEn, boroughZh, areaEn, areaZh].join(" ").toLocaleLowerCase();
  if (values.includes("long island city") || values.includes("\u957f\u5c9b\u5e02")) return "urban";
  if (values.includes("long island") || values.includes("\u957f\u5c9b") || values.includes("nassau") || values.includes("\u62ff\u9a9a") || values.includes("suffolk") || values.includes("\u8428\u798f\u514b") || values.includes("jericho") || values.includes("\u6770\u91cc\u79d1") || values.includes("syosset") || values.includes("\u8d5b\u5965\u585e\u7279") || values.includes("hicksville") || values.includes("\u5e0c\u514b\u65af\u7ef4\u5c14") || values.includes("plainview") || values.includes("\u666e\u83b1\u6069\u7ef4\u5c14") || values.includes("east meadow") || values.includes("\u4e1c\u8349\u539f")) return "longIsland";
  if (values.includes("queens") || values.includes("\u7687\u540e") || values.includes("brooklyn") || values.includes("\u5e03\u9c81\u514b\u6797")) return "urban";
  return "general";
}

export function transitLineTypes(place: LocationRulePlace) {
  return new Set((place.transitLines || []).map((line) => line.vehicleType).filter((value): value is string => Boolean(value)).map((value) => value.toLocaleUpperCase()));
}

export function hasUrbanTransitLine(place: LocationRulePlace) {
  const lineTypes = transitLineTypes(place);
  return lineTypes.has("SUBWAY") || lineTypes.has("METRO_RAIL") || lineTypes.has("BUS") || lineTypes.has("INTERCITY_BUS") || lineTypes.has("TROLLEYBUS") || (place.types || []).includes("bus_station") || (place.types || []).includes("subway_station");
}

export function hasRailTransitLine(place: LocationRulePlace) {
  const lineTypes = transitLineTypes(place);
  return lineTypes.has("TRAIN") || lineTypes.has("RAIL") || lineTypes.has("HEAVY_RAIL") || lineTypes.has("COMMUTER_TRAIN") || (place.types || []).includes("train_station");
}

export function urbanTransitKind(place: LocationRulePlace): UrbanTransitKind {
  const lineTypes = transitLineTypes(place);
  const hasSubway = lineTypes.has("SUBWAY") || lineTypes.has("METRO_RAIL") || (place.types || []).includes("subway_station");
  const hasBus = lineTypes.has("BUS") || lineTypes.has("INTERCITY_BUS") || lineTypes.has("TROLLEYBUS") || (place.types || []).includes("bus_station");
  return hasSubway && hasBus ? "both" : hasSubway ? "subway" : hasBus ? "bus" : null;
}

export function isAcceptableNearbyWalkMinutes(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_NEARBY_WALK_MINUTES;
}

function samePlace(left: LocationRulePlace, right: LocationRulePlace) {
  return Boolean((left.id && right.id && left.id === right.id) || placeNameKey(left.name) === placeNameKey(right.name));
}

export function selectUrbanTransitPlaces<T extends LocationRulePlace>(places: T[]) {
  const candidates = uniquePlaces(places).filter(hasUrbanTransitLine);
  // Buses are usually the most local option in Queens and Brooklyn. Prefer a
  // bus stop first, then add a subway station only when it is a distinct result.
  const bus = candidates.find((place) => urbanTransitKind(place) === "bus" || urbanTransitKind(place) === "both");
  const subway = candidates.find((place) => (urbanTransitKind(place) === "subway" || urbanTransitKind(place) === "both") && (!bus || !samePlace(place, bus)));
  return [bus, subway].filter((place, index, selected): place is T => Boolean(place) && selected.findIndex((candidate) => candidate && samePlace(candidate, place as T)) === index);
}

export function isLongIslandHighway(place: LocationRulePlace) {
  const searchable = `${place.name} ${place.primaryType || ""} ${(place.types || []).join(" ")}`.toLocaleLowerCase();
  return LONG_ISLAND_HIGHWAY_MARKERS.some((marker) => searchable.includes(marker));
}
