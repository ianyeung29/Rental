import assert from "node:assert/strict";
import test from "node:test";
import { adminRecipientsExcludingPoster } from "../app/lib/email.ts";

test("new listing notifications exclude the posting admin and de-duplicate recipients", () => {
  assert.deepEqual(
    adminRecipientsExcludingPoster(
      ["ADMIN@anjurentals.com", "ops@anjurentals.com", "ops@anjurentals.com", "invalid.invalid"],
      " admin@anjurentals.com ",
    ),
    ["ops@anjurentals.com"],
  );
});

test("new listing notifications preserve distinct admins when the publisher is not an admin recipient", () => {
  assert.deepEqual(
    adminRecipientsExcludingPoster(["admin@anjurentals.com", "ops@anjurentals.com"], "owner@example.com"),
    ["admin@anjurentals.com", "ops@anjurentals.com"],
  );
});
