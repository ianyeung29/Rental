export type AreaGuideHighlight = {
  labelZh: string;
  labelEn: string;
  detailZh: string;
  detailEn: string;
};

export type AreaGuideSchoolReference = {
  titleZh: string;
  titleEn: string;
  detailZh: string;
  detailEn: string;
  linkZh: string;
  linkEn: string;
  href: string;
};

export type AreaGuide = {
  id: string;
  aliases: readonly string[];
  titleZh: string;
  titleEn: string;
  regionZh: string;
  regionEn: string;
  summaryZh: string;
  summaryEn: string;
  highlights: readonly AreaGuideHighlight[];
  schoolReference: AreaGuideSchoolReference;
};

const NYC_SCHOOL_REFERENCE: AreaGuideSchoolReference = {
  titleZh: "纽约市官方学校目录",
  titleEn: "NYC public school directory",
  detailZh: "可使用 NYC Public Schools 的官方搜索工具查看学校和项目。学校范围、入读资格和名额要用精确地址、年级和当年政策核实。",
  detailEn: "Use the NYC Public Schools directory to review schools and programs. Confirm school assignment, eligibility, and availability with the exact address, grade, and current rules.",
  linkZh: "打开 NYC 官方学校搜索",
  linkEn: "Open NYC official school search",
  href: "https://www.schools.nyc.gov/find-a-school",
};

const NEW_YORK_STATE_SCHOOL_REFERENCE: AreaGuideSchoolReference = {
  titleZh: "纽约州官方学校目录",
  titleEn: "New York State school directory",
  detailZh: "纽约州教育厅提供学校和学区目录。不同城镇的入读规则不同，请直接向相关学区核实精确地址对应的学校、年级和资格。",
  detailEn: "The New York State Education Department provides school and district directories. Enrollment rules vary by town, so confirm the exact address, grade, and eligibility with the relevant district.",
  linkZh: "打开 NYSED 学校参考",
  linkEn: "Open NYSED school reference",
  href: "https://www.nysed.gov/schools-in-nys",
};

const NYC_GENERAL_HIGHLIGHTS: readonly AreaGuideHighlight[] = [
  { labelZh: "生活配套", labelEn: "Daily life", detailZh: "餐饮、零售、公共设施和公园的组合会随街区变化。", detailEn: "The mix of dining, retail, public facilities, and parks changes from one neighborhood to the next." },
  { labelZh: "交通", labelEn: "Transportation", detailZh: "公共交通和道路选择要按房源大致区域与目标地点逐一核实。", detailEn: "Check public transit and road options from the approximate area to the destination you care about." },
  { labelZh: "看房提醒", labelEn: "Before a tour", detailZh: "公开位置是大致区域，不代表到某家店、车站或学校的固定距离。", detailEn: "The public location is approximate; it does not promise a fixed distance to a store, station, or school." },
];

const NYS_GENERAL_HIGHLIGHTS: readonly AreaGuideHighlight[] = [
  { labelZh: "社区节奏", labelEn: "Neighborhood pattern", detailZh: "城市、郊区和大学城之间差异较大，日常配套应按具体城镇查看。", detailEn: "Cities, suburbs, and college towns can feel very different; check daily amenities for the specific town." },
  { labelZh: "交通", labelEn: "Transportation", detailZh: "通勤方式可能依赖驾车、公交或火车；请用目标地点估算路线。", detailEn: "Commutes may depend on driving, bus, or rail; estimate a route to the destination that matters to you." },
  { labelZh: "看房提醒", labelEn: "Before a tour", detailZh: "公开位置只是大致区域，不能替代现场核实或官方信息。", detailEn: "The public location is only an approximate area and does not replace an in-person check or official information." },
];

