import test from "node:test";
import assert from "node:assert/strict";
import { savedSearchExposureIsActive } from "../app/lib/listing-exposure-policy.ts";

test("saved-search exposure requires a paid active listing add-on", () => {
  assert.equal(savedSearchExposureIsActive("listing-1", "owner-1", true), true);
  assert.equal(savedSearchExposureIsActive("listing-1", "owner-1", false), false);
  assert.equal(savedSearchExposureIsActive("", "owner-1", true), false);
  assert.equal(savedSearchExposureIsActive("listing-1", "", true), false);
});
