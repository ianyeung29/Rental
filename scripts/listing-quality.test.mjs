import assert from "node:assert/strict";
import test from "node:test";

import { analyzeListingQuality, duplicateMediaCount } from "../app/lib/listing-quality.ts";

const completeListing = {
  titleZh: "森林小丘采光两居",
  areaZh: "皇后区 · 森林小丘",
  privateAddress: "123 Example Street, Forest Hills, NY 11375",
  price: "2400",
  moveInMode: "immediate",
  features: ["furnished", "laundry", "nearTransit"],
  squareFeet: "850",
  descriptionZh: "客厅采光好，两个卧室布局清楚，配有家具和楼内洗衣房。房源距离公交站步行约五分钟，附近有超市和日常餐饮。厨房和客厅保持整洁，租期为十二个月，具体费用包含内容会在看房和签约前再次确认。发布者可以在咨询后安排合适的看房时间。",
  contactName: "Ian",
  contactEmail: "ian@example.com",
  media: [
    { key: "listings/one.jpg", fingerprint: "one" },
    { key: "listings/two.jpg", fingerprint: "two" },
  ],
  comparablePrices: [2200, 2400, 2600],
};

test("quality assistant accepts a complete listing", () => {
  const result = analyzeListingQuality(completeListing);
  assert.equal(result.attentionCount, 0);
  assert.equal(result.score, 100);
  assert.equal(result.duplicatePhotoCount, 0);
});

test("quality assistant identifies missing fields and unclear copy", () => {
  const result = analyzeListingQuality({ titleZh: "好", descriptionZh: "介绍采光、布局、交通、费用包含内容和其他真实情况", media: [] });
  const keys = result.checks.filter((check) => !check.done).map((check) => check.key);
  assert.ok(keys.includes("title"));
  assert.ok(keys.includes("area"));
  assert.ok(keys.includes("privateAddress"));
  assert.ok(keys.includes("description"));
  assert.ok(keys.includes("descriptionClarity"));
  assert.ok(keys.includes("photos"));
  assert.ok(result.score < 60);
});

test("quality assistant flags suspicious rent only with enough comparisons", () => {
  const result = analyzeListingQuality({ ...completeListing, price: "5200", comparablePrices: [2200, 2400, 2600] });
  const check = result.checks.find((item) => item.key === "priceReview");
  assert.equal(check?.done, false);
  assert.equal(check?.severity, "review");
  const insufficient = analyzeListingQuality({ ...completeListing, price: "5200", comparablePrices: [2400, 2600] });
  assert.equal(insufficient.checks.find((item) => item.key === "priceReview")?.done, true);
});

test("duplicate photo detection uses fingerprints before upload keys", () => {
  assert.equal(duplicateMediaCount([
    { key: "listings/one-a.jpg", fingerprint: "same" },
    { key: "listings/one-b.jpg", fingerprint: "same" },
    { key: "listings/two.jpg", fingerprint: "different" },
  ]), 1);
});
