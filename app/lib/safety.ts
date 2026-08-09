const ENGLISH_RESTRICTION = /\b(?:only|must be|no|not for)\s+(?:men|women|famil(?:y|ies)|children|kids|chinese|asians?|students?|singles?)\b/i;
const CHINESE_RESTRICTION = /(?:仅限|只限|只租|不租|拒绝|禁止).{0,8}(?:华人|中国人|男性|女性|男生|女生|小孩|儿童|家庭|学生|单身)/i;
const PUBLIC_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PUBLIC_PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/;
const PUBLIC_WECHAT = /(?:微信(?:号|联系|沟通)|加(?:我)?微信|wechat\s*(?:id|:|：)?\s*[a-z0-9_-]{3,})/i;
const PAYMENT_BEFORE_TOUR = /(?:before|prior to|without)\s+(?:a\s+)?(?:tour|viewing|showing|signed lease|lease).{0,80}(?:deposit|security deposit|cash|wire|zelle|venmo|paypal|crypto|bitcoin)/i;
const PAYMENT_AFTER_TERM = /(?:deposit|security deposit|cash|wire|zelle|venmo|paypal|crypto|bitcoin).{0,80}(?:before|prior to|without)\s+(?:a\s+)?(?:tour|viewing|showing|signed lease|lease)/i;
const CHINESE_PAYMENT_PRESSURE = /(?:看房前|签约前|签合同前|先(?:交|付|转)|未看房).{0,80}(?:押金|订金|定金|现金|转账|支付宝|微信)/;

export type ListingSafetyIssue = {
  key: "restrictedHousing" | "publicContact" | "paymentPressure";
  severity: "block" | "warning";
  titleZh: string;
  titleEn: string;
  detailZh: string;
  detailEn: string;
};

export type ListingSafetyReview = {
  blocking: ListingSafetyIssue[];
  warnings: ListingSafetyIssue[];
};

export type ListingSafetyInput = {
  titleZh?: string;
  titleEn?: string;
  descriptionZh?: string;
  descriptionEn?: string;
};

function combinedPublicText(input: ListingSafetyInput) {
  return [input.titleZh, input.titleEn, input.descriptionZh, input.descriptionEn].filter(Boolean).join(" ");
}

const RESTRICTED_HOUSING_ISSUE: ListingSafetyIssue = {
  key: "restrictedHousing",
  severity: "block",
  titleZh: "住房条件不能基于受保护特征",
  titleEn: "Housing restrictions need to be removed",
  detailZh: "请删除按性别、家庭状况、儿童或族裔等条件筛选或拒绝租客的内容后再发布。",
  detailEn: "Remove screening or refusal language based on sex, family status, children, or race/ethnicity before publishing.",
};

const PUBLIC_CONTACT_ISSUE: ListingSafetyIssue = {
  key: "publicContact",
  severity: "block",
  titleZh: "请把个人联系方式留在私密字段",
  titleEn: "Keep personal contact details out of the public description",
  detailZh: "公开介绍里检测到邮箱、电话或微信联系方式。请删除后再发布；平台会使用私密联系人字段支持咨询。",
  detailEn: "An email, phone number, or WeChat contact was found in the public copy. Remove it before publishing; inquiries use the private contact fields.",
};

const PAYMENT_PRESSURE_ISSUE: ListingSafetyIssue = {
  key: "paymentPressure",
  severity: "warning",
  titleZh: "请复核付款说明",
  titleEn: "Review the payment language",
  detailZh: "不要要求租客在看房或签署书面租约前支付押金、现金或转账。请确认这段文字不会造成误解。",
  detailEn: "Do not ask renters for a deposit, cash, or transfer before a tour or written lease. Confirm this wording cannot be misunderstood.",
};

export function hasRestrictedHousingLanguage(values: string[]) {
  const combined = values.filter(Boolean).join(" ");
  return ENGLISH_RESTRICTION.test(combined) || CHINESE_RESTRICTION.test(combined);
}

export function reviewListingSafety(input: ListingSafetyInput): ListingSafetyReview {
  const combined = combinedPublicText(input);
  const issues: ListingSafetyIssue[] = [];
  if (hasRestrictedHousingLanguage([combined])) issues.push(RESTRICTED_HOUSING_ISSUE);
  if (PUBLIC_EMAIL.test(combined) || PUBLIC_PHONE.test(combined) || PUBLIC_WECHAT.test(combined)) issues.push(PUBLIC_CONTACT_ISSUE);
  if (PAYMENT_BEFORE_TOUR.test(combined) || PAYMENT_AFTER_TERM.test(combined) || CHINESE_PAYMENT_PRESSURE.test(combined)) issues.push(PAYMENT_PRESSURE_ISSUE);
  return {
    blocking: issues.filter((issue) => issue.severity === "block"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}

export function listingSafetyError(values: string[]) {
  const review = reviewListingSafety({ titleZh: values.join(" ") });
  return review.blocking[0]?.detailEn || "";
}
