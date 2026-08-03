const ENGLISH_RESTRICTION = /\b(?:only|must be|no|not for)\s+(?:men|women|famil(?:y|ies)|children|kids|chinese|asians?|students?|singles?)\b/i;
const CHINESE_RESTRICTION = /(?:仅限|只限|只租|不租|拒绝|禁止).{0,8}(?:华人|中国人|男性|女性|男生|女生|小孩|儿童|家庭|学生|单身)/i;

export function hasRestrictedHousingLanguage(values: string[]) {
  const combined = values.filter(Boolean).join(" ");
  return ENGLISH_RESTRICTION.test(combined) || CHINESE_RESTRICTION.test(combined);
}

export function listingSafetyError(values: string[]) {
  return hasRestrictedHousingLanguage(values)
    ? "Remove housing restrictions based on protected traits before publishing."
    : "";
}
