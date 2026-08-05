const LOCATION_LABELS = [
  ["Long Island City", "长岛市"],
  ["New York City", "纽约市"],
  ["North York", "北约克"],
  ["Jersey City", "泽西市"],
  ["Forest Hills", "森林小丘"],
  ["Sunset Park", "日落公园"],
  ["Willowdale", "柳树谷"],
  ["Upstate New York", "纽约上州"],
  ["Nassau County", "拿骚县"],
  ["Suffolk County", "萨福克县"],
  ["Staten Island", "史泰登岛"],
  ["Manhattan", "曼哈顿"],
  ["Brooklyn", "布鲁克林"],
  ["Queens", "皇后区"],
  ["The Bronx", "布朗克斯"],
  ["Bronx", "布朗克斯"],
  ["Long Island", "长岛"],
  ["Flushing", "法拉盛"],
  ["Great Neck", "大颈"],
  ["Jericho", "杰里科"],
  ["Albany", "奥尔巴尼"],
  ["Heights", "高地"],
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toChineseLocationLabel(value: string) {
  return LOCATION_LABELS.reduce(
    (label, [english, chinese]) => label.replace(new RegExp(escapeRegExp(english), "gi"), chinese),
    value,
  );
}
