export type ListingQualitySeverity = "required" | "recommended" | "review";

export type ListingQualityTarget = {
  step: 1 | 2 | 3;
  id: string;
};

export type ListingQualityCheck = {
  key: string;
  done: boolean;
  severity: ListingQualitySeverity;
  weight: number;
  zh: string;
  en: string;
  detailZh: string;
  detailEn: string;
  actionZh: string;
  actionEn: string;
  target?: ListingQualityTarget;
};

export type ListingQualityMedia = {
  key?: string;
  url?: string;
  publicUrl?: string;
  fingerprint?: string;
};

export type ListingQualityInput = {
  titleZh?: string;
  titleEn?: string;
  areaZh?: string;
  areaEn?: string;
  privateAddress?: string;
  price?: string | number | null;
  moveInMode?: string;
  moveInDate?: string;
  features?: string[];
  squareFeet?: string | number | null;
  descriptionZh?: string;
  descriptionEn?: string;
  contactName?: string;
  contactEmail?: string;
  media?: ListingQualityMedia[];
  comparablePrices?: number[];
};

export type ListingQualityResult = {
  score: number;
  checks: ListingQualityCheck[];
  attentionCount: number;
  comparableCount: number;
  medianPrice: number;
  duplicatePhotoCount: number;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function meaningfulLength(value: string) {
  return value.replace(/[\s\u200b]+/g, "").length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function hasSentencePunctuation(value: string) {
  return /[.!?。！？；;]/.test(value);
}

function hasRepeatedPhrase(value: string) {
  const normalized = value.replace(/[\s\u200b]+/g, "");
  if (normalized.length < 24) return false;
  return /(.{8,})\1/.test(normalized);
}

function looksLikePlaceholder(value: string) {
  const normalized = value.replace(/[\s\u200b]+/g, "").toLocaleLowerCase();
  return [
    "介绍采光布局交通费用包含内容和其他真实情况",
    "介绍采光、布局、交通、费用包含内容和其他真实情况",
    "describepropertydetails",
    "addyourdescription",
  ].some((placeholder) => normalized === placeholder || normalized.includes(placeholder));
}

function mediaIdentity(media: ListingQualityMedia) {
  return text(media.fingerprint) || text(media.key) || text(media.publicUrl) || text(media.url);
}

export function duplicateMediaCount(media: ListingQualityMedia[] = []) {
  const counts = new Map<string, number>();
  media.map(mediaIdentity).filter(Boolean).forEach((identity) => counts.set(identity, (counts.get(identity) || 0) + 1));
  return [...counts.values()].filter((count) => count > 1).reduce((total, count) => total + count - 1, 0);
}

export function analyzeListingQuality(input: ListingQualityInput): ListingQualityResult {
  const title = text(input.titleZh) || text(input.titleEn);
  const area = text(input.areaZh) || text(input.areaEn);
  const privateAddress = text(input.privateAddress);
  const price = Number(input.price);
  const moveInMode = text(input.moveInMode);
  const moveInDate = text(input.moveInDate);
  const features = Array.isArray(input.features) ? input.features.filter((feature) => typeof feature === "string" && feature.trim()) : [];
  const squareFeet = input.squareFeet === null || input.squareFeet === undefined || input.squareFeet === "" ? 0 : Number(input.squareFeet);
  const description = [text(input.descriptionZh), text(input.descriptionEn)].filter(Boolean).join(" ");
  const descriptionLength = meaningfulLength(description);
  const contactComplete = Boolean(text(input.contactName) && text(input.contactEmail).includes("@"));
  const media = Array.isArray(input.media) ? input.media : [];
  const duplicatePhotoCount = duplicateMediaCount(media);
  const comparablePrices = (Array.isArray(input.comparablePrices) ? input.comparablePrices : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const medianPrice = median(comparablePrices);
  const priceRatio = price > 0 && medianPrice > 0 ? price / medianPrice : 0;
  const priceLooksSuspicious = comparablePrices.length >= 3 && (priceRatio < 0.55 || priceRatio > 1.75);
  const checks: ListingQualityCheck[] = [];

  const add = (check: ListingQualityCheck) => checks.push(check);

  add({
    key: "title",
    done: meaningfulLength(title) >= 4,
    severity: title ? "recommended" : "required",
    weight: 10,
    zh: "标题清楚",
    en: "Clear title",
    detailZh: title ? "标题信息太少，建议写明户型、位置或最重要的居住特点。" : "请先填写房源标题。",
    detailEn: title ? "The title is very short. Add the home type, area, or most useful living detail." : "Add a listing title first.",
    actionZh: "编辑标题",
    actionEn: "Edit title",
    target: { step: 1, id: "post-title-zh" },
  });
  add({
    key: "area",
    done: Boolean(area),
    severity: "required",
    weight: 10,
    zh: "公开区域",
    en: "Public area",
    detailZh: "公开区域用于搜索和附近参考；精确地址仍会保持私密。",
    detailEn: "The public area powers search and nearby context; the exact address stays private.",
    actionZh: "补充区域",
    actionEn: "Add area",
    target: { step: 1, id: "post-area-zh" },
  });
  add({
    key: "privateAddress",
    done: Boolean(privateAddress),
    severity: "required",
    weight: 12,
    zh: "私密完整地址",
    en: "Private exact address",
    detailZh: "完整地址只用于服务器端路线和看房流程，不会公开显示。",
    detailEn: "The full address is used for server-side routes and tours; it is not shown publicly.",
    actionZh: "补充私密地址",
    actionEn: "Add private address",
    target: { step: 1, id: "post-private-address" },
  });
  add({
    key: "price",
    done: Number.isFinite(price) && price > 0,
    severity: "required",
    weight: 12,
    zh: "月租金额",
    en: "Monthly rent",
    detailZh: "请填写有效的美元月租，方便租客比较房源。",
    detailEn: "Add a valid monthly USD rent so renters can compare listings.",
    actionZh: "补充租金",
    actionEn: "Add rent",
    target: { step: 1, id: "post-price" },
  });
  add({
    key: "moveIn",
    done: moveInMode === "immediate" || Boolean(moveInDate),
    severity: "required",
    weight: 8,
    zh: "入住时间",
    en: "Move-in timing",
    detailZh: "选择立即入住或填写具体日期。",
    detailEn: "Choose immediate move-in or provide a specific date.",
    actionZh: "补充入住时间",
    actionEn: "Add move-in timing",
    target: { step: 1, id: "post-move-in-mode" },
  });
  add({
    key: "contact",
    done: contactComplete,
    severity: "required",
    weight: 8,
    zh: "联系人信息",
    en: "Contact details",
    detailZh: "发布前需要联系人姓名和有效邮箱，方便租客发送咨询。",
    detailEn: "Add a contact name and valid email so renters can send an inquiry.",
    actionZh: "补充联系人",
    actionEn: "Add contact",
    target: { step: 3, id: "post-contact-name" },
  });
  add({
    key: "photos",
    done: media.length >= 2,
    severity: media.length === 0 ? "required" : "recommended",
    weight: 10,
    zh: "至少两张照片",
    en: "At least two photos",
    detailZh: media.length === 0 ? "至少上传一张照片才能发布；两张以上更方便租客判断布局。" : "建议补充第二张照片，让租客更容易判断空间和采光。",
    detailEn: media.length === 0 ? "At least one photo is needed to publish; two or more help renters judge the space." : "Add a second photo so renters can better understand the space and light.",
    actionZh: "管理照片",
    actionEn: "Manage photos",
    target: { step: 2, id: "post-photos" },
  });
  add({
    key: "features",
    done: features.length >= 3,
    severity: "recommended",
    weight: 7,
    zh: "三个以上特点",
    en: "Three or more features",
    detailZh: "补充家具、洗衣、停车、宠物等真实特点，帮助租客快速筛选。",
    detailEn: "Add real features such as furnishing, laundry, parking, or pet rules for faster filtering.",
    actionZh: "选择特点",
    actionEn: "Choose features",
    target: { step: 2, id: "post-features" },
  });
  add({
    key: "description",
    done: descriptionLength >= 80 && !looksLikePlaceholder(description),
    severity: "recommended",
    weight: 15,
    zh: "详细介绍",
    en: "Detailed description",
    detailZh: descriptionLength === 0 ? "写明采光、布局、交通、费用包含内容和其他真实情况。" : "介绍目前偏短或仍像占位提示；请加入房屋事实和费用说明。",
    detailEn: descriptionLength === 0 ? "Describe light, layout, transport, included costs, and other factual details." : "The description is short or still looks like placeholder copy; add facts and fee details.",
    actionZh: "编辑介绍",
    actionEn: "Edit description",
    target: { step: 2, id: "post-description-zh" },
  });
  add({
    key: "descriptionClarity",
    done: descriptionLength >= 100 && hasSentencePunctuation(description) && !hasRepeatedPhrase(description),
    severity: "recommended",
    weight: 9,
    zh: "描述清晰易读",
    en: "Clear, readable description",
    detailZh: hasRepeatedPhrase(description) ? "发现重复句段，请删除重复内容并保留最准确的一版。" : "建议使用完整句子，并补充可核对的具体信息。",
    detailEn: hasRepeatedPhrase(description) ? "A repeated phrase was detected. Keep the clearest, most accurate version once." : "Use complete sentences and add concrete details that can be checked.",
    actionZh: "优化介绍",
    actionEn: "Improve description",
    target: { step: 2, id: "post-description-zh" },
  });
  add({
    key: "size",
    done: Number.isInteger(squareFeet) && squareFeet >= 50,
    severity: "recommended",
    weight: 6,
    zh: "标注建筑面积",
    en: "Square footage included",
    detailZh: "建筑面积是可选项，但填写后租客更容易判断空间大小。",
    detailEn: "Square footage is optional, but it gives renters a clearer sense of space.",
    actionZh: "补充面积",
    actionEn: "Add square footage",
    target: { step: 1, id: "post-square-feet" },
  });
  add({
    key: "duplicatePhotos",
    done: duplicatePhotoCount === 0,
    severity: "review",
    weight: 5,
    zh: "照片没有重复",
    en: "No duplicate photos",
    detailZh: duplicatePhotoCount > 0 ? `发现 ${duplicatePhotoCount} 张重复照片，请删除重复项或换成不同角度。` : "每张照片都有不同的上传内容或地址。",
    detailEn: duplicatePhotoCount > 0 ? `${duplicatePhotoCount} duplicate photo(s) were detected. Remove them or use another angle.` : "Each photo has a different upload identity or URL.",
    actionZh: "检查照片",
    actionEn: "Check photos",
    target: { step: 2, id: "post-photos" },
  });
  add({
    key: "priceReview",
    done: !priceLooksSuspicious,
    severity: "review",
    weight: 6,
    zh: "租金与附近房源相符",
    en: "Rent is in the local range",
    detailZh: priceLooksSuspicious
      ? `当前月租约为已加载的 ${comparablePrices.length} 套同区域参考中位数的 ${Math.round(priceRatio * 100)}%；请确认数字、单位和费用说明。`
      : comparablePrices.length >= 3
        ? `已与 ${comparablePrices.length} 套同区域、同卧室参考房源比较。`
        : "附近可比房源不足，暂时只确认租金已填写；请人工复核。",
    detailEn: priceLooksSuspicious
      ? `The rent is ${Math.round(priceRatio * 100)}% of the median across ${comparablePrices.length} loaded local comparisons. Confirm the number, unit, and fee notes.`
      : comparablePrices.length >= 3
        ? `Compared with ${comparablePrices.length} loaded listings in the same area and bedroom count.`
        : "There are not enough local comparisons; only the entered rent was checked. Review it manually.",
    actionZh: "复核租金",
    actionEn: "Review rent",
    target: { step: 1, id: "post-price" },
  });

  const totalWeight = checks.reduce((total, check) => total + check.weight, 0);
  const earnedWeight = checks.filter((check) => check.done).reduce((total, check) => total + check.weight, 0);
  return {
    score: Math.round((earnedWeight / totalWeight) * 100),
    checks,
    attentionCount: checks.filter((check) => !check.done).length,
    comparableCount: comparablePrices.length,
    medianPrice,
    duplicatePhotoCount,
  };
}
