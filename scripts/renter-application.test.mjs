import test from "node:test";
import assert from "node:assert/strict";
import { applicationFieldsForSharing, DEFAULT_RENTER_PROFILE_SHARING, normalizeRenterProfileSharing } from "../app/lib/renter-application.ts";

test("renter sharing defaults keep optional fields private", () => {
  assert.deepEqual(normalizeRenterProfileSharing(undefined), DEFAULT_RENTER_PROFILE_SHARING);
  assert.deepEqual(applicationFieldsForSharing({ currentCity: "Queens", employmentStatus: "employed", incomeRange: "6000plus" }, DEFAULT_RENTER_PROFILE_SHARING), {
    currentCity: "",
    employmentStatus: "",
    incomeRange: "",
  });
});

test("renter sharing sends only selected optional fields", () => {
  const sharing = normalizeRenterProfileSharing({ shareCurrentCity: true, shareEmployment: "true", shareIncome: false });
  assert.deepEqual(applicationFieldsForSharing({ currentCity: "  Flushing  ", employmentStatus: "employed", incomeRange: "6000plus" }, sharing), {
    currentCity: "Flushing",
    employmentStatus: "employed",
    incomeRange: "",
  });
});
