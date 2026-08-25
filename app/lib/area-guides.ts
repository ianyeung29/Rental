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

const SPECIFIC_AREA_GUIDES: readonly AreaGuide[] = [
  {
    id: "flushing",
    aliases: ["Flushing", "法拉盛", "Downtown Flushing", "法拉盛市中心"],
    titleZh: "法拉盛市中心生活圈",
    titleEn: "Downtown Flushing neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "法拉盛市中心以 Main Street、Roosevelt Avenue 一带为主要商业和交通节点，华人餐饮、亚洲超市、零售和生活服务较集中；同一行政区内，不同街区到商圈的步行和通勤体验仍会明显不同。",
    summaryEn: "Downtown Flushing is centered around Main Street and Roosevelt Avenue, with a dense mix of Chinese-language dining, Asian groceries, retail, and daily services. The experience can still change substantially from one block to another.",
    highlights: [
      { labelZh: "华人生活圈", labelEn: "Chinese community hub", detailZh: "Main Street 商业走廊常见餐饮、超市、银行和生活服务；请按房源大致位置核实具体店铺。", detailEn: "The Main Street corridor has dining, groceries, banks, and daily services; verify the exact stores from the listing's approximate area." },
      { labelZh: "交通节点", labelEn: "Transit hub", detailZh: "7 号线 Main St 终点站和法拉盛 LIRR 站为重要交通参考；路线时间会随出发街区和时段变化。", detailEn: "The 7 train's Main St terminus and the Flushing LIRR station are useful transit references; travel times vary by starting block and time of day." },
      { labelZh: "看房重点", labelEn: "Tour checklist", detailZh: "重点查看夜间噪音、停车、楼宇入口和到超市的实际步行路线。", detailEn: "Check evening noise, parking, building access, and the actual walking route to groceries during a tour." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "elmhurst",
    aliases: ["Elmhurst", "艾姆赫斯特"],
    titleZh: "艾姆赫斯特城市生活区",
    titleEn: "Elmhurst neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "艾姆赫斯特是高密度、多元化的皇后区住宅区，Queens Boulevard、Queens Center 和周边商业街提供较多购物、餐饮与日常服务；楼宇密度、噪音和停车条件要按街区查看。",
    summaryEn: "Elmhurst is a dense and diverse Queens neighborhood. Queens Boulevard, Queens Center, and nearby commercial streets provide shopping, dining, and daily services, while building density, noise, and parking vary by block.",
    highlights: [
      { labelZh: "购物餐饮", labelEn: "Shopping and dining", detailZh: "Queens Center、Queens Boulevard 及周边街道形成较明显的商业带，日常采购选择较多。", detailEn: "Queens Center, Queens Boulevard, and nearby streets form a notable commercial corridor with many everyday options." },
      { labelZh: "出行方式", labelEn: "Getting around", detailZh: "地铁和公交选择通常较多，但高峰拥挤和站点步行距离应现场确认。", detailEn: "Subway and bus choices are often plentiful, but peak crowding and the walk to a stop should be checked in person." },
      { labelZh: "居住体验", labelEn: "Living pattern", detailZh: "公寓楼、主干道和较安静的住宅街可能相邻，房源朝向和临街情况很重要。", detailEn: "Apartment buildings, busy avenues, and quieter residential streets can sit close together; orientation and street exposure matter." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "rego-park",
    aliases: ["Rego Park", "雷哥公园"],
    titleZh: "雷哥公园商业与住宅区",
    titleEn: "Rego Park neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "雷哥公园以 63rd Road、63rd Drive 和 Queens Boulevard 周边的住宅、公寓和商业设施为特色，Rego Center 一带购物便利；适合把具体楼宇到地铁、超市和商业中心的步行路线分别核实。",
    summaryEn: "Rego Park mixes apartments, residential streets, and commercial activity around 63rd Road, 63rd Drive, and Queens Boulevard. Rego Center adds shopping convenience, but the walk from a specific building to transit and groceries still matters.",
    highlights: [
      { labelZh: "商业中心", labelEn: "Commercial center", detailZh: "63rd Road/Drive 和 Rego Center 一带有餐饮、零售和日常服务，商业密度随街区变化。", detailEn: "63rd Road/Drive and Rego Center offer dining, retail, and daily services, with density changing by block." },
      { labelZh: "住宅形态", labelEn: "Housing pattern", detailZh: "高层公寓、合作公寓和住宅街交错，需确认门卫、洗衣、停车和采光。", detailEn: "High-rise apartments, co-ops, and residential streets mix together; verify doorman service, laundry, parking, and light." },
      { labelZh: "通勤核实", labelEn: "Commute check", detailZh: "Queens Boulevard 沿线交通选择较多，但到具体站点的步行距离和高峰时间要单独估算。", detailEn: "Queens Boulevard has several transit options, but the walk to a specific station and peak timing should be estimated separately." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "forest-hills",
    aliases: ["Forest Hills", "森林小丘"],
    titleZh: "森林小丘住宅与商业区",
    titleEn: "Forest Hills neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "森林小丘的住宅街、Austin Street、Queens Boulevard 和 Forest Park 形成不同生活场景；房源可能更靠近商业、地铁或公园，建议分别确认噪音、步行和通勤。",
    summaryEn: "Forest Hills combines residential streets, Austin Street, Queens Boulevard, and Forest Park, creating different living patterns. A listing may be closer to shopping, transit, or the park, so check noise, walking, and commute details separately.",
    highlights: [
      { labelZh: "日常配套", labelEn: "Daily amenities", detailZh: "Austin Street 和 Queens Boulevard 一带餐饮、零售与服务较集中，Forest Park 提供户外空间。", detailEn: "Austin Street and Queens Boulevard have concentrated dining, retail, and services, while Forest Park provides outdoor space." },
      { labelZh: "交通", labelEn: "Transportation", detailZh: "地铁、公交和 LIRR 选择会因房源所在一侧而不同，请按实际目的地估算。", detailEn: "Subway, bus, and LIRR options depend on which side of the neighborhood the home is in; estimate the route to your destination." },
      { labelZh: "看房提醒", labelEn: "Tour checklist", detailZh: "公园边、主干道边和商业街边的噪音与停车体验可能不同。", detailEn: "Noise and parking can differ between park-adjacent, avenue-facing, and commercial-street locations." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "jackson-heights",
    aliases: ["Jackson Heights", "杰克逊高地"],
    titleZh: "杰克逊高地多元商业区",
    titleEn: "Jackson Heights neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "杰克逊高地以 Roosevelt Avenue、74th Street 一带的多元餐饮、杂货店和公共交通为特色，住宅楼宇与商业街距离较近；具体房源要核实电梯、噪音和通勤方向。",
    summaryEn: "Jackson Heights is known for diverse dining, groceries, and transit around Roosevelt Avenue and 74th Street. Residential buildings sit close to commercial corridors, so verify elevators, noise, and the direction of your commute.",
    highlights: [
      { labelZh: "商业走廊", labelEn: "Commercial corridors", detailZh: "Roosevelt Avenue 和 74th Street 周边有较多餐饮、杂货和生活服务，步行便利度取决于具体街区。", detailEn: "Roosevelt Avenue and 74th Street have many dining, grocery, and daily services; walkability depends on the exact block." },
      { labelZh: "楼宇情况", labelEn: "Building details", detailZh: "老式公寓、合作公寓和临街商业较常见，需询问电梯、洗衣和临街噪音。", detailEn: "Pre-war apartments, co-ops, and street-level retail are common; ask about elevators, laundry, and street noise." },
      { labelZh: "交通核实", labelEn: "Transit check", detailZh: "地铁与公交线路较丰富，但站点拥挤和换乘方式应按你的目的地确认。", detailEn: "There are multiple subway and bus choices, but crowding and transfers should be checked for your destination." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "maspeth",
    aliases: ["Maspeth", "马斯佩斯", "马斯佩思", "麦斯佩斯"],
    titleZh: "马斯佩斯低密度住宅区",
    titleEn: "Maspeth neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "马斯佩斯以住宅街、工业用地和 Grand Avenue 一带的本地商业混合为特点，公共交通和道路通勤的差异很大；看房时应特别确认停车、公交站距离和晚间环境。",
    summaryEn: "Maspeth mixes residential streets, industrial parcels, and local businesses around Grand Avenue. Transit and driving patterns vary widely, so parking, bus-stop distance, and the evening environment deserve extra attention.",
    highlights: [
      { labelZh: "住宅与工业混合", labelEn: "Residential-industrial mix", detailZh: "同一区域可能同时出现住宅街、仓储或工业用途，具体街道氛围差别明显。", detailEn: "Residential streets can sit near warehouse or industrial uses, creating noticeable street-to-street differences." },
      { labelZh: "通勤方式", labelEn: "Commute pattern", detailZh: "不少路线更依赖公交、驾车和接驳，不能只按皇后区名称判断通勤便利度。", detailEn: "Many trips depend on buses, driving, or transfers; the Queens label alone does not describe commute convenience." },
      { labelZh: "看房重点", labelEn: "Tour checklist", detailZh: "确认停车、货车噪音、公交站步行距离和附近日常采购位置。", detailEn: "Confirm parking, truck noise, walking distance to buses, and the location of everyday groceries." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "bayside",
    aliases: ["Bayside", "貝賽", "贝赛", "贝赛德", "貝賽德"],
    titleZh: "貝賽住宅与 Bell Boulevard 生活圈",
    titleEn: "Bayside neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "貝賽整体以住宅街为主，Bell Boulevard 和 Bay Terrace 一带提供餐饮、购物及日常服务；LIRR Bayside 站和公交是重要出行参考，但到商业区或车站的距离要按具体位置确认。",
    summaryEn: "Bayside is primarily residential, with dining, shopping, and daily services around Bell Boulevard and Bay Terrace. The Bayside LIRR station and buses are useful transit references, but the distance to them depends on the specific block.",
    highlights: [
      { labelZh: "本地商业", labelEn: "Local retail", detailZh: "Bell Boulevard 和 Bay Terrace 的商业设施更像本地生活中心，和法拉盛市中心的密集度不同。", detailEn: "Bell Boulevard and Bay Terrace function as local town centers and have a different feel from dense Downtown Flushing." },
      { labelZh: "火车与公交", labelEn: "Rail and bus", detailZh: "Bayside LIRR 站及 Q13 等公交可作为通勤参考，实际班次和步行路线应现场确认。", detailEn: "The Bayside LIRR station and buses such as the Q13 are useful references; verify schedules and walking routes for the home." },
      { labelZh: "居住体验", labelEn: "Living pattern", detailZh: "独立住宅、低层公寓和较安静的街道较常见，停车和到超市的距离可能比市中心更重要。", detailEn: "Detached homes, low-rise apartments, and quieter streets are common; parking and grocery distance may matter more than downtown access." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "whitestone",
    aliases: ["Whitestone", "白石镇", "白石", "Beechhurst", "比彻斯特", "Malba", "马尔巴"],
    titleZh: "白石镇 · 比彻斯特住宅区",
    titleEn: "Whitestone · Beechhurst neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "白石镇和比彻斯特以低密度住宅、海湾附近街区和本地商业为主，Bay Terrace、Bell Boulevard 等购物点可作生活参考；公共交通覆盖和步行便利度较依赖具体位置。",
    summaryEn: "Whitestone and Beechhurst are largely low-density residential areas near the waterfront, with local shopping references including Bay Terrace and Bell Boulevard. Transit coverage and walkability depend heavily on the exact location.",
    highlights: [
      { labelZh: "低密度住宅", labelEn: "Low-density housing", detailZh: "独立住宅、联排和低层住宅较常见，街道之间的停车和房屋维护情况需要逐一查看。", detailEn: "Detached homes, townhouses, and low-rise housing are common; parking and property condition should be checked street by street." },
      { labelZh: "购物位置", labelEn: "Shopping access", detailZh: "Bay Terrace、Bell Boulevard 和 26th Avenue 一带可作为餐饮和日常采购参考，不等于每套房都步行可达。", detailEn: "Bay Terrace, Bell Boulevard, and 26th Avenue are useful shopping references, but not every home is within walking distance." },
      { labelZh: "出行核实", labelEn: "Transit check", detailZh: "公交和驾车通常比地铁更关键；请把工作地点或学校输入路线估算器。", detailEn: "Bus service and driving can matter more than subway access; use the route estimator for your workplace or school." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "college-point",
    aliases: ["College Point", "大学点", "学院点"],
    titleZh: "大学点住宅与 College Point Boulevard",
    titleEn: "College Point neighborhood guide",
    regionZh: "皇后区",
    regionEn: "Queens",
    summaryZh: "大学点的住宅、工业和大型零售用途沿 College Point Boulevard 及周边交错分布，生活便利度和街道环境差异较大；看房时要核实公交、停车、噪音和到超市的实际路线。",
    summaryEn: "College Point mixes residential, industrial, and larger-format retail uses around College Point Boulevard. Convenience and street conditions vary, so verify buses, parking, noise, and the actual grocery route.",
    highlights: [
      { labelZh: "大型零售", labelEn: "Retail access", detailZh: "College Point Boulevard 周边有较多大型商店和餐饮选择，但步行环境不一定连续。", detailEn: "College Point Boulevard has larger stores and dining options, though the walking environment may not be continuous." },
      { labelZh: "道路与公交", labelEn: "Roads and buses", detailZh: "公交和驾车路线对日常生活较重要，建议按具体上班地点核实高峰时间。", detailEn: "Bus and driving routes can be important for daily life; check peak travel times to the actual workplace." },
      { labelZh: "看房重点", labelEn: "Tour checklist", detailZh: "确认货车或工业活动、停车安排、采光和夜间街道环境。", detailEn: "Ask about truck or industrial activity, parking arrangements, natural light, and the nighttime street environment." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "brooklyn-8th-avenue",
    aliases: ["8th Avenue", "Brooklyn 8th Avenue", "八大道"],
    titleZh: "布鲁克林八大道华人商业走廊",
    titleEn: "Brooklyn 8th Avenue Chinese commercial corridor",
    regionZh: "布鲁克林",
    regionEn: "Brooklyn",
    summaryZh: "八大道是布鲁克林较明显的华人餐饮、超市、零售和生活服务商业走廊，商业密度通常沿主要街段更高；房源到商圈、地铁和停车位的实际距离仍需按街区核实。",
    summaryEn: "Brooklyn 8th Avenue is a prominent corridor for Chinese-language dining, groceries, retail, and daily services. Business density is stronger along key sections, while the actual distance to shopping, subway, and parking varies by block.",
    highlights: [
      { labelZh: "华人商业", labelEn: "Chinese community retail", detailZh: "餐饮、超市、面包店、药房和生活服务较集中，适合把具体店名列入看房清单。", detailEn: "Dining, groceries, bakeries, pharmacies, and daily services cluster along the corridor; add the specific stores you use to your tour checklist." },
      { labelZh: "交通核实", labelEn: "Transit check", detailZh: "地铁、公交和驾车体验会随 8th Avenue 的南北位置改变，不能只按“八大道”估算时间。", detailEn: "Subway, bus, and driving conditions change along the avenue; do not estimate travel time from the phrase “8th Avenue” alone." },
      { labelZh: "居住环境", labelEn: "Living pattern", detailZh: "商业街边更方便但可能更热闹，内街房源需单独确认到超市和车站的步行路线。", detailEn: "Avenue-facing homes may be more convenient but busier; inner-block homes need a separate grocery and station walk check." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "sunset-park",
    aliases: ["Sunset Park", "日落公园"],
    titleZh: "日落公园与八大道生活圈",
    titleEn: "Sunset Park neighborhood guide",
    regionZh: "布鲁克林",
    regionEn: "Brooklyn",
    summaryZh: "日落公园把八大道商业、住宅街、工业用途和公园空间结合在一起，街区坡度、噪音和景观差异明显；看房时要分别查看商业便利、地铁路线和夜间环境。",
    summaryEn: "Sunset Park combines the 8th Avenue commercial corridor with residential streets, industrial uses, and park space. Slope, noise, and views vary noticeably, so check shopping, transit, and evening conditions separately.",
    highlights: [
      { labelZh: "街区结构", labelEn: "Neighborhood structure", detailZh: "商业街、住宅街和工业用途相邻，具体一个街口可能改变噪音与人流。", detailEn: "Commercial streets, residential blocks, and industrial uses can sit close together, changing noise and foot traffic within a few blocks." },
      { labelZh: "生活配套", labelEn: "Daily life", detailZh: "八大道提供较多华人餐饮和采购选择，公园与海湾方向也影响日常活动路线。", detailEn: "8th Avenue provides many Chinese-language dining and grocery options, while the park and waterfront side shape other daily routes." },
      { labelZh: "通勤", labelEn: "Commute", detailZh: "到曼哈顿或布鲁克林其他区域的时间要根据具体起点、线路和时段估算。", detailEn: "Travel to Manhattan or other Brooklyn neighborhoods should be estimated from the exact starting block, route, and time." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "bensonhurst",
    aliases: ["Bensonhurst", "本森赫斯特"],
    titleZh: "本森赫斯特多元商业住宅区",
    titleEn: "Bensonhurst neighborhood guide",
    regionZh: "布鲁克林",
    regionEn: "Brooklyn",
    summaryZh: "本森赫斯特在 18th Avenue、86th Street 等主要街段有较成熟的本地餐饮、超市和服务，住宅街相对分散；房源距离不同商业街和地铁站的差异可能很大。",
    summaryEn: "Bensonhurst has established local dining, groceries, and services around corridors such as 18th Avenue and 86th Street, with more dispersed residential blocks beyond them. Distances to shopping and subway stops can vary substantially.",
    highlights: [
      { labelZh: "商业选择", labelEn: "Commercial options", detailZh: "不同街段的华人、意大利及其他社区餐饮和零售组合不同，建议按常用店铺核实。", detailEn: "Chinese, Italian, and other community businesses vary by corridor; check the stores you actually use." },
      { labelZh: "住宅街", labelEn: "Residential blocks", detailZh: "内街通常比商业大道安静，但到地铁、超市和公交的步行距离要实际测量。", detailEn: "Inner blocks may be quieter than avenues, but walking distance to transit and groceries should be measured in person." },
      { labelZh: "看房重点", labelEn: "Tour checklist", detailZh: "询问停车、楼龄、洗衣、临街噪音和冬季清雪情况。", detailEn: "Ask about parking, building age, laundry, street noise, and winter snow clearing." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "homecrest-sheepshead-bay",
    aliases: ["Homecrest", "霍姆克雷斯特", "Sheepshead Bay", "羊头湾"],
    titleZh: "霍姆克雷斯特 · 羊头湾生活区",
    titleEn: "Homecrest · Sheepshead Bay neighborhood guide",
    regionZh: "布鲁克林",
    regionEn: "Brooklyn",
    summaryZh: "霍姆克雷斯特和羊头湾在 Avenue U、Brighton Beach Avenue 及 Emmons Avenue 周边形成餐饮、超市和滨水生活组合；商业密度、停车和地铁步行距离需按具体街区确认。",
    summaryEn: "Homecrest and Sheepshead Bay combine dining, groceries, and waterfront life around Avenue U, Brighton Beach Avenue, and Emmons Avenue. Commercial density, parking, and subway walks vary by block.",
    highlights: [
      { labelZh: "采购餐饮", labelEn: "Groceries and dining", detailZh: "Avenue U 和周边商业街有多元餐饮与日常采购选择，具体距离以房源大致位置为准。", detailEn: "Avenue U and nearby corridors offer diverse dining and everyday shopping; distance depends on the listing's approximate area." },
      { labelZh: "滨水环境", labelEn: "Waterfront setting", detailZh: "靠近海湾的房源可能有更好的户外环境，也要核实风、潮湿、停车和夜间人流。", detailEn: "Waterfront-adjacent homes may offer outdoor access, but ask about wind, moisture, parking, and nighttime activity." },
      { labelZh: "出行", labelEn: "Getting around", detailZh: "地铁、公交和驾车路线取决于所在街段，建议输入工作地点或学校估算。", detailEn: "Subway, bus, and driving options depend on the block; estimate the route to your workplace or school." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "bay-ridge",
    aliases: ["Bay Ridge", "湾脊", "海湾岭", "Dyker Heights", "戴克高地"],
    titleZh: "湾脊 · 戴克高地住宅区",
    titleEn: "Bay Ridge · Dyker Heights neighborhood guide",
    regionZh: "布鲁克林",
    regionEn: "Brooklyn",
    summaryZh: "湾脊和戴克高地以住宅街、3rd/5th Avenue 本地商业、餐饮和滨水空间为主要生活参考，街区南北差异明显；请核实到 R 线、公交、超市和工作地点的路线。",
    summaryEn: "Bay Ridge and Dyker Heights combine residential streets, local shopping and dining along 3rd and 5th Avenues, and waterfront space. Conditions change from north to south, so check routes to the R train, buses, groceries, and work.",
    highlights: [
      { labelZh: "本地商业", labelEn: "Local retail", detailZh: "3rd Avenue、5th Avenue 和 86th Street 一带提供较完整的日常餐饮和零售。", detailEn: "3rd Avenue, 5th Avenue, and 86th Street provide a strong mix of everyday dining and retail." },
      { labelZh: "住宅氛围", labelEn: "Residential feel", detailZh: "低层住宅、联排和公寓混合，停车、采光和冬季街道情况应现场查看。", detailEn: "Low-rise homes, townhouses, and apartments mix together; check parking, light, and winter street conditions." },
      { labelZh: "通勤核实", labelEn: "Commute check", detailZh: "到曼哈顿或其他布鲁克林区域的时间随地铁站距离和换乘明显变化。", detailEn: "Travel to Manhattan or other Brooklyn neighborhoods changes meaningfully with station distance and transfers." },
    ],
    schoolReference: NYC_SCHOOL_REFERENCE,
  },
  {
    id: "jericho",
    aliases: ["Jericho", "杰里科"],
    titleZh: "杰里科郊区生活区",
    titleEn: "Jericho neighborhood guide",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "杰里科以低密度住宅、购物中心和较强的驾车生活为主，日常采购和通勤便利度取决于具体社区；最近的 LIRR 选择、学校边界和停车条件都应按精确地址核实。",
    summaryEn: "Jericho is a low-density suburban area with shopping centers and a largely driving-oriented daily routine. Rail access, school boundaries, and parking should all be checked against the exact address.",
    highlights: [
      { labelZh: "郊区配套", labelEn: "Suburban amenities", detailZh: "超市、餐饮和服务多分布在商业中心或主干道附近，步行连续性可能有限。", detailEn: "Groceries, dining, and services tend to cluster at shopping centers or along main roads, with limited continuous walkability." },
      { labelZh: "驾车生活", labelEn: "Driving pattern", detailZh: "车位、车程和冬季道路情况是看房的重要部分，不宜只看城镇名称。", detailEn: "Parking, driving time, and winter road conditions are central to the experience; the town name alone is not enough." },
      { labelZh: "学校核实", labelEn: "School check", detailZh: "学区边界和入读资格必须用精确地址向当地学区确认。", detailEn: "School boundaries and eligibility must be confirmed with the local district using the exact address." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "syosset",
    aliases: ["Syosset", "赛奥塞特", "西奥塞特", "赛奥塞", "赛奥西特"],
    titleZh: "赛奥塞特住宅与 LIRR 生活圈",
    titleEn: "Syosset neighborhood guide",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "赛奥塞特以住宅社区、Jericho Turnpike 商业和 Syosset LIRR 站为主要参考，日常生活通常需要驾车或接驳；房源到车站、超市和学校的实际距离要逐一核实。",
    summaryEn: "Syosset combines residential neighborhoods, Jericho Turnpike shopping, and the Syosset LIRR station. Daily life often involves driving or a transfer, so check the actual distance to rail, groceries, and schools.",
    highlights: [
      { labelZh: "铁路参考", labelEn: "Rail reference", detailZh: "Syosset LIRR 站可作为进城通勤参考，但停车、接驳和班次要按工作时间确认。", detailEn: "Syosset LIRR is a useful Manhattan-commute reference, but parking, transfers, and schedules should match the workday." },
      { labelZh: "商业位置", labelEn: "Shopping access", detailZh: "Jericho Turnpike 及周边商业点提供日常采购，房源到店铺通常更适合驾车核实。", detailEn: "Jericho Turnpike and nearby centers provide daily shopping; driving access from the home should be checked." },
      { labelZh: "学校核实", labelEn: "School check", detailZh: "不要仅凭城镇名判断学校，必须按精确地址、年级和当年政策确认。", detailEn: "Do not infer school access from the town name; confirm it by exact address, grade, and current policy." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "hicksville",
    aliases: ["Hicksville", "希克斯维尔"],
    titleZh: "希克斯维尔交通与商业节点",
    titleEn: "Hicksville neighborhood guide",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "希克斯维尔是拿骚县较重要的铁路和道路交通节点，Broadway、Route 107 及周边商业提供多种日常选择；房源到 LIRR、超市和商业中心的距离会随街区变化。",
    summaryEn: "Hicksville is an important Nassau rail and road hub, with everyday shopping around Broadway, Route 107, and nearby commercial areas. Distances to the LIRR, groceries, and shopping vary by block.",
    highlights: [
      { labelZh: "通勤节点", labelEn: "Commute hub", detailZh: "Hicksville LIRR 站可作为通勤参考，也要确认停车、接驳、施工和高峰班次。", detailEn: "Hicksville LIRR is a useful commute reference; check parking, transfers, construction, and peak schedules." },
      { labelZh: "日常采购", labelEn: "Daily shopping", detailZh: "Broadway、Route 107 和周边商业街的超市、餐饮和服务分布不完全相同。", detailEn: "Grocery, dining, and services vary across Broadway, Route 107, and nearby corridors." },
      { labelZh: "看房提醒", labelEn: "Tour checklist", detailZh: "确认铁路或主干道噪音、停车安排、洗衣和到车站的实际步行路线。", detailEn: "Check rail or road noise, parking, laundry, and the actual walk to the station." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "plainview",
    aliases: ["Plainview", "普莱恩维尤"],
    titleZh: "普莱恩维尤郊区生活区",
    titleEn: "Plainview neighborhood guide",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "普莱恩维尤以住宅社区、Old Country Road 一带商业和较强的驾车生活为主，超市、餐饮和公园的距离要按具体房源测量；前往铁路站点通常需要接驳或驾车。",
    summaryEn: "Plainview is a suburban, driving-oriented community with shopping along Old Country Road and other corridors. Measure the actual distance to groceries, restaurants, parks, and rail connections from the home.",
    highlights: [
      { labelZh: "商业中心", labelEn: "Shopping centers", detailZh: "主干道附近的商业中心提供日常采购，但不同住宅区的步行可达性差异较大。", detailEn: "Main-road shopping centers offer daily needs, but walkability varies considerably between residential sections." },
      { labelZh: "出行方式", labelEn: "Getting around", detailZh: "驾车和公交通常比步行更常见，通勤时间应按实际工作地点估算。", detailEn: "Driving and buses are often more practical than walking; estimate travel time to the actual workplace." },
      { labelZh: "看房重点", labelEn: "Tour checklist", detailZh: "确认车位、储物、洗衣、街道照明和冬季道路维护。", detailEn: "Confirm parking, storage, laundry, street lighting, and winter road maintenance." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "east-meadow",
    aliases: ["East Meadow", "东草原"],
    titleZh: "东草原住宅与主干道生活区",
    titleEn: "East Meadow neighborhood guide",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "东草原以低密度住宅、Hempstead Turnpike 商业和公园设施为主要生活参考，日常出行通常需要驾车或公交；房源到商店、学校和工作地点的时间要按地址估算。",
    summaryEn: "East Meadow combines low-density housing, Hempstead Turnpike shopping, and park facilities. Daily trips often rely on driving or buses, so estimate times to shops, schools, and work from the exact address.",
    highlights: [
      { labelZh: "日常配套", labelEn: "Daily amenities", detailZh: "Hempstead Turnpike 及周边商业提供餐饮、超市和服务，步行连续性随街区变化。", detailEn: "Hempstead Turnpike and nearby centers provide dining, groceries, and services, with varying walkability." },
      { labelZh: "住宅环境", labelEn: "Residential setting", detailZh: "独立住宅和住宅街较常见，停车、院落、采光和邻近主干道情况要现场确认。", detailEn: "Detached homes and residential streets are common; check parking, yards, light, and proximity to main roads." },
      { labelZh: "学校核实", labelEn: "School check", detailZh: "学区与入读资格需向当地学区和官方目录核实，不以房源标题为准。", detailEn: "Verify district and eligibility with the local district and official directory, not the listing title." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "great-neck",
    aliases: ["Great Neck", "大颈"],
    titleZh: "大颈多城镇与铁路生活圈",
    titleEn: "Great Neck neighborhood guide",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "大颈由多个 village 和住宅片区组成，商业中心、海湾环境和 Port Washington Branch 铁路站点分布不同；看房时应先确认所在村镇，再核实停车、税费、超市与学区信息。",
    summaryEn: "Great Neck includes several villages and residential sections with different shopping centers, waterfront settings, and Port Washington Branch stations. First identify the village, then verify parking, fees, groceries, and school details.",
    highlights: [
      { labelZh: "铁路出行", labelEn: "Rail access", detailZh: "Great Neck LIRR 站及周边站点可作为进城参考，但房源到站距离和停车安排差异很大。", detailEn: "Great Neck and nearby LIRR stations are useful city-commute references, but walk distance and parking vary widely." },
      { labelZh: "城镇差异", labelEn: "Town differences", detailZh: "不同 village 的商业、物业规则和公共设施不完全相同，不能只写“大颈”。", detailEn: "Villages differ in shopping, property rules, and public facilities; “Great Neck” alone is not specific enough." },
      { labelZh: "学校核实", labelEn: "School check", detailZh: "学区边界要以精确地址和官方信息为准，尤其要确认具体 village 或 school district。", detailEn: "Use the exact address and official information to confirm district boundaries, especially the specific village and school district." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "new-hyde-park",
    aliases: ["New Hyde Park", "新海德公园"],
    titleZh: "新海德公园铁路与住宅区",
    titleEn: "New Hyde Park neighborhood guide",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "新海德公园连接皇后区与拿骚县，Jericho Turnpike、Union Turnpike 和 LIRR 站点周边形成不同生活场景；租客应确认所在县、村镇、停车和学区边界。",
    summaryEn: "New Hyde Park connects Queens and Nassau County, with different living patterns around Jericho Turnpike, Union Turnpike, and LIRR stations. Confirm the county, village, parking, and school boundaries for the exact home.",
    highlights: [
      { labelZh: "位置优势", labelEn: "Location context", detailZh: "靠近皇后区与拿骚县交界，通勤方向和公共服务可能因地址不同而变化。", detailEn: "Its Queens–Nassau border location means commuting and public services can change by address." },
      { labelZh: "本地商业", labelEn: "Local retail", detailZh: "Jericho Turnpike、Union Turnpike 一带有餐饮、商店和服务，距离要按街区核实。", detailEn: "Jericho Turnpike and Union Turnpike have dining, shops, and services; verify distance by block." },
      { labelZh: "看房重点", labelEn: "Tour checklist", detailZh: "询问停车、铁路或主干道噪音、公共交通和租约费用明细。", detailEn: "Ask about parking, rail or road noise, transit, and the full lease-cost breakdown." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "garden-city",
    aliases: ["Garden City", "花园城"],
    titleZh: "花园城商业与铁路生活区",
    titleEn: "Garden City neighborhood guide",
    regionZh: "长岛",
    regionEn: "Long Island",
    summaryZh: "花园城的住宅街、Franklin Avenue 商业、Roosevelt Field 一带购物和铁路站点共同构成生活参考；不同片区的步行、停车和物业规则差异明显。",
    summaryEn: "Garden City combines residential streets, Franklin Avenue businesses, shopping near Roosevelt Field, and nearby rail stations. Walkability, parking, and property rules vary across sections.",
    highlights: [
      { labelZh: "购物餐饮", labelEn: "Shopping and dining", detailZh: "Franklin Avenue 和 Roosevelt Field 周边提供较多餐饮、购物与娱乐，但通常需要驾车或接驳。", detailEn: "Franklin Avenue and Roosevelt Field offer substantial shopping, dining, and entertainment, often requiring a car or transfer." },
      { labelZh: "铁路与道路", labelEn: "Rail and roads", detailZh: "附近多个 LIRR 站点可作参考，具体通勤应按房源到站路线和停车条件估算。", detailEn: "Several nearby LIRR stations can be references; estimate the trip from the home, including parking and transfers." },
      { labelZh: "城镇规则", labelEn: "Local rules", detailZh: "物业、停车和公共设施可能因 village 边界不同而不同，租约前要问清费用和限制。", detailEn: "Property, parking, and public facilities can change by village boundary; clarify fees and restrictions before signing." },
    ],
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "albany",
    aliases: ["Albany", "奥尔巴尼"],
    titleZh: "奥尔巴尼城市与州府生活区",
    titleEn: "Albany neighborhood guide",
    regionZh: "纽约上州",
    regionEn: "Upstate New York",
    summaryZh: "奥尔巴尼包含州府、大学、老住宅街和郊区商业等不同片区，公交、驾车和步行体验差异明显；应按具体社区核实冬季道路、停车和日常采购。",
    summaryEn: "Albany includes the state-capital district, university areas, older residential streets, and suburban shopping. Transit, driving, and walkability differ by neighborhood, as do winter roads, parking, and grocery access.",
    highlights: NYS_GENERAL_HIGHLIGHTS,
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "buffalo",
    aliases: ["Buffalo", "水牛城"],
    titleZh: "水牛城城市与郊区参考",
    titleEn: "Buffalo neighborhood guide",
    regionZh: "纽约上州",
    regionEn: "Upstate New York",
    summaryZh: "水牛城市区、大学区和周边郊区的住宅与交通差异较大，冬季天气对驾车、停车和步行影响明显；请按具体地址核实生活配套。",
    summaryEn: "Buffalo's city, university, and suburban areas differ in housing and transportation. Winter weather can materially affect driving, parking, and walking, so check amenities for the exact location.",
    highlights: NYS_GENERAL_HIGHLIGHTS,
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "rochester",
    aliases: ["Rochester", "罗切斯特"],
    titleZh: "罗切斯特城市与大学生活区",
    titleEn: "Rochester neighborhood guide",
    regionZh: "纽约上州",
    regionEn: "Upstate New York",
    summaryZh: "罗切斯特的市区、大学周边和郊区社区各有不同，公交覆盖、驾车通勤、购物距离和冬季维护应按具体街区判断。",
    summaryEn: "Rochester's downtown, university areas, and suburbs have different patterns. Judge bus access, driving, shopping distance, and winter maintenance by the specific neighborhood.",
    highlights: NYS_GENERAL_HIGHLIGHTS,
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "syracuse",
    aliases: ["Syracuse", "锡拉丘兹"],
    titleZh: "锡拉丘兹城市与大学城参考",
    titleEn: "Syracuse neighborhood guide",
    regionZh: "纽约上州",
    regionEn: "Upstate New York",
    summaryZh: "锡拉丘兹的大学区、城市住宅区和外围郊区在公交、停车、坡度和冬季出行方面差别明显；租客应输入实际目的地估算路线。",
    summaryEn: "Syracuse's university area, city neighborhoods, and outer suburbs differ in transit, parking, hills, and winter travel. Estimate routes to the actual destination.",
    highlights: NYS_GENERAL_HIGHLIGHTS,
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
  {
    id: "ithaca",
    aliases: ["Ithaca", "伊萨卡"],
    titleZh: "伊萨卡大学城与山谷生活区",
    titleEn: "Ithaca neighborhood guide",
    regionZh: "纽约上州",
    regionEn: "Upstate New York",
    summaryZh: "伊萨卡是大学城与山谷地形结合的社区，公交、步行坡度、校园方向和冬季道路会影响日常体验；房源到学校、超市和工作地点的路线应单独核实。",
    summaryEn: "Ithaca combines a college-town setting with valley terrain. Transit, walking hills, campus direction, and winter roads shape daily life, so check routes to school, groceries, and work separately.",
    highlights: NYS_GENERAL_HIGHLIGHTS,
    schoolReference: NEW_YORK_STATE_SCHOOL_REFERENCE,
  },
];

const GENERAL_AREA_GUIDES: readonly AreaGuide[] = [
  {
    id: "flushing-and-elmhurst",
    aliases: ["Flushing", "法拉盛", "Elmhurst", "艾姆赫斯特", "Rego Park", "雷哥公园", "Jackson Heights", "杰克逊高地", "Murray Hill", "莫瑞丘", "茉莉丘", "穆雷山", "默里山", "法拉盛梅里山"],
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
    aliases: ["Forest Hills", "森林小丘", "Bayside", "貝賽", "贝赛", "贝赛德", "貝賽德", "Fresh Meadows", "新鲜草原", "Whitestone", "白石镇", "白石", "College Point", "大学点", "学院点"],
    titleZh: "森林小丘 · 貝賽住宅区",
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
    aliases: ["Brooklyn", "布鲁克林", "Downtown Brooklyn", "布鲁克林市中心", "Brooklyn Heights", "布鲁克林高地", "Williamsburg", "威廉斯堡", "Greenpoint", "绿点", "Bushwick", "布什维克", "Park Slope", "公园坡", "Bay Ridge", "湾脊", "海湾岭", "Dyker Heights", "戴克高地", "Brighton Beach", "布莱顿海滩", "Midwood", "中木区"],
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
    aliases: ["Long Island", "长岛", "Nassau County", "拿骚县", "Suffolk County", "萨福克县", "Great Neck", "大颈", "Jericho", "杰里科", "Syosset", "赛奥塞特", "西奥塞特", "赛奥塞", "Hicksville", "希克斯维尔", "Plainview", "普莱恩维尤", "East Meadow", "东草原", "东梅多", "New Hyde Park", "新海德公园", "Garden City", "花园城", "Westbury", "西伯里", "Mineola", "米尼奥拉", "Manhasset", "曼哈塞特", "Huntington", "亨廷顿", "Commack", "康马克", "科马克", "Stony Brook", "石溪", "Patchogue", "帕乔格", "帕奇奥格"],
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
    aliases: ["Upstate New York", "纽约上州", "Colonie", "科勒尼", "Williamsville", "威廉斯维尔", "Brighton", "布莱顿", "Pittsford", "匹兹福德", "Cayuga Heights", "卡尤加高地", "Saratoga Springs", "萨拉托加泉", "Kingston", "金斯顿"],
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

export const AREA_GUIDES: readonly AreaGuide[] = [...SPECIFIC_AREA_GUIDES, ...GENERAL_AREA_GUIDES];

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
