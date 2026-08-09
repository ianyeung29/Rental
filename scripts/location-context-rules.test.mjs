import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCATION_LOOKUP_SETTINGS,
  LOCATION_LOOKUP_LIMITS,
} from "../app/lib/location-lookup-settings.ts";
import {
  isAcceptableNearbyWalkMinutes,
  isChineseOrAsianMarket,
  selectSupermarketCandidate,
  selectUrbanTransitPlaces,
  transitRegion,
  uniqueNamedPlaces,
  urbanTransitKind,
} from "../app/lib/location-context-rules.ts";

test("map lookup defaults keep the configured 5 Places / 5 Routes budget", () => {
  assert.equal(DEFAULT_LOCATION_LOOKUP_SETTINGS.placesCallsPerLookup, 5);
  assert.equal(DEFAULT_LOCATION_LOOKUP_SETTINGS.routeCallsPerLookup, 5);
  assert.equal(LOCATION_LOOKUP_LIMITS.maxPlacesCallsPerLookup, 10);
  assert.equal(LOCATION_LOOKUP_LIMITS.maxRouteCallsPerLookup, 10);
});

const place = (overrides = {}) => ({
  id: "place-id",
  name: "Example stop",
  types: ["transit_station"],
  transitLines: [],
  ...overrides,
});

test("urban transit selection puts the nearby bus result before subway and rejects LIRR-only results", () => {
  const lirrOnly = place({
    id: "lirr",
    name: "Queens Village",
    types: ["train_station"],
    transitLines: [{ vehicleType: "TRAIN" }],
  });
  const subway = place({
    id: "subway",
    name: "Flushing-Main St",
    types: ["subway_station"],
    transitLines: [{ vehicleType: "SUBWAY" }],
  });
  const bus = place({
    id: "bus",
    name: "Main Street / Roosevelt Avenue",
    types: ["bus_station"],
    transitLines: [{ vehicleType: "BUS" }],
  });

  const selected = selectUrbanTransitPlaces([lirrOnly, subway, bus]);
  assert.deepEqual(selected.map((item) => item.name), ["Main Street / Roosevelt Avenue", "Flushing-Main St"]);
  assert.equal(urbanTransitKind(lirrOnly), null);
  assert.equal(urbanTransitKind(subway), "subway");
  assert.equal(urbanTransitKind(bus), "bus");
});

test("nearby walking guard rejects implausibly distant route results", () => {
  assert.equal(isAcceptableNearbyWalkMinutes(25), true);
  assert.equal(isAcceptableNearbyWalkMinutes(45), true);
  assert.equal(isAcceptableNearbyWalkMinutes(46), false);
  assert.equal(isAcceptableNearbyWalkMinutes(17374), false);
});

test("Chinese supermarket matching recognizes WalFood and removes duplicate place names", () => {
  const walfood = place({ id: "walfood", name: "WalFood Market" });
  assert.equal(isChineseOrAsianMarket(walfood), true);

  const unique = uniqueNamedPlaces([
    { name: "Foodtown of Bayside", category: "Chinese / Asian supermarket" },
    { name: "Foodtown of Bayside", category: "Chinese / Asian supermarket" },
    { name: "WalFood Market", category: "Chinese / Asian supermarket" },
  ]);
  assert.deepEqual(unique.map((item) => item.name), ["Foodtown of Bayside", "WalFood Market"]);
});

test("supermarket lookup prefers Asian matches and labels a generic fallback honestly", () => {
  const generic = place({ id: "generic", name: "Foodtown of Bayside", types: ["supermarket"] });
  const asian = place({ id: "asian", name: "H Mart", types: ["supermarket"] });
  assert.equal(selectSupermarketCandidate([generic])?.classification, "regular");
  assert.equal(selectSupermarketCandidate([generic, asian])?.place.name, "H Mart");
  assert.equal(selectSupermarketCandidate([generic, asian])?.classification, "asian");
});

test("Long Island aliases select the Long Island transit policy", () => {
  assert.equal(transitRegion("Jericho", "杰里科", "Long Island", "长岛"), "longIsland");
  assert.equal(transitRegion("Long Island City", "长岛市", "Queens", "皇后区"), "urban");
  assert.equal(transitRegion("Forest Hills", "森林小丘", "Queens", "皇后区"), "urban");
});
