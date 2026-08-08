export type DefaultLocationLookupSettings = {
  placesCallsPerLookup: number;
  routeCallsPerLookup: number;
};

export const DEFAULT_LOCATION_LOOKUP_SETTINGS: DefaultLocationLookupSettings = {
  placesCallsPerLookup: 5,
  routeCallsPerLookup: 5,
};

export const LOCATION_LOOKUP_LIMITS = {
  minPlacesCallsPerLookup: 1,
  maxPlacesCallsPerLookup: 10,
  minRouteCallsPerLookup: 1,
  maxRouteCallsPerLookup: 10,
} as const;
