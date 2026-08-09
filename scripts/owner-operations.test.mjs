import test from "node:test";
import assert from "node:assert/strict";
import { listingNeedsAvailabilityConfirmation, normalizeReplyTemplateInput, personalizeReply } from "../app/lib/owner-operations.ts";

test("owner availability becomes stale after the confirmation window", () => {
  const now = new Date("2026-08-08T12:00:00.000Z");
  assert.equal(listingNeedsAvailabilityConfirmation({ status: "published", availabilityAnchor: "2026-07-24T11:59:59.000Z", now }), true);
  assert.equal(listingNeedsAvailabilityConfirmation({ status: "published", availabilityAnchor: "2026-07-30T12:00:00.000Z", now }), false);
  assert.equal(listingNeedsAvailabilityConfirmation({ status: "paused", availabilityAnchor: "2026-07-01T12:00:00.000Z", now }), false);
});

test("reply templates use safe fallback values and keep both locales usable", () => {
  const normalized = normalizeReplyTemplateInput({ titleZh: "  看房  ", bodyZh: "  你好 {{renter}}  " });
  assert.deepEqual(normalized, { titleZh: "看房", titleEn: "看房", bodyZh: "你好 {{renter}}", bodyEn: "你好 {{renter}}" });
  assert.equal(personalizeReply("Hi {{renter}} — {{listing}}", { renter: "Ian", listing: "Forest Hills room" }), "Hi Ian — Forest Hills room");
  assert.equal(personalizeReply("Hi {{renter}}", {}), "Hi there");
});