export const AREA_GUIDES: readonly AreaGuide[] = [
  {
    id: "flushing-and-elmhurst",
    aliases: ["Flushing", "法拉盛", "Elmhurst", "艾姆赫斯特", "Rego Park", "雷哥公园", "Jackson Heights", "杰克逊高地"],
    titleZh: "法拉盛 · 艾姆赫斯特生活圈",
    titleEn: "Flushing · Elmhurst community area",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "皇后区不同街区的商业密度和公共交通选择差异明显；法拉盛、艾姆赫斯特和雷哥公园一带常见较多日常零售与餐饮选择，具体便利程度仍要按街区核实。",
    summaryEn: "Queens varies considerably by block. Flushing, Elmhurst, and Rego Park commonly have a strong mix of daily retail and dining, but convenience still depends on the exact neighborhood.",
    highlights: [
      { labelZh: "生活配套", labelEn: "Daily life", detailZh: "餐饮、零售和亚洲超市选择可能较集中，店铺距离会随街区变化。", detailEn: "Dining, retail, and Asian grocery options can be concentrated in some corridors; distances vary by block." },
      { labelZh: "通勤", labelEn: "Transportation", detailZh: "公共交通组合和高峰时间差异较大，建议用目标地点估算。", detailEn: "Transit options and peak travel times vary; use the route estimator for the destination you care about." },
      { labelZh: "公开范围", labelEn: "Public location", detailZh: "房源只展示大致区域，不能据此判断到某个商家或学校的固定时间。", detailEn: "The listing shows an approximate area only; it cannot establish a fixed time to a particular store or school." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "forest-hills-and-bayside",
    aliases: ["Forest Hills", "森林小丘", "Bayside", "贝赛德", "Fresh Meadows", "新鲜草原", "Whitestone", "白石", "College Point", "学院点"],
    titleZh: "森林小丘 · 贝赛德住宅区",
    titleEn: "Forest Hills · Bayside residential areas",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "这些皇后区住宅区的公寓、独立住宅、餐饮零售和公共交通分布并不相同；看房时可重点核实步行路线、购物位置和高峰通勤。",
    summaryEn: "These Queens residential areas combine apartments, houses, local retail, and transit in different ways. During a tour, verify walking routes, shopping locations, and peak commute times.",
    highlights: [
      { labelZh: "住宅形态", labelEn: "Housing pattern", detailZh: "同一区域内也可能有公寓楼、住宅街和小型商业街，体验随街区变化。", detailEn: "A single area can include apartment buildings, residential streets, and small commercial corridors." },
      { labelZh: "生活配套", labelEn: "Daily life", detailZh: "超市、餐饮、公园和图书馆等设施的距离请按房源大致位置核实。", detailEn: "Check the distance to groceries, dining, parks, and libraries from the listing's approximate area." },
      { labelZh: "通勤", labelEn: "Transportation", detailZh: "同一行政区的路线时间也可能不同，建议输入你的实际目的地。", detailEn: "Travel times can differ even within the same borough; enter your actual destination to estimate." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "brooklyn-chinese-corridor",
    aliases: ["8th Avenue", "Brooklyn 8th Avenue", "八大道", "Sunset Park", "日落公园", "Bensonhurst", "本森赫斯特", "Homecrest", "霍姆克雷斯特", "Sheepshead Bay", "羊头湾", "Bath Beach", "巴斯海滩", "Gravesend", "格雷夫森德"],
    titleZh: "八大道 · 日落公园华人生活圈",
    titleEn: "8th Avenue · Sunset Park community area",
    regionZh: "布鲁克林",
    regionEn: "Brooklyn",
    summaryZh: "八大道、日落公园及布鲁克林南部部分街区拥有较明显的华人商业和社区生活选择；超市、餐饮、公交与地铁距离仍要按具体街区核实。",
    summaryEn: "8th Avenue, Sunset Park, and parts of southern Brooklyn have visible Chinese-language businesses and community services. Grocery, dining, bus, and subway access still varies by block.",
    highlights: [
      { labelZh: "华人商业", labelEn: "Community retail", detailZh: "华人餐饮、零售和生活服务可能集中在部分商业走廊，店铺会随街区变化。", detailEn: "Chinese-language dining, retail, and services can cluster along specific corridors and vary by block." },
      { labelZh: "交通", labelEn: "Transportation", detailZh: "去八大道商圈或曼哈顿的时间取决于出发街区、出行方式和时段。", detailEn: "Travel to 8th Avenue or Manhattan depends on the starting block, mode, and time of day." },
      { labelZh: "公开范围", labelEn: "Public location", detailZh: "房源页面不会显示精确地址；请把路线估算当作参考，不是保证。", detailEn: "The listing does not expose the exact address; route estimates are references, not guarantees." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "brooklyn-general",
    aliases: ["Brooklyn", "布鲁克林", "Downtown Brooklyn", "布鲁克林市中心", "Brooklyn Heights", "布鲁克林高地", "Williamsburg", "威廉斯堡", "Greenpoint", "绿点", "Bushwick", "布什维克", "Park Slope", "公园坡", "Bay Ridge", "海湾岭", "Dyker Heights", "戴克高地", "Brighton Beach", "布莱顿海滩", "Midwood", "中木区"],
    titleZh: "布鲁克林区域参考",
    titleEn: "Brooklyn area reference",
    regionZh: "布鲁克林",
    regionEn: "Brooklyn",
    summaryZh: "布鲁克林不同街区的住宅形态、商业走廊、公园和公共交通组合差异很大；以下信息用于建立看房清单，不是对某个街区的评级。",
    summaryEn: "Brooklyn varies widely in housing, commercial corridors, parks, and transit. This snapshot is a tour-planning aid, not a neighborhood rating.",
    highlights: NYC_GENERAL_HIGHLIGHTS,
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "long-island-community",
    aliases: ["Long Island", "长岛", "Nassau County", "拿骚县", "Suffolk County", "萨福克县", "Great Neck", "大颈", "Jericho", "杰里科", "Syosset", "西奥塞特", "Hicksville", "希克斯维尔", "Plainview", "普莱恩维尤", "East Meadow", "东草原", "New Hyde Park", "新海德公园", "Garden City", "花园城", "Westbury", "西伯里", "Mineola", "米尼奥拉", "Manhasset", "曼哈塞特", "Huntington", "亨廷顿", "Commack", "科马克", "Stony Brook", "石溪", "Patchogue", "帕奇奥格"],
    titleZh: "长岛城镇生活参考",
    titleEn: "Long Island town reference",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "长岛不同城镇的住宅、购物、公共设施和通勤方式差异较大；尤其要按具体城镇和街区核实驾车、火车、超市与学校信息。",
    summaryEn: "Long Island towns differ considerably in housing, shopping, public facilities, and commuting. Verify driving, rail, grocery, and school information for the specific town and block.",
    highlights: [
      { labelZh: "城镇配套", labelEn: "Town amenities", detailZh: "购物、餐饮、公园和公共设施通常按城镇分布，距离不应只看县名。", detailEn: "Shopping, dining, parks, and public facilities are organized by town; a county label is not enough to judge distance." },
      { labelZh: "通勤", labelEn: "Transportation", detailZh: "驾车、火车和公交的可用性随城镇和工作地点变化，建议按目标地点估算。", detailEn: "Driving, rail, and bus access varies by town and workplace; estimate the route to the destination you need." },
      { labelZh: "学校核实", labelEn: "School check", detailZh: "学校入读资格需要精确地址和当地学区确认，房源大致区域不能替代学区查询。", detailEn: "School eligibility requires the exact address and district confirmation; an approximate listing area cannot establish a school assignment." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "upstate-new-york",
    aliases: ["Upstate New York", "纽约上州", "Albany", "奥尔巴尼", "Colonie", "科勒尼", "Buffalo", "水牛城", "Williamsville", "威廉斯维尔", "Rochester", "罗切斯特", "Brighton", "布莱顿", "Pittsford", "匹兹福德", "Syracuse", "锡拉丘兹", "Ithaca", "伊萨卡", "Cayuga Heights", "卡尤加高地", "Saratoga Springs", "萨拉托加泉", "Kingston", "金斯顿"],
    titleZh: "纽约上州区域参考",
    titleEn: "Upstate New York area reference",
    regionZh: "纽约上州",
    regionEn: "Upstate New York",
    summaryZh: "纽约上州包括城市、郊区和大学城等不同类型社区；生活配套、交通和学校信息应按具体城市或城镇核实。",
    summaryEn: "Upstate New York includes cities, suburbs, and college towns. Daily amenities, transportation, and school information should be checked for the specific city or town.",
    highlights: NYS_GENERAL_HIGHLIGHTS,
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "nyc-borough-general",
    aliases: ["Queens", "皇后区", "Manhattan", "曼哈顿", "The Bronx", "Bronx", "布朗克斯", "Staten Island", "史泰登岛", "New York City", "纽约市"],
    titleZh: "纽约市区域参考",
    titleEn: "New York City area reference",
    regionZh: "纽约市",
    regionEn: "New York City",
    summaryZh: "纽约市同一行政区内也可能有完全不同的住宅、商业和交通体验；请把这张卡片当作看房前的核实清单。",
    summaryEn: "Even within one New York City borough, housing, retail, and transit can feel very different. Use this card as a checklist for your tour, not as a rating.",
    highlights: NYC_GENERAL_HIGHLIGHTS,
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[·,./\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(value: string, alias: string) {
  const normalizedValue = normalize(value);
  const normalizedAlias = normalize(alias);
  return Boolean(normalizedValue && normalizedAlias && (normalizedValue === normalizedAlias || normalizedValue.includes(normalizedAlias)));
}

export function findAreaGuide(areaEn: string, areaZh: string): AreaGuide | null {
  const values = [areaEn, areaZh].filter((value) => Boolean(value.trim()));
  return AREA_GUIDES.find((guide) => guide.aliases.some((alias) => values.some((value) => matches(value, alias)))) || null;
}
