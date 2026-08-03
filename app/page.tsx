"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import AccountDrawer from "./components/AccountDrawer";
import AuthDrawer from "./components/AuthDrawer";
import ReportDrawer from "./components/ReportDrawer";

type Locale = "zh" | "en";
type RentalType = "all" | "entire" | "privateRoom" | "sublet";
type SortMode = "fit" | "price" | "fresh";

type Listing = {
  id: string;
  titleZh: string;
  titleEn: string;
  areaZh: string;
  areaEn: string;
  type: Exclude<RentalType, "all">;
  typeZh: string;
  typeEn: string;
  price: number;
  currency: "USD";
  bedrooms: string;
  bathrooms: string;
  moveIn: string;
  lease: string;
  image: string;
  features: string[];
  tagsZh: string[];
  tagsEn: string[];
  freshnessZh: string;
  freshnessEn: string;
  posterZh: string;
  posterEn: string;
  posterVerified?: boolean;
  privacyZh: string;
  privacyEn: string;
  source?: "sample" | "local" | "remote";
  posterRole?: "owner" | "agent";
  descriptionZh?: string;
  descriptionEn?: string;
  privateAddress?: string;
  photos?: string[];
  photoKeys?: string[];
};

type SearchSnapshot = {
  location: string;
  maxPrice: string;
  rentalType: RentalType;
  moveIn: string;
  activeFeatures: string[];
  sortMode: SortMode;
};

type Inquiry = {
  id: string;
  listingId: string;
  listingTitle: string;
  sentAt: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  tourPreference: string;
  message: string;
  status: string;
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerified: boolean;
};

type DashboardListing = Listing & {
  privateAddress: string;
  contactName: string;
  contactEmail: string;
  tourPreference: string;
  status: string;
  createdAt: string;
};

type DashboardInquiry = Inquiry & {
  requesterName?: string;
  requesterEmail?: string;
};

type ListingDraft = {
  titleEn: string;
  titleZh: string;
  areaEn: string;
  areaZh: string;
  privateAddress: string;
  posterRole: "owner" | "agent";
  rentalType: Exclude<RentalType, "all">;
  price: string;
  currency: "USD";
  bedrooms: string;
  bathrooms: string;
  moveInMode: "immediate" | "date";
  moveInDate: string;
  lease: string;
  features: string[];
  descriptionEn: string;
  descriptionZh: string;
  photos: string[];
  photoKeys: string[];
  contactName: string;
  contactEmail: string;
  tourPreference: string;
};

type PostStep = 1 | 2 | 3 | 4 | 5;

const EMPTY_DRAFT: ListingDraft = {
  titleEn: "",
  titleZh: "",
  areaEn: "",
  areaZh: "",
  privateAddress: "",
  posterRole: "owner",
  rentalType: "entire",
  price: "",
  currency: "USD",
  bedrooms: "1",
  bathrooms: "1",
  moveInMode: "immediate",
  moveInDate: "",
  lease: "12",
  features: [],
  descriptionEn: "",
  descriptionZh: "",
  photos: [],
  photoKeys: [],
  contactName: "",
  contactEmail: "",
  tourPreference: "flexible",
};

const STORAGE_KEYS = {
  locale: "rental-marketplace.locale",
  savedIds: "rental-marketplace.saved-ids",
  savedSearch: "rental-marketplace.saved-search",
  savedSearchSnapshot: "rental-marketplace.saved-search-snapshot",
  customListings: "rental-marketplace.custom-listings",
  inquiries: "rental-marketplace.inquiries",
  draft: "rental-marketplace.listing-draft",
  editingListingId: "rental-marketplace.editing-listing-id",
};

const POST_FEATURE_KEYS = [
  "furnished",
  "utilities",
  "parking",
  "pets",
  "laundry",
  "inUnitLaundry",
  "airConditioning",
  "dishwasher",
  "balcony",
  "elevator",
  "gym",
  "doorman",
  "storage",
] as const;

const INQUIRY_COMMENT_OPTIONS = [
  { value: "details", zh: "想进一步了解房屋详情", en: "I'd like to understand more about the house" },
  { value: "asap", zh: "希望尽快看房", en: "I'd like to see the house as soon as possible" },
  { value: "costs", zh: "想确认租金、押金及其他费用", en: "I'd like to confirm rent, deposits, and other fees" },
  { value: "location", zh: "想了解具体位置和周边环境", en: "I'd like to learn more about the location and neighborhood" },
  { value: "terms", zh: "想确认入住日期和租期", en: "I'd like to confirm the move-in date and lease length" },
  { value: "furniture", zh: "想确认家具和家电配置", en: "I'd like to confirm the furniture and appliances" },
  { value: "pets", zh: "我有宠物，想确认是否可以", en: "I have a pet and would like to confirm the policy" },
  { value: "weekend", zh: "希望安排周末看房", en: "I'd prefer to tour on a weekend" },
  { value: "utilities", zh: "想确认水电网等费用是否包含", en: "I'd like to confirm whether utilities are included" },
  { value: "requirements", zh: "想了解申请条件和所需材料", en: "I'd like to learn about the application requirements" },
] as const;

// Common NYC and Long Island search aliases. Exact listing text remains searchable too.
const LOCATION_ALIAS_GROUPS = [
  ["纽约", "紐約", "纽约市", "紐約市", "new york", "new york city", "nyc", "n y c"],
  ["曼哈顿", "曼哈頓", "曼哈顿区", "曼哈頓區", "manhattan", "new york county"],
  ["布鲁克林", "布魯克林", "布鲁克林区", "布魯克林區", "brooklyn", "kings county"],
  ["皇后区", "皇后區", "皇后", "queens", "queens county"],
  ["布朗克斯", "布朗克斯区", "布朗克斯區", "the bronx", "bronx", "bronx county"],
  ["史泰登岛", "史泰登島", "斯塔滕岛", "斯塔滕島", "staten island", "richmond county"],
  ["长岛", "長島", "长岛地区", "長島地區", "long island"],
  ["拿骚县", "拿騷縣", "nassau", "nassau county"],
  ["萨福克县", "薩福克縣", "suffolk", "suffolk county"],
  ["纽约州", "紐約州", "new york state", "ny state"],

  ["曼哈顿中城", "曼哈頓中城", "中城", "midtown", "midtown manhattan"],
  ["曼哈顿下城", "曼哈頓下城", "下城", "downtown manhattan", "lower manhattan"],
  ["上东区", "上東區", "upper east side", "ues"],
  ["上西区", "上西區", "upper west side", "uws"],
  ["下东区", "下東區", "lower east side", "les"],
  ["东村", "東村", "east village"],
  ["西村", "西村", "west village"],
  ["格林尼治村", "格林尼治村", "格林威治村", "greenwich village"],
  ["苏活", "蘇活", "苏荷", "蘇荷", "soho", "so ho"],
  ["诺霍", "諾霍", "诺荷", "諾荷", "noho", "no ho"],
  ["翠贝卡", "翠貝卡", "tribeca", "tri beca"],
  ["切尔西", "切爾西", "chelsea"],
  ["地狱厨房", "地獄廚房", "克林顿", "克林頓", "hell's kitchen", "hells kitchen", "clinton"],
  ["哈德逊广场", "哈德遜廣場", "哈德逊园区", "哈德遜園區", "hudson yards"],
  ["金融区", "金融區", "financial district", "fidi"],
  ["唐人街", "唐人街", "华埠", "華埠", "chinatown"],
  ["小意大利", "小意大利", "little italy"],
  ["哈莱姆", "哈萊姆", "哈林", "harlem"],
  ["华盛顿高地", "華盛頓高地", "washington heights"],
  ["英伍德", "因伍德", "inwood"],
  ["晨边高地", "晨邊高地", "莫宁赛德高地", "莫寧賽德高地", "morningside heights"],
  ["格拉梅西", "格拉梅西", "gramercy", "gramercy park"],
  ["穆雷山", "穆雷山", "默里山", "murray hill"],
  ["基普斯湾", "基普斯灣", "kips bay"],
  ["熨斗区", "熨斗區", "扁铁区", "扁鐵區", "flatiron", "flatiron district"],
  ["联合广场", "聯合廣場", "union square"],
  ["炮台公园城", "炮台公園城", "电池公园城", "電池公園城", "battery park city"],
  ["卡内基山", "卡內基山", "carnegie hill"],
  ["萨顿广场", "薩頓廣場", "sutton place"],
  ["斯图文森特镇", "斯圖文森特鎮", "stuyvesant town", "stuy town"],
  ["罗斯福岛", "羅斯福島", "roosevelt island"],
  ["肉库区", "肉庫區", "肉类加工区", "肉類加工區", "meatpacking district", "meatpacking"],

  ["布鲁克林市中心", "布魯克林市中心", "downtown brooklyn"],
  ["布鲁克林高地", "布魯克林高地", "brooklyn heights"],
  ["曼哈顿桥下", "曼哈頓橋下", "dum​​bo", "dumbo", "down under the manhattan bridge overpass"],
  ["威廉斯堡", "威廉斯堡", "williamsburg"],
  ["绿点", "綠點", "greenpoint"],
  ["布什维克", "布什維克", "bushwick"],
  ["贝德福德斯图文森特", "貝德福德斯圖文森特", "bedford stuyvesant", "bed stuy", "bed-stuy"],
  ["格林堡", "格林堡", "fort greene"],
  ["克林顿山", "克林頓山", "clinton hill"],
  ["展望高地", "展望高地", "prospect heights"],
  ["皇冠高地", "皇冠高地", "crown heights"],
  ["公园坡", "公園坡", "公园斜坡", "公園斜坡", "park slope"],
  ["卡罗尔花园", "卡羅爾花園", "carroll gardens"],
  ["圆石山", "圓石山", "鹅卵石山", "鵝卵石山", "cobble hill"],
  ["博鲁姆山", "博魯姆山", "boerum hill"],
  ["日落公园", "日落公園", "sunset park"],
  ["海湾岭", "海灣嶺", "bay ridge"],
  ["本森赫斯特", "本森赫斯特", "bensonhurst"],
  ["羊头湾", "羊頭灣", "sheepshead bay"],
  ["布莱顿海滩", "布萊頓海灘", "brighton beach"],
  ["康尼岛", "康尼島", "coney island"],
  ["戴克高地", "戴克高地", "dyker heights"],
  ["中木区", "中木區", "midwood"],
  ["坎纳西", "坎納西", "canarsie"],
  ["红钩", "紅鉤", "red hook"],
  ["戈瓦努斯", "戈瓦努斯", "gowanus"],
  ["展望莱弗茨花园", "展望萊弗茨花園", "prospect lefferts gardens", "plg"],

  ["长岛市", "長島市", "长岛城", "長島城", "long island city", "lic"],
  ["阿斯托里亚", "阿斯托里亞", "astoria"],
  ["阳光边", "陽光邊", "sunnyside"],
  ["伍德赛德", "伍德賽德", "woodside"],
  ["杰克逊高地", "傑克遜高地", "jackson heights"],
  ["艾姆赫斯特", "艾姆赫斯特", "elmhurst"],
  ["科罗娜", "科羅娜", "corona"],
  ["法拉盛", "法拉盛", "flushing"],
  ["新鲜草原", "新鮮草原", "fresh meadows"],
  ["森林小丘", "森林小丘", "森林山", "森林山", "forest hills"],
  ["雷哥公园", "雷哥公園", "rego park"],
  ["凯尤花园", "凱尤花園", "奇尤花园", "奇尤花園", "kew gardens"],
  ["里士满山", "里士滿山", "里士满丘", "里士滿丘", "richmond hill"],
  ["牙买加", "牙買加", "j​​amaica", "jamaica"],
  ["牙买加庄园", "牙買加莊園", "jamaica estates"],
  ["布里亚伍德", "布里亞伍德", "briarwood"],
  ["贝赛德", "貝賽德", "贝赛", "貝賽", "bayside"],
  ["道格拉斯顿", "道格拉斯頓", "douglaston"],
  ["小颈", "小頸", "little neck"],
  ["白石", "白石", "whitestone"],
  ["里奇伍德", "里奇伍德", "ridgewood"],
  ["马斯佩斯", "馬斯佩斯", "maspeth"],
  ["臭氧公园", "臭氧公園", "臭氧园", "臭氧園", "ozone park"],
  ["霍华德海滩", "霍華德海灘", "howard beach"],
  ["洛克威", "洛克威", "洛克威海滩", "洛克威海灘", "rockaway", "rockaway beach"],
  ["中村", "中村", "middle village"],
  ["劳雷尔顿", "勞雷爾頓", "laurelton"],
  ["圣奥尔本斯", "聖奧爾本斯", "st. albans", "st albans"],
  ["坎布里亚高地", "坎布里亞高地", "cambria heights"],

  ["河代尔", "河代爾", "河谷", "riverdale"],
  ["金斯布里奇", "金斯布里奇", "kingsbridge"],
  ["福特汉姆", "福特漢姆", "fordham"],
  ["贝尔蒙特", "貝爾蒙特", "belmont"],
  ["大学高地", "大學高地", "university heights"],
  ["莫里斯公园", "莫里斯公園", "morris park"],
  ["佩勒姆湾", "佩勒姆灣", "pelham bay"],
  ["索罗格斯颈", "索羅格斯頸", "索罗格颈", "索羅格頸", "throggs neck", "throgs neck"],
  ["莫特黑文", "莫特黑文", "mott haven"],
  ["康科斯", "康科斯", "the concourse", "concourse"],
  ["诺伍德", "諾伍德", "norwood"],
  ["城市岛", "城市島", "city island"],
  ["桑德维尤", "桑德維尤", "soundview"],

  ["圣乔治", "聖喬治", "st. george", "st george"],
  ["斯台普顿", "斯台普頓", "stapleton"],
  ["汤普金斯维尔", "湯普金斯維爾", "tompkinsville"],
  ["新斯普林维尔", "新斯普林維爾", "new springville"],
  ["新多普", "新多普", "new dorp"],
  ["大基尔斯", "大基爾斯", "great kills"],
  ["南海滩", "南海灘", "south beach"],
  ["托滕维尔", "托滕維爾", "tottenville"],
  ["休格诺", "休格諾", "huguenot"],

  ["大颈", "大頸", "great neck"],
  ["曼哈塞特", "曼哈塞特", "manhasset"],
  ["华盛顿港", "華盛頓港", "port washington"],
  ["米尼奥拉", "米尼奧拉", "mineola"],
  ["花园城", "花園城", "garden city"],
  ["亨普斯特德", "亨普斯特德", "hempstead"],
  ["尤宁代尔", "尤寧代爾", "uniondale"],
  ["西伯里", "西伯里", "westbury"],
  ["新海德公园", "新海德公園", "new hyde park"],
  ["花卉公园", "花卉公園", "floral park"],
  ["埃尔蒙特", "埃爾蒙特", "elmont"],
  ["富兰克林广场", "富蘭克林廣場", "franklin square"],
  ["谷溪", "谷溪", "山谷溪", "山谷溪", "valley stream"],
  ["洛克维尔中心", "洛克維爾中心", "rockville centre", "rockville center"],
  ["长滩", "長灘", "long beach"],
  ["海滨", "海濱", "奥申赛德", "奧申賽德", "oceanside"],
  ["林布鲁克", "林布魯克", "lynbrook"],
  ["弗里波特", "弗里波特", "freeport"],
  ["梅里克", "梅里克", "merrick"],
  ["贝尔莫", "貝爾莫", "bellmore"],
  ["旺塔", "旺塔", "wantagh"],
  ["马萨佩夸", "馬薩佩夸", "massapequa"],
  ["莱维敦", "萊維敦", "levittown"],
  ["希克斯维尔", "希克斯維爾", "hicksville"],
  ["普莱恩维尤", "普萊恩維尤", "plainview"],
  ["西奥塞特", "西奧塞特", "syosset"],
  ["杰里科", "傑里科", "jericho"],
  ["罗斯林", "羅斯林", "roslyn"],
  ["格伦科夫", "格倫科夫", "glen cove"],
  ["牡蛎湾", "牡蠣灣", "oyster bay"],
  ["贝思佩奇", "貝思佩奇", "bethpage"],
  ["东草原", "東草原", "east meadow"],
  ["西亨普斯特德", "西亨普斯特德", "west hempstead"],

  ["亨廷顿", "亨廷頓", "huntington"],
  ["亨廷顿站", "亨廷頓站", "huntington station"],
  ["冷泉港", "冷泉港", "cold spring harbor"],
  ["北港", "北港", "northport"],
  ["康马克", "康馬克", "commack"],
  ["史密斯敦", "史密斯敦", "smithtown"],
  ["霍波格", "霍波格", "hauppauge"],
  ["石溪", "石溪", "stony brook"],
  ["塞托基特", "塞托基特", "setauket"],
  ["杰斐逊港", "傑斐遜港", "port jefferson"],
  ["朗康科马", "朗康科馬", "ronkonkoma"],
  ["朗康科马湖", "朗康科馬湖", "lake ronkonkoma"],
  ["伊斯利普", "伊斯利普", "艾斯利普", "is​​lip", "islip"],
  ["湾岸", "灣岸", "bay shore"],
  ["巴比伦", "巴比倫", "babylon"],
  ["林登赫斯特", "林登赫斯特", "lindenhurst"],
  ["法明代尔", "法明代爾", "farmingdale"],
  ["梅尔维尔", "梅爾維爾", "melville"],
  ["布伦特伍德", "布倫特伍德", "brentwood"],
  ["中央伊斯利普", "中央伊斯利普", "central islip"],
  ["河头", "河頭", "riverhead"],
  ["帕乔格", "帕喬格", "patchogue"],
  ["东汉普顿", "東漢普頓", "east hampton"],
  ["南安普顿", "南安普頓", "southampton"],
  ["萨格港", "薩格港", "sag harbor"],
  ["谢尔特岛", "謝爾特島", "shelter island"],
  ["蒙托克", "蒙托克", "montauk"],
  ["阿马甘塞特", "阿馬甘塞特", "amagansett"],
  ["西汉普顿", "西漢普頓", "westhampton"],
  ["梅德福", "梅德福", "medford"],
  ["贝波特", "貝波特", "bayport"],
  ["鹿园", "鹿園", "deer park"],
  ["雪莉", "雪莉", "shirley"],
  ["马斯蒂克", "馬斯蒂克", "mastic"],
  ["塞尔登", "塞爾登", "selden"],
  ["森特里奇", "森特里奇", "centereach"],
  ["金斯公园", "金斯公園", "kings park"],
  ["肖勒姆", "肖勒姆", "shoreham"],
  ["韦丁河", "韋丁河", "wading river"],
] as const;

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const NORMALIZED_LOCATION_ALIAS_GROUPS = LOCATION_ALIAS_GROUPS.map((group) => group.map(normalizeSearchText));

function locationSearchVariants(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  NORMALIZED_LOCATION_ALIAS_GROUPS.forEach((group) => {
    if (group.some((alias) => normalized.includes(alias))) group.forEach((alias) => variants.add(alias));
  });
  return [...variants];
}

function listingLocationSearchText(listing: Listing) {
  return locationSearchVariants([listing.titleZh, listing.titleEn, listing.areaZh, listing.areaEn].join(" ")).join(" ");
}

function compressPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const maxDimension = 1400;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not prepare image"));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.onerror = () => reject(new Error("Could not read image"));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function uploadPhotoToR2(photoDataUrl: string, filename: string) {
  const blob = await fetch(photoDataUrl).then((response) => response.blob());
  const presignResponse = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType: blob.type || "image/jpeg", size: blob.size }),
  });
  const presignResult = await presignResponse.json() as { key?: string; uploadUrl?: string; publicUrl?: string; error?: string };
  if (!presignResponse.ok || !presignResult.key || !presignResult.uploadUrl || !presignResult.publicUrl) throw new Error(presignResult.error || "The image upload service is unavailable right now.");
  const uploadResponse = await fetch(presignResult.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  if (!uploadResponse.ok) throw new Error("The image could not be uploaded to storage. Check the R2 bucket CORS settings.");
  return { key: presignResult.key, url: presignResult.publicUrl };
}

const LISTINGS: Listing[] = [
  {
    id: "elmwood-light",
    titleZh: "树影公园旁的两居",
    titleEn: "Two bedrooms beside Elmwood Park",
    areaZh: "Queens · Forest Hills 一带",
    areaEn: "Queens · around Forest Hills",
    type: "entire",
    typeZh: "整套住房",
    typeEn: "Entire home",
    price: 3200,
    currency: "USD",
    bedrooms: "2",
    bathrooms: "1",
    moveIn: "Sep 01",
    lease: "12 months",
    image: "/listings/elmwood-light.png",
    features: ["furnished", "utilities", "laundry"],
    tagsZh: ["家具齐全", "包水费", "楼内洗衣房"],
    tagsEn: ["Furnished", "Water included", "Laundry in building"],
    freshnessZh: "今天更新",
    freshnessEn: "Updated today",
    posterZh: "房主 · 身份已核验",
    posterEn: "Owner · identity checked",
    privacyZh: "只显示大致区域",
    privacyEn: "Approximate area only",
  },
  {
    id: "harbor-window",
    titleZh: "带早餐角的明亮一居",
    titleEn: "Bright one-bedroom with a breakfast nook",
    areaZh: "Jersey City · Heights 一带",
    areaEn: "Jersey City · around the Heights",
    type: "entire",
    typeZh: "整套住房",
    typeEn: "Entire home",
    price: 2680,
    currency: "USD",
    bedrooms: "1",
    bathrooms: "1",
    moveIn: "Aug 15",
    lease: "12 months",
    image: "/listings/harbor-window.png",
    features: ["utilities", "parking", "pets"],
    tagsZh: ["采光好", "可养宠物", "停车位可询"],
    tagsEn: ["Daylight", "Pets considered", "Parking available"],
    freshnessZh: "2 小时前更新",
    freshnessEn: "Updated 2 hours ago",
    posterZh: "房产经纪 · 角色已核验",
    posterEn: "Agent · role checked",
    privacyZh: "接受看房后透露地址",
    privacyEn: "Address after tour acceptance",
  },
  {
    id: "cedar-room",
    titleZh: "近通勤线的独立房间",
    titleEn: "Private room near a commuter line",
    areaZh: "North York · Willowdale 一带",
    areaEn: "North York · around Willowdale",
    type: "privateRoom",
    typeZh: "独立房间",
    typeEn: "Private room",
    price: 1450,
    currency: "USD",
    bedrooms: "1",
    bathrooms: "1",
    moveIn: "Sep 01",
    lease: "6 months",
    image: "/listings/cedar-room.png",
    features: ["furnished", "utilities", "laundry", "pets"],
    tagsZh: ["家具齐全", "水电网全包", "短租可询"],
    tagsEn: ["Furnished", "Utilities included", "Short lease possible"],
    freshnessZh: "昨天更新",
    freshnessEn: "Updated yesterday",
    posterZh: "房主 · 地点已核验",
    posterEn: "Owner · location checked",
    privacyZh: "精确地址由发布者决定",
    privacyEn: "Poster controls the exact address",
  },
  {
    id: "sunset-sublet",
    titleZh: "带露台的短租转租",
    titleEn: "A terrace sublet for the fall",
    areaZh: "Brooklyn · Sunset Park 一带",
    areaEn: "Brooklyn · around Sunset Park",
    type: "sublet",
    typeZh: "转租",
    typeEn: "Sublet",
    price: 2350,
    currency: "USD",
    bedrooms: "1",
    bathrooms: "1",
    moveIn: "Sep 15",
    lease: "4 months",
    image: "/listings/sunset-sublet.png",
    features: ["furnished", "utilities", "parking"],
    tagsZh: ["带家具", "露台", "租期灵活"],
    tagsEn: ["Furnished", "Terrace", "Flexible term"],
    freshnessZh: "3 天前更新",
    freshnessEn: "Updated 3 days ago",
    posterZh: "租客转租 · 房源资料待复核",
    posterEn: "Tenant sublet · listing review pending",
    privacyZh: "看房流程中透露地址",
    privacyEn: "Address revealed in the tour flow",
  },
];

const copy = {
  zh: {
    workingTitle: "工作名称 · 未定品牌",
    findRentals: "找房",
    saved: "收藏",
    messages: "消息",
    post: "发布房源",
    pilot: "示例库存 · synthetic pilot inventory",
    heading: "先把住处看明白",
    subheading:
      "比较租金、租期和房源信号。精确地址不会出现在公开页面，发布者会在合适的看房流程中决定是否透露。",
    saveSearch: "保存这组搜索",
    savedSearch: "搜索已保存",
    filters: "筛选条件",
    reset: "重置",
    location: "位置、大学或地标",
    locationPlaceholder: "例如 皇后区 / Queens",
    maxPrice: "最高月租",
    anyPrice: "不限",
    type: "房源类型",
    allTypes: "全部类型",
    entire: "整套住房",
    privateRoom: "独立房间",
    sublet: "转租",
    moveIn: "入住时间",
    anytime: "随时可入住",
    more: "更多条件",
    less: "收起条件",
    furnished: "家具齐全",
    utilities: "包含部分费用",
    parking: "停车",
    pets: "宠物友好",
    laundry: "楼内洗衣房",
    inUnitLaundry: "室内洗衣机",
    airConditioning: "空调",
    dishwasher: "洗碗机",
    balcony: "阳台 / 露台",
    elevator: "电梯",
    gym: "健身房",
    doorman: "门卫 / 前台",
    storage: "储物空间",
    immediate: "立即入住",
    chooseDate: "指定入住日期",
    august: "2026年8月",
    september: "2026年9月",
    october: "2026年10月",
    search: "查找房源",
    approximate: "公开页面只显示大致区域",
    results: "符合条件的房源",
    syntheticNotice: "示例房源用于体验流程，不代表已上线库存或商业报价。",
    sort: "排序",
    bestFit: "最匹配",
    lowest: "租金从低到高",
    fresh: "最近更新",
    compare: "比较",
    comparing: "正在比较",
    view: "查看房源",
    contact: "开始联系",
    month: "/月",
    monthly: "月租",
    costBreakdown: "USD 月租",
    costNote: "月租明确；押金、水电和其他费用请向发布者确认",
    locationChecked: "地点已核验",
    availability: "近期确认有房",
    photoCount: "张照片",
    verifiedEmail: "邮箱已验证",
    sampleSignal: "示例体验",
    localSignal: "本地预览",
    identity: "身份信号",
    addressPrivate: "精确地址暂不公开",
    detail: "房源详情",
    close: "关闭",
    detailsIntro: "公开信息先回答基本问题；精确地址要等到发布者接受合适的看房安排后再提供。",
    detailArea: "大致区域",
    detailMoveIn: "预计入住",
    detailLease: "最短租期",
    detailPoster: "发布者信号",
    detailAmenities: "房源特点",
    detailDescription: "房源介绍",
    requestTour: "联系并请求看房",
    privacyGuideTitle: "地址隐私是流程的一部分",
    privacyGuideBody: "我们公开大致区域和结构化房源信息；发布者可以在对话中确认需求，再决定是否给出精确地址。",
    trustTitle: "每一个信号都说明检查了什么",
    trustBody: "地点、身份和近期可用性分开显示，不用一个模糊的徽章代替解释。",
    conversationTitle: "先问清楚，再留下联系方式",
    conversationBody: "联系表单只询问入住时间、租期、居住人数和看房偏好，不收集社保号、信用资料或受保护特征。",
    contactTitle: "开始一次有用的对话",
    contactIntro: "这些结构化信息会随你的消息一起发送给发布者。",
    intendedMove: "预计入住",
    leaseLength: "期望租期",
    occupants: "居住人数",
    petsQuestion: "是否有宠物",
    noPets: "没有",
    yesPets: "有，稍后说明",
    message: "补充消息（可选）",
    messagePlaceholder: "例如：想了解周末看房时间……",
    sendInquiry: "发送咨询",
    inquirySent: "咨询草稿已准备好（示例模式）",
    postTitle: "发布一个完整房源",
    postIntro: "从地址和照片开始，逐步补充租期、费用、隐私和看房设置。",
    stageProperty: "房源与角色",
    stageTerms: "租赁条件",
    stageStory: "照片与介绍",
    stageContact: "联系与看房",
    stagePublish: "核验、预览、发布",
    polishTitle: "AI 润色房源文案",
    polishIntro: "根据你填写的事实优化中文文案，不编造设施或承诺。精确地址不会发送给 AI。",
    polishAction: "用 AI 润色",
    polishLoading: "正在润色…",
    polishApplied: "AI 文案已写入，请发布前复核",
    polishLocal: "已使用本地润色预览；配置 API Key 后可启用 AI",
    polishError: "AI 润色暂时不可用，请稍后重试。",
    startDraft: "开始草稿",
    draftStarted: "草稿已创建（示例模式）",
    clear: "清除条件",
    noResults: "没有找到符合这些条件的房源",
    noResultsBody: "试试放宽最高月租、位置或房源类型。",
    clearAndTry: "清除筛选并重试",
    notification: "提醒",
    language: "English",
    account: "账户",
  },
  en: {
    workingTitle: "Working name · brand TBD",
    findRentals: "Find rentals",
    saved: "Saved",
    messages: "Messages",
    post: "Post a listing",
    pilot: "Synthetic pilot inventory",
    heading: "Make the next move clear",
    subheading:
      "Compare rent, terms, and listing signals in one place. Exact addresses stay off public pages until the poster chooses to reveal one in the tour flow.",
    saveSearch: "Save this search",
    savedSearch: "Search saved",
    filters: "Filter desk",
    reset: "Reset",
    location: "Location, university, or landmark",
    locationPlaceholder: "Try 皇后区 / Queens",
    maxPrice: "Maximum monthly rent",
    anyPrice: "Any price",
    type: "Rental type",
    allTypes: "All types",
    entire: "Entire home",
    privateRoom: "Private room",
    sublet: "Sublet",
    moveIn: "Move-in",
    anytime: "Any move-in date",
    more: "More filters",
    less: "Fewer filters",
    furnished: "Furnished",
    utilities: "Utilities included",
    parking: "Parking",
    pets: "Pet-friendly",
    laundry: "Laundry in building",
    inUnitLaundry: "In-unit laundry",
    airConditioning: "Air conditioning",
    dishwasher: "Dishwasher",
    balcony: "Balcony / terrace",
    elevator: "Elevator",
    gym: "Gym",
    doorman: "Doorman / front desk",
    storage: "Storage",
    immediate: "Move in immediately",
    chooseDate: "Choose a move-in date",
    august: "Aug 2026",
    september: "Sep 2026",
    october: "Oct 2026",
    search: "Search rentals",
    approximate: "Public pages show an approximate area only",
    results: "Matching rentals",
    syntheticNotice: "Sample listings demonstrate the workflow and are not live inventory or commercial offers.",
    sort: "Sort",
    bestFit: "Best fit",
    lowest: "Lowest rent",
    fresh: "Recently updated",
    compare: "Compare",
    comparing: "Comparing",
    view: "View listing",
    contact: "Start a conversation",
    month: "/mo",
    monthly: "monthly",
    costBreakdown: "USD monthly",
    costNote: "Monthly rent is shown; confirm deposits, utilities, and other fees with the poster",
    locationChecked: "Location checked",
    availability: "Availability recent",
    photoCount: "photos",
    verifiedEmail: "Verified email",
    sampleSignal: "Sample preview",
    localSignal: "Local preview",
    identity: "Identity signal",
    addressPrivate: "Exact address stays private",
    detail: "Listing detail",
    close: "Close",
    detailsIntro: "Public facts answer the first questions. The exact address follows only after the poster accepts an appropriate tour arrangement.",
    detailArea: "Approximate area",
    detailMoveIn: "Move-in",
    detailLease: "Minimum lease",
    detailPoster: "Poster signals",
    detailAmenities: "Listing details",
    detailDescription: "About this home",
    requestTour: "Contact and request a tour",
    privacyGuideTitle: "Address privacy is part of the workflow",
    privacyGuideBody: "We publish an approximate area and structured rental facts. The poster can understand a renter's needs in conversation before choosing whether to share the exact address.",
    trustTitle: "Every signal says what was checked",
    trustBody: "Location, identity, and recent availability stay separate so one vague badge never stands in for an explanation.",
    conversationTitle: "Ask what matters before sharing contact details",
    conversationBody: "The inquiry form asks only for move-in timing, lease length, occupants, and tour preference—not SSN, credit files, or protected traits.",
    contactTitle: "Start a useful conversation",
    contactIntro: "These structured answers travel with your message to the poster.",
    intendedMove: "Intended move-in",
    leaseLength: "Lease length",
    occupants: "Occupants",
    petsQuestion: "Pets",
    noPets: "No pets",
    yesPets: "Yes, I can share details",
    message: "Optional message",
    messagePlaceholder: "For example: I would love to see it on a weekend…",
    sendInquiry: "Send inquiry",
    inquirySent: "Inquiry draft prepared (sample mode)",
    postTitle: "Publish a complete listing",
    postIntro: "Start with an address and photos, then add terms, fees, privacy, and tour settings step by step.",
    stageProperty: "Property and role",
    stageTerms: "Rental terms",
    stageStory: "Photos and story",
    stageContact: "Contact and tours",
    stagePublish: "Verify, preview, publish",
    polishTitle: "AI listing polish",
    polishIntro: "Polish the Chinese listing copy from the facts you provide. The exact address never goes to AI.",
    polishAction: "Polish with AI",
    polishLoading: "Polishing…",
    polishApplied: "AI copy applied — review before publishing",
    polishLocal: "Local polish preview applied; add an API key to enable AI",
    polishError: "AI polishing is unavailable right now. Try again shortly.",
    startDraft: "Start a draft",
    draftStarted: "Draft created (sample mode)",
    clear: "Clear filters",
    noResults: "No rentals match those conditions",
    noResultsBody: "Try loosening the maximum rent, location, or rental type.",
    clearAndTry: "Clear filters and try again",
    notification: "Notifications",
    language: "中文",
    account: "Account",
  },
} as const;

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

function GalleryIcon({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m5.5 17 4.2-4 3.1 2.7 2.1-2 3.6 3.3" />
    </svg>
  );
}

function HeartIcon({ size = 18, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 8.9c0 5.1-8.8 10.3-8.8 10.3S3.2 14 3.2 8.9A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.7Z" />
    </svg>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 19 6v5c0 4.4-2.8 8-7 10-4.2-2-7-5.6-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function PinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

function SlidersIcon({ size = 17 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ChevronIcon({ size = 14, direction }: { size?: number; direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "up" ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"} />
    </svg>
  );
}

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ChatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v4a3.5 3.5 0 0 1-3.5 3.5H11l-4.5 4v-4.8A3.5 3.5 0 0 1 5 10.5v-4Z" />
      <path d="M9 8h6M9 11h3" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function formatPrice(listing: Listing) {
  return `$${listing.price.toLocaleString("en-US")} ${listing.currency}`;
}

function listingPhotos(listing: Listing) {
  const photos = Array.isArray(listing.photos) ? listing.photos.filter((photo): photo is string => typeof photo === "string" && photo.length > 0) : [];
  return photos.length > 0 ? photos : listing.image ? [listing.image] : [];
}

function moveInMonth(value: string) {
  const isoMonth = value.match(/^\d{4}-(\d{2})-\d{2}$/)?.[1];
  if (isoMonth) return ({ "08": "august", "09": "september", "10": "october" } as Record<string, string>)[isoMonth] || "";
  const shortMonth = value.trim().slice(0, 3).toLowerCase();
  return ({ aug: "august", sep: "september", oct: "october" } as Record<string, string>)[shortMonth] || "";
}

function formatMoveIn(value: string, locale: Locale) {
  if (value === "immediate") return locale === "zh" ? "立即入住" : "Move in immediately";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return locale === "zh"
    ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [locationInput, setLocationInput] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rentalType, setRentalType] = useState<RentalType>("all");
  const [sortMode, setSortMode] = useState<SortMode>("fit");
  const [moveIn, setMoveIn] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [savedSearch, setSavedSearch] = useState(false);
  const [savedSearchSnapshot, setSavedSearchSnapshot] = useState<SearchSnapshot | null>(null);
  const [customListings, setCustomListings] = useState<Listing[]>([]);
  const [remoteListings, setRemoteListings] = useState<Listing[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [serverInquiries, setServerInquiries] = useState<DashboardInquiry[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"listings" | "inquiries">("listings");
  const [dashboardListings, setDashboardListings] = useState<DashboardListing[]>([]);
  const [receivedInquiries, setReceivedInquiries] = useState<DashboardInquiry[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState("");
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [draft, setDraft] = useState<ListingDraft>(EMPTY_DRAFT);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [contactListing, setContactListing] = useState<Listing | null>(null);
  const [selectedInquiryComments, setSelectedInquiryComments] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [postStep, setPostStep] = useState<PostStep>(1);
  const [postError, setPostError] = useState("");
  const [aiPolishLoading, setAiPolishLoading] = useState(false);
  const [aiPolishError, setAiPolishError] = useState("");
  const [aiPolishSource, setAiPolishSource] = useState<"openai" | "local" | null>(null);
  const [aiPolishNotes, setAiPolishNotes] = useState<string[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const inquirySequence = useRef(0);
  const t = copy[locale];
  const searchSnapshot = useMemo<SearchSnapshot>(() => ({
    location: appliedLocation,
    maxPrice,
    rentalType,
    moveIn,
    activeFeatures,
    sortMode,
  }), [activeFeatures, appliedLocation, maxPrice, moveIn, rentalType, sortMode]);
  const savedSearchIsCurrent = Boolean(savedSearch && savedSearchSnapshot && JSON.stringify(searchSnapshot) === JSON.stringify(savedSearchSnapshot));

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const storedLocale = window.localStorage.getItem(STORAGE_KEYS.locale);
        const storedSavedIds = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedIds) || "[]");
        const storedListings = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.customListings) || "[]");
        const storedInquiries = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.inquiries) || "[]");
        const storedDraft = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.draft) || "null");
        const storedSearchSnapshot = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedSearchSnapshot) || "null");
        const storedEditingListingId = window.localStorage.getItem(STORAGE_KEYS.editingListingId);
        const params = new URLSearchParams(window.location.search);
        const hasUrlSearch = ["location", "max", "type", "move", "features", "sort"].some((key) => params.has(key));
        const urlMax = params.get("max");
        const urlType = params.get("type");
        const urlSort = params.get("sort");
        const urlSnapshot: SearchSnapshot = {
          location: params.get("location") || "",
          maxPrice: urlMax === "1800" || urlMax === "2400" || urlMax === "3000" || urlMax === "3500" ? urlMax : "",
          rentalType: urlType === "entire" || urlType === "privateRoom" || urlType === "sublet" ? urlType : "all",
          moveIn: params.get("move") === "august" || params.get("move") === "september" || params.get("move") === "october" ? params.get("move") || "" : "",
          activeFeatures: (params.get("features") || "").split(",").filter((feature): feature is string => POST_FEATURE_KEYS.includes(feature as typeof POST_FEATURE_KEYS[number])),
          sortMode: urlSort === "price" || urlSort === "fresh" ? urlSort : "fit",
        };
        const storedSnapshotRecord = storedSearchSnapshot && typeof storedSearchSnapshot === "object" ? storedSearchSnapshot as Partial<SearchSnapshot> : null;
        const localSnapshot: SearchSnapshot | null = storedSnapshotRecord ? {
          location: typeof storedSnapshotRecord.location === "string" ? storedSnapshotRecord.location : "",
          maxPrice: typeof storedSnapshotRecord.maxPrice === "string" ? storedSnapshotRecord.maxPrice : "",
          rentalType: storedSnapshotRecord.rentalType === "entire" || storedSnapshotRecord.rentalType === "privateRoom" || storedSnapshotRecord.rentalType === "sublet" ? storedSnapshotRecord.rentalType : "all",
          moveIn: storedSnapshotRecord.moveIn === "august" || storedSnapshotRecord.moveIn === "september" || storedSnapshotRecord.moveIn === "october" ? storedSnapshotRecord.moveIn : "",
          activeFeatures: Array.isArray(storedSnapshotRecord.activeFeatures) ? storedSnapshotRecord.activeFeatures.filter((feature): feature is string => typeof feature === "string" && POST_FEATURE_KEYS.includes(feature as typeof POST_FEATURE_KEYS[number])) : [],
          sortMode: storedSnapshotRecord.sortMode === "price" || storedSnapshotRecord.sortMode === "fresh" ? storedSnapshotRecord.sortMode : "fit",
        } : null;
        const initialSearch = hasUrlSearch ? urlSnapshot : localSnapshot;
        if (storedLocale === "zh" || storedLocale === "en") setLocale(storedLocale);
        if (Array.isArray(storedSavedIds)) setSavedIds(new Set(storedSavedIds.filter((id): id is string => typeof id === "string")));
        if (Array.isArray(storedListings)) setCustomListings(storedListings);
        if (Array.isArray(storedInquiries)) setInquiries(storedInquiries);
        if (storedEditingListingId) setEditingListingId(storedEditingListingId);
        if (storedDraft && typeof storedDraft === "object") {
          const storedDraftRecord = storedDraft as Partial<ListingDraft> & { moveIn?: unknown; photos?: unknown; photoKeys?: unknown };
          const legacyMoveIn = typeof storedDraftRecord.moveIn === "string" ? storedDraftRecord.moveIn : "";
          setDraft({
            ...EMPTY_DRAFT,
            ...storedDraftRecord,
            currency: "USD",
            moveInMode: storedDraftRecord.moveInMode === "date" || (legacyMoveIn && legacyMoveIn !== "immediate") ? "date" : "immediate",
            moveInDate: typeof storedDraftRecord.moveInDate === "string" ? storedDraftRecord.moveInDate : legacyMoveIn !== "immediate" ? legacyMoveIn : "",
            photos: Array.isArray(storedDraftRecord.photos) ? storedDraftRecord.photos : [],
            photoKeys: Array.isArray(storedDraftRecord.photoKeys) ? storedDraftRecord.photoKeys.filter((key): key is string => typeof key === "string") : [],
          });
        }
        if (initialSearch) {
          setLocationInput(initialSearch.location);
          setAppliedLocation(initialSearch.location);
          setMaxPrice(initialSearch.maxPrice);
          setRentalType(initialSearch.rentalType);
          setMoveIn(initialSearch.moveIn);
          setActiveFeatures(initialSearch.activeFeatures);
          setSortMode(initialSearch.sortMode);
        }
        setSavedSearch(window.localStorage.getItem(STORAGE_KEYS.savedSearch) === "true" || Boolean(localSnapshot));
        setSavedSearchSnapshot(localSnapshot);
      } catch {
        // Local storage is optional; the app remains usable in private browsing modes.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const verification = params.get("verified");
    const google = params.get("google");
    if (!verification && !google) return;
    const message = verification === "success"
      ? (locale === "zh" ? "邮箱已验证，请重新打开账户状态。" : "Email verified. Refresh your account status if needed.")
      : (locale === "zh" ? "验证链接无效或已过期。" : "That verification link is invalid or expired.");
    const authMessage = google === "success"
      ? (locale === "zh" ? "Google 登录成功" : "Google sign-in complete")
      : google
        ? (locale === "zh" ? "Google 登录未完成，请重试" : "Google sign-in was not completed")
        : message;
    params.delete("verified");
    params.delete("google");
    const remainingSearch = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${remainingSearch ? `?${remainingSearch}` : ""}${window.location.hash}`);
    const showTimer = window.setTimeout(() => setVerificationNotice(authMessage), 0);
    const clearTimer = window.setTimeout(() => setVerificationNotice(""), 5200);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(clearTimer);
    };
  }, [hydrated, locale]);

  useEffect(() => {
    if (!hydrated) return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { user?: AuthUser | null };
        setCurrentUser(result.user || null);
      })
      .catch(() => {
        // Anonymous browsing remains available when account services are offline.
      });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.locale, locale);
      window.localStorage.setItem(STORAGE_KEYS.savedIds, JSON.stringify([...savedIds]));
      window.localStorage.setItem(STORAGE_KEYS.savedSearch, String(savedSearch));
      if (savedSearchSnapshot) window.localStorage.setItem(STORAGE_KEYS.savedSearchSnapshot, JSON.stringify(savedSearchSnapshot));
      else window.localStorage.removeItem(STORAGE_KEYS.savedSearchSnapshot);
      window.localStorage.setItem(STORAGE_KEYS.customListings, JSON.stringify(customListings));
      window.localStorage.setItem(STORAGE_KEYS.inquiries, JSON.stringify(inquiries));
      window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
      if (editingListingId) window.localStorage.setItem(STORAGE_KEYS.editingListingId, editingListingId);
      else window.localStorage.removeItem(STORAGE_KEYS.editingListingId);
    } catch {
      // A full local storage quota should not block browsing or searching.
    }
  }, [customListings, draft, editingListingId, hydrated, inquiries, locale, savedIds, savedSearch, savedSearchSnapshot]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string, defaultValue = "") => {
      if (value && value !== defaultValue) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("location", searchSnapshot.location);
    setOrDelete("max", searchSnapshot.maxPrice);
    setOrDelete("type", searchSnapshot.rentalType, "all");
    setOrDelete("move", searchSnapshot.moveIn);
    setOrDelete("features", searchSnapshot.activeFeatures.join(","));
    setOrDelete("sort", searchSnapshot.sortMode, "fit");
    const nextSearch = params.toString() ? `?${params.toString()}` : "";
    if (window.location.search !== nextSearch) window.history.replaceState({}, "", `${window.location.pathname}${nextSearch}${window.location.hash}`);
  }, [hydrated, searchSnapshot]);

  useEffect(() => {
    if (!hydrated || !currentUser || !currentUser.emailVerified || savedSearchSnapshot) return;
    const params = new URLSearchParams(window.location.search);
    if (["location", "max", "type", "move", "features", "sort"].some((key) => params.has(key))) return;
    let cancelled = false;
    fetch("/api/saved-search", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as (SearchSnapshot & { updatedAt?: string }) | null;
        if (!cancelled && result) {
          const snapshot: SearchSnapshot = {
            location: result.location || "",
            maxPrice: result.maxPrice || "",
            rentalType: result.rentalType || "all",
            moveIn: result.moveIn || "",
            activeFeatures: Array.isArray(result.activeFeatures) ? result.activeFeatures : [],
            sortMode: result.sortMode || "fit",
          };
          setLocationInput(snapshot.location);
          setAppliedLocation(snapshot.location);
          setMaxPrice(snapshot.maxPrice);
          setRentalType(snapshot.rentalType);
          setMoveIn(snapshot.moveIn);
          setActiveFeatures(snapshot.activeFeatures);
          setSortMode(snapshot.sortMode);
          setSavedSearchSnapshot(snapshot);
          setSavedSearch(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentUser, hydrated, savedSearchSnapshot]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch("/api/listings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as unknown;
        if (!cancelled && Array.isArray(result)) setRemoteListings(result as Listing[]);
      })
      .catch(() => {
        // The local sample inventory remains available when the database is offline.
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!accountOpen || !currentUser) return;
    let cancelled = false;
    const loadDashboard = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setDashboardLoading(true);
      setDashboardError("");
      try {
        const [listingsResponse, inquiriesResponse] = await Promise.all([
          fetch("/api/my/listings", { cache: "no-store" }),
          fetch("/api/inquiries?scope=received", { cache: "no-store" }),
        ]);
        if (!listingsResponse.ok || !inquiriesResponse.ok) throw new Error("Dashboard data is unavailable right now.");
        const [listings, inquiries] = await Promise.all([listingsResponse.json(), inquiriesResponse.json()]);
        if (!cancelled) {
          setDashboardListings(Array.isArray(listings) ? listings as DashboardListing[] : []);
          setReceivedInquiries(Array.isArray(inquiries) ? inquiries as DashboardInquiry[] : []);
        }
      } catch (error) {
        if (!cancelled) setDashboardError(error instanceof Error ? error.message : "Dashboard data is unavailable right now.");
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    };
    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [accountOpen, currentUser]);

  useEffect(() => {
    if (!messagesOpen || !currentUser) return;
    fetch("/api/inquiries", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result)) setServerInquiries(result as DashboardInquiry[]);
      })
      .catch(() => {
        // Local inquiry history remains visible if shared inquiry history is unavailable.
      });
  }, [currentUser, messagesOpen]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const openListing = (listing: Listing) => {
    setSelectedPhotoIndex(0);
    setSelectedListing(listing);
  };

  const allListings = useMemo(
    () => [...remoteListings, ...customListings, ...(remoteListings.length > 0 ? [] : LISTINGS)],
    [customListings, remoteListings],
  );

  const filteredListings = useMemo(() => {
    const queryVariants = locationSearchVariants(appliedLocation);
    const ceiling = maxPrice ? Number(maxPrice) : Number.POSITIVE_INFINITY;
    const filtered = allListings.filter((listing) => {
      const searchable = listingLocationSearchText(listing);
      const matchesLocation = queryVariants.length === 0 || queryVariants.some((variant) => searchable.includes(variant));
      const matchesPrice = listing.price <= ceiling;
      const matchesType = rentalType === "all" || listing.type === rentalType;
      const matchesMoveIn = !moveIn || listing.moveIn === "immediate" || moveInMonth(listing.moveIn) === moveIn;
      const matchesFeatures = activeFeatures.every((feature) => listing.features.includes(feature));
      return matchesLocation && matchesPrice && matchesType && matchesMoveIn && matchesFeatures;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "price") return a.price - b.price;
      return allListings.indexOf(a) - allListings.indexOf(b);
    });
  }, [activeFeatures, allListings, appliedLocation, maxPrice, moveIn, rentalType, sortMode]);

  const compareListings = allListings.filter((listing) => compareIds.includes(listing.id));
  const savedListings = allListings.filter((listing) => savedIds.has(listing.id));
  const messageInquiries = [...serverInquiries, ...inquiries];

  const updateDraft = (updates: Partial<ListingDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
    setDraftSavedAt(1);
    setPostError("");
    setAiPolishError("");
  };

  const openPostFlow = () => {
    if (!currentUser) {
      setAuthMode("login");
      setAuthError(locale === "zh" ? "请先登录，再发布房源。" : "Sign in before publishing a listing.");
      setAuthOpen(true);
      return;
    }
    if (!currentUser.emailVerified) {
      setAccountOpen(true);
      setDashboardTab("listings");
      showToast(locale === "zh" ? "请先验证邮箱，再发布房源" : "Verify your email before publishing a listing");
      return;
    }
    setPostOpen(true);
    setEditingListingId(null);
    setPostStep(1);
    setDraft((current) => ({ ...current, contactName: current.contactName || currentUser.displayName, contactEmail: current.contactEmail || currentUser.email }));
    setPostError("");
    setAiPolishError("");
    setAiPolishSource(null);
    setAiPolishNotes([]);
  };

  const openAccount = () => {
    if (!currentUser) {
      setAuthMode("login");
      setAuthError("");
      setAuthOpen(true);
      return;
    }
    setAccountOpen(true);
    setDashboardTab("listings");
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authLoading) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      ...(authMode === "register" ? { displayName: String(formData.get("displayName") || "") } : {}),
    };
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetch(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { user?: AuthUser; verificationSent?: boolean; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || (locale === "zh" ? "账户操作失败。" : "Account action failed."));
      setCurrentUser(result.user);
      setAuthOpen(false);
      setAuthError("");
      showToast(authMode === "register"
        ? (result.verificationSent ? (locale === "zh" ? "账户已创建，验证邮件已发送" : "Account created; verification email sent") : (locale === "zh" ? "账户已创建，请配置或重新发送验证邮件" : "Account created; verification email is not configured yet"))
        : (locale === "zh" ? "已登录" : "Signed in"));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : (locale === "zh" ? "账户操作失败。" : "Account action failed."));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCurrentUser(null);
    setAccountOpen(false);
    setServerInquiries([]);
    setDashboardListings([]);
    setReceivedInquiries([]);
    showToast(locale === "zh" ? "已退出登录" : "Signed out");
  };

  const handleResendVerification = async () => {
    if (resendLoading) return;
    setResendLoading(true);
    setResendError("");
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const result = await response.json() as { sent?: boolean; alreadyVerified?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "The verification email could not be sent.");
      if (result.alreadyVerified) {
        setCurrentUser((current) => current ? { ...current, emailVerified: true } : current);
        showToast(locale === "zh" ? "邮箱已经验证" : "Email is already verified");
      } else if (result.sent) {
        showToast(locale === "zh" ? "验证邮件已重新发送" : "Verification email resent");
      } else {
        showToast(locale === "zh" ? "验证邮件暂未发送，请检查 Resend 配置" : "Verification email was not sent; check the Resend configuration");
      }
    } catch (error) {
      setResendError(error instanceof Error ? error.message : "The verification email could not be sent.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleDashboardStatus = async (id: string, status: "published" | "unpublished") => {
    try {
      const response = await fetch(`/api/my/listings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Listing status could not be updated.");
      setDashboardListings((current) => current.map((listing) => listing.id === id ? { ...listing, status } : listing));
      const listingResponse = await fetch("/api/listings", { cache: "no-store" });
      if (listingResponse.ok) {
        const listings = await listingResponse.json();
        if (Array.isArray(listings)) setRemoteListings(listings as Listing[]);
      }
      showToast(status === "published" ? (locale === "zh" ? "房源已重新发布" : "Listing republished") : (locale === "zh" ? "房源已下架" : "Listing unpublished"));
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Listing status could not be updated.");
    }
  };

  const viewDashboardListing = (id: string) => {
    const listing = dashboardListings.find((item) => item.id === id) || allListings.find((item) => item.id === id);
    if (listing) {
      openListing(listing);
      setAccountOpen(false);
    }
  };

  const editDashboardListing = (id: string) => {
    const listing = dashboardListings.find((item) => item.id === id);
    if (!listing) return;
    const moveInIsImmediate = listing.moveIn === "immediate" || !listing.moveIn;
    const leaseMonths = listing.lease.match(/\d+/)?.[0] || "12";
    setDraft({
      ...EMPTY_DRAFT,
      titleZh: listing.titleZh,
      titleEn: listing.titleEn,
      areaZh: listing.areaZh,
      areaEn: listing.areaEn,
      privateAddress: listing.privateAddress,
      posterRole: listing.posterRole || "owner",
      rentalType: listing.type,
      price: String(listing.price || ""),
      currency: "USD",
      bedrooms: listing.bedrooms || "1",
      bathrooms: listing.bathrooms || "1",
      moveInMode: moveInIsImmediate ? "immediate" : "date",
      moveInDate: moveInIsImmediate ? "" : listing.moveIn,
      lease: leaseMonths,
      features: listing.features || [],
      descriptionZh: listing.descriptionZh || "",
      descriptionEn: listing.descriptionEn || "",
      photos: listing.photos || [],
      photoKeys: listing.photoKeys || [],
      contactName: listing.contactName || currentUser?.displayName || "",
      contactEmail: listing.contactEmail || currentUser?.email || "",
      tourPreference: listing.tourPreference || "flexible",
    });
    setEditingListingId(id);
    setPostStep(1);
    setPostError("");
    setAiPolishError("");
    setAiPolishSource(null);
    setAiPolishNotes([]);
    setAccountOpen(false);
    setPostOpen(true);
  };

  const toggleSaved = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) {
        showToast(locale === "zh" ? "最多比较两个房源" : "Compare up to two listings");
        return current;
      }
      return [...current, id];
    });
  };

  const toggleFeature = (feature: string) => {
    setActiveFeatures((current) => (current.includes(feature) ? current.filter((item) => item !== feature) : [...current, feature]));
  };

  const resetFilters = () => {
    setLocationInput("");
    setAppliedLocation("");
    setMaxPrice("");
    setRentalType("all");
    setMoveIn("");
    setActiveFeatures([]);
    showToast(locale === "zh" ? "筛选条件已重置" : "Filters reset");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedLocation(locationInput);
    showToast(locale === "zh" ? "筛选已应用" : "Filters applied");
  };

  const toggleSavedSearch = async () => {
    const removing = savedSearch && savedSearchIsCurrent;
    if (removing) {
      setSavedSearch(false);
      setSavedSearchSnapshot(null);
      if (currentUser?.emailVerified) {
        const response = await fetch("/api/saved-search", { method: "DELETE" }).catch(() => null);
        if (response && !response.ok) showToast(locale === "zh" ? "本地已取消保存，账户同步稍后重试" : "Removed locally; account sync can retry later");
      }
      showToast(locale === "zh" ? "已取消保存搜索" : "Saved search removed");
      return;
    }

    const snapshot = { ...searchSnapshot, activeFeatures: [...searchSnapshot.activeFeatures] };
    setSavedSearch(true);
    setSavedSearchSnapshot(snapshot);
    if (currentUser?.emailVerified) {
      const response = await fetch("/api/saved-search", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      }).catch(() => null);
      if (response && !response.ok) showToast(locale === "zh" ? "已在本地保存，账户同步稍后重试" : "Saved locally; account sync can retry later");
      else showToast(locale === "zh" ? "搜索已保存到账户" : "Search saved to your account");
    } else {
      showToast(locale === "zh" ? "搜索已保存到此浏览器" : "Search saved in this browser");
    }
  };

  const openContact = (listing: Listing) => {
    setContactListing(listing);
    setSelectedInquiryComments([]);
    setInquiryError("");
  };

  const closeContact = () => {
    setContactListing(null);
    setSelectedInquiryComments([]);
  };

  const submitInquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactListing || inquirySubmitting) return;
    const formData = new FormData(event.currentTarget);
    const selectedCommentText = selectedInquiryComments.map((value) => {
      const option = INQUIRY_COMMENT_OPTIONS.find((item) => item.value === value);
      return option ? `• ${locale === "zh" ? option.zh : option.en}` : "";
    }).filter((comment) => comment.length > 0);
    const freeformMessage = String(formData.get("message") || "").trim();
    const message = [...selectedCommentText, freeformMessage].filter((comment) => comment.length > 0).join("\n");
    const inquiry: Inquiry = {
      id: `inquiry-${inquirySequence.current++}`,
      listingId: contactListing.id,
      listingTitle: listingTitle(contactListing),
      sentAt: new Date().toISOString(),
      moveIn: String(formData.get("moveIn") || ""),
      leaseLength: String(formData.get("leaseLength") || ""),
      occupants: String(formData.get("occupants") || ""),
      pets: String(formData.get("pets") || ""),
      tourPreference: String(formData.get("tourPreference") || ""),
      message,
      status: "sent",
    };
    if (contactListing.source === "remote") {
      if (!currentUser) {
        setAuthMode("login");
        setAuthError(locale === "zh" ? "请先登录，再发送咨询。" : "Sign in before sending an inquiry.");
        setAuthOpen(true);
        return;
      }
      if (!currentUser.emailVerified) {
        setInquiryError(locale === "zh" ? "请先验证邮箱，再发送咨询。" : "Verify your email before sending an inquiry.");
        closeContact();
        setAccountOpen(true);
        setDashboardTab("listings");
        return;
      }
      setInquirySubmitting(true);
      try {
        const response = await fetch("/api/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inquiry),
        });
        const result = await response.json() as DashboardInquiry & { error?: string; confirmationSent?: boolean };
        if (!response.ok) throw new Error(result.error || "The inquiry could not be sent.");
        setServerInquiries((current) => [result, ...current]);
        closeContact();
        showToast(result.confirmationSent
          ? (locale === "zh" ? "咨询已发送，确认邮件也已发出" : "Inquiry sent; confirmation email delivered")
          : (locale === "zh" ? "咨询已发送" : "Inquiry sent"));
      } catch (error) {
        setInquiryError(error instanceof Error ? error.message : "The inquiry could not be sent.");
      } finally {
        setInquirySubmitting(false);
      }
      return;
    }
    setInquiries((current) => [inquiry, ...current]);
    closeContact();
    showToast(t.inquirySent);
  };

  const openReportForListing = () => {
    if (!selectedListing) return;
    if (selectedListing.source !== "remote") {
      showToast(locale === "zh" ? "示例房源暂不支持举报" : "Sample listings cannot be reported.");
      return;
    }
    if (!currentUser) {
      setSelectedListing(null);
      setAuthMode("login");
      setAuthError(locale === "zh" ? "请先登录，再举报房源。" : "Sign in before reporting a listing.");
      setAuthOpen(true);
      return;
    }
    setReportError("");
    setReportOpen(true);
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedListing || selectedListing.source !== "remote" || reportLoading) return;
    const formData = new FormData(event.currentTarget);
    setReportLoading(true);
    setReportError("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: selectedListing.id,
          reason: String(formData.get("reason") || ""),
          details: String(formData.get("details") || ""),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The report could not be submitted.");
      setReportOpen(false);
      setSelectedListing(null);
      showToast(locale === "zh" ? "举报已提交" : "Report submitted");
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "The report could not be submitted.");
    } finally {
      setReportLoading(false);
    }
  };

  const validatePostStep = (step: PostStep) => {
    const required = locale === "zh" ? "请补充此步骤的必填信息。" : "Please complete the required fields in this step.";
    if (step === 1 && (!draft.titleZh.trim() || !draft.areaZh.trim() || !draft.privateAddress.trim())) return required;
    if (step === 2 && (!draft.price || Number(draft.price) <= 0 || !draft.lease || (draft.moveInMode === "date" && !draft.moveInDate))) return locale === "zh" ? "请填写有效租金、入住方式和租期。" : "Add a valid rent, move-in option, and lease term.";
    if (step === 3 && draft.photos.length === 0) return locale === "zh" ? "至少上传一张房源照片。" : "Upload at least one listing photo.";
    if (step === 4 && (!draft.contactName.trim() || !draft.contactEmail.trim() || !draft.contactEmail.includes("@"))) return locale === "zh" ? "请填写姓名和有效邮箱。" : "Add your name and a valid email address.";
    return "";
  };

  const handlePostNext = () => {
    const error = validatePostStep(postStep);
    if (error) {
      setPostError(error);
      return;
    }
    setPostError("");
    if (postStep < 5) setPostStep((current) => (current + 1) as PostStep);
  };

  const movePhoto = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= draft.photos.length) return;
    const photos = [...draft.photos];
    [photos[index], photos[nextIndex]] = [photos[nextIndex], photos[index]];
    const photoKeys = [...draft.photoKeys];
    while (photoKeys.length < photos.length) photoKeys.push("");
    [photoKeys[index], photoKeys[nextIndex]] = [photoKeys[nextIndex], photoKeys[index]];
    updateDraft({ photos, photoKeys });
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 4 - draft.photos.length);
    if (files.length === 0) return;
    setMediaUploading(true);
    try {
      const nextPhotos = [...draft.photos];
      const nextPhotoKeys = [...draft.photoKeys];
      for (const file of files) {
        const photoDataUrl = await compressPhoto(file);
        const uploaded = await uploadPhotoToR2(photoDataUrl, file.name);
        nextPhotos.push(uploaded.url);
        nextPhotoKeys.push(uploaded.key);
        updateDraft({ photos: nextPhotos.slice(0, 4), photoKeys: nextPhotoKeys.slice(0, 4) });
      }
    } catch {
      setPostError(locale === "zh" ? "照片读取失败，请换一张图片重试。" : "The photo could not be read. Try another image.");
    } finally {
      setMediaUploading(false);
      event.target.value = "";
    }
  };

  const polishListingWithAi = async () => {
    if (aiPolishLoading) return;
    setAiPolishLoading(true);
    setAiPolishError("");
    try {
      const response = await fetch("/api/polish-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleEn: draft.titleEn || draft.titleZh,
          titleZh: draft.titleZh,
          areaEn: draft.areaEn || draft.areaZh,
          areaZh: draft.areaZh,
          rentalType: draft.rentalType,
          price: draft.price,
          currency: draft.currency,
          moveIn: draft.moveInMode === "immediate" ? "立即入住" : draft.moveInDate,
          lease: draft.lease,
          features: draft.features,
          descriptionEn: draft.descriptionEn || draft.descriptionZh,
          descriptionZh: draft.descriptionZh,
        }),
      });
      const result = await response.json() as { titleEn?: string; titleZh?: string; descriptionEn?: string; descriptionZh?: string; source?: "openai" | "local"; notes?: string[]; error?: string };
      if (!response.ok) throw new Error(result.error || t.polishError);
      updateDraft({
        titleEn: result.titleEn || draft.titleEn || result.titleZh || draft.titleZh,
        titleZh: result.titleZh || draft.titleZh || result.titleEn || draft.titleEn,
        descriptionEn: result.descriptionEn || draft.descriptionEn || result.descriptionZh || draft.descriptionZh,
        descriptionZh: result.descriptionZh || draft.descriptionZh || result.descriptionEn || draft.descriptionEn,
      });
      setAiPolishSource(result.source === "openai" ? "openai" : "local");
      setAiPolishNotes(Array.isArray(result.notes) ? result.notes.slice(0, 3) : []);
      showToast(result.source === "openai" ? t.polishApplied : t.polishLocal);
    } catch (error) {
      setAiPolishError(error instanceof Error ? error.message : t.polishError);
    } finally {
      setAiPolishLoading(false);
    }
  };

  const publishLocalListing = async () => {
    const firstError = ([1, 2, 3, 4] as PostStep[]).map(validatePostStep).find(Boolean);
    if (firstError) {
      setPostError(firstError);
      setPostStep(([1, 2, 3, 4] as PostStep[]).find((step) => Boolean(validatePostStep(step))) || 1);
      return;
    }
    if (draft.photoKeys.length !== draft.photos.length) {
      setPostError("Please re-upload the listing photos so they can be saved to cloud storage.");
      setPostStep(3);
      return;
    }
    if (publishLoading) return;
    setPublishLoading(true);
    const editingId = editingListingId;
    try {
      const response = await fetch(editingId ? `/api/my/listings/${encodeURIComponent(editingId)}` : "/api/listings", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleZh: draft.titleZh,
          titleEn: draft.titleEn || draft.titleZh,
          areaZh: draft.areaZh,
          areaEn: draft.areaEn || draft.areaZh,
          privateAddress: draft.privateAddress,
          posterRole: draft.posterRole,
          rentalType: draft.rentalType,
          price: draft.price,
          currency: "USD",
          bedrooms: draft.bedrooms,
          bathrooms: draft.bathrooms,
          moveIn: draft.moveInMode === "immediate" ? "immediate" : draft.moveInDate,
          lease: draft.lease,
          features: draft.features,
          descriptionZh: draft.descriptionZh,
          descriptionEn: draft.descriptionEn || draft.descriptionZh,
          contactName: draft.contactName,
          contactEmail: draft.contactEmail,
          tourPreference: draft.tourPreference,
          media: draft.photoKeys.map((key) => ({ key, contentType: "image/jpeg" })),
        }),
      });
      const result = await response.json() as Listing & { error?: string; status?: string };
      if (!response.ok) throw new Error(result.error || (editingId ? "The listing could not be updated." : "The listing could not be published."));
      if (editingId) {
        const listingResponse = await fetch("/api/listings", { cache: "no-store" });
        if (listingResponse.ok) {
          const listings = await listingResponse.json();
          if (Array.isArray(listings)) setRemoteListings(listings as Listing[]);
        }
      } else {
        setRemoteListings((current) => [result, ...current]);
      }
      setDraft(EMPTY_DRAFT);
      setDraftSavedAt(null);
      setEditingListingId(null);
      setPostError("");
      setAiPolishSource(null);
      setAiPolishNotes([]);
      setAiPolishError("");
      setPostOpen(false);
      showToast(editingId ? (locale === "zh" ? "房源已更新" : "Listing updated") : (locale === "zh" ? "房源已保存到云端" : "Listing saved to the cloud"));
      return;
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "The listing could not be published.");
      return;
    } finally {
      setPublishLoading(false);
    }

    const roleZh = draft.posterRole === "agent" ? "房产经纪" : "房主";
    const roleEn = draft.posterRole === "agent" ? "Agent" : "Owner";
    const typeZh = draft.rentalType === "privateRoom" ? "独立房间" : draft.rentalType === "sublet" ? "转租" : "整套住房";
    const typeEn = draft.rentalType === "privateRoom" ? "Private room" : draft.rentalType === "sublet" ? "Sublet" : "Entire home";
    const featureLabels = {
      furnished: ["家具齐全", "Furnished"],
      utilities: ["部分费用包含", "Utilities included"],
      parking: ["停车位可询", "Parking available"],
      pets: ["可养宠物", "Pets considered"],
      laundry: ["楼内洗衣房", "Laundry in building"],
      inUnitLaundry: ["室内洗衣机", "In-unit laundry"],
      airConditioning: ["空调", "Air conditioning"],
      dishwasher: ["洗碗机", "Dishwasher"],
      balcony: ["阳台 / 露台", "Balcony / terrace"],
      elevator: ["电梯", "Elevator"],
      gym: ["健身房", "Gym"],
      doorman: ["门卫 / 前台", "Doorman / front desk"],
      storage: ["储物空间", "Storage"],
    } as const;
    const tagsZh = draft.features.map((feature) => featureLabels[feature as keyof typeof featureLabels][0]);
    const tagsEn = draft.features.map((feature) => featureLabels[feature as keyof typeof featureLabels][1]);
    const customListing: Listing = {
      id: `local-${Date.now()}`,
      source: "local",
      titleZh: draft.titleZh.trim() || draft.titleEn.trim(),
      titleEn: draft.titleEn.trim() || draft.titleZh.trim(),
      areaZh: draft.areaZh.trim() || draft.areaEn.trim(),
      areaEn: draft.areaEn.trim() || draft.areaZh.trim(),
      type: draft.rentalType,
      typeZh,
      typeEn,
      price: Number(draft.price),
      currency: draft.currency,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      moveIn: draft.moveInMode === "immediate" ? "immediate" : draft.moveInDate,
      lease: `${draft.lease} months`,
      image: draft.photos[0],
      photos: draft.photos,
      features: draft.features,
      tagsZh,
      tagsEn,
      freshnessZh: "刚刚发布 · 本地预览",
      freshnessEn: "Published just now · local preview",
      posterZh: `${roleZh} · 本地账号`,
      posterEn: `${roleEn} · local account`,
      privacyZh: "精确地址由发布者控制",
      privacyEn: "Poster controls the exact address",
      privateAddress: draft.privateAddress,
      descriptionZh: draft.descriptionZh || draft.descriptionEn,
      descriptionEn: draft.descriptionEn || draft.descriptionZh,
    };
    setCustomListings((current) => [customListing, ...current]);
    setDraft(EMPTY_DRAFT);
    setDraftSavedAt(null);
    setPostError("");
    setAiPolishSource(null);
    setAiPolishNotes([]);
    setAiPolishError("");
    setPostOpen(false);
    showToast(locale === "zh" ? "房源已发布到本地预览" : "Listing published to this local preview");
  };

  const saveDraftAndClose = () => {
    setDraftSavedAt(1);
    setPostOpen(false);
    showToast(editingListingId ? (locale === "zh" ? "编辑草稿已保存" : "Edit draft saved") : (locale === "zh" ? "草稿已保存" : "Draft saved"));
  };

  const listingTitle = (listing: Listing) => (locale === "zh" ? listing.titleZh : listing.titleEn);
  const listingArea = (listing: Listing) => (locale === "zh" ? listing.areaZh : listing.areaEn);
  const listingType = (listing: Listing) => (locale === "zh" ? listing.typeZh : listing.typeEn);
  const listingTags = (listing: Listing) => (locale === "zh" ? listing.tagsZh : listing.tagsEn);
  const listingFreshness = (listing: Listing) => (locale === "zh" ? listing.freshnessZh : listing.freshnessEn);
  const listingPoster = (listing: Listing) => (locale === "zh" ? listing.posterZh : listing.posterEn);
  const listingPrivacy = (listing: Listing) => (locale === "zh" ? listing.privacyZh : listing.privacyEn);
  const listingDescription = (listing: Listing) => (locale === "zh" ? listing.descriptionZh : listing.descriptionEn) || "";
  const listingMoveIn = (listing: Listing) => formatMoveIn(listing.moveIn, locale);
  const featureLabel = (feature: string) => {
    const value = t[feature as keyof typeof t];
    return typeof value === "string" ? value : feature;
  };
  const selectedPhotos = selectedListing ? listingPhotos(selectedListing) : [];
  const selectedPhoto = selectedPhotos[selectedPhotoIndex] || selectedListing?.image || "";

  return (
    <main className="app-shell">
      <a className="skip-link" href="#rentals">
        {locale === "zh" ? "跳到房源列表" : "Skip to rentals"}
      </a>

      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#top" aria-label="Rental marketplace home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="brand-wordmark">
              <strong>租住</strong>
              <small>RENTALS</small>
            </span>
          </a>
          <span className="working-title">{t.workingTitle}</span>
          <nav className="primary-nav" aria-label={locale === "zh" ? "主要导航" : "Primary navigation"}>
            <a className="active" href="#rentals">{t.findRentals}</a>
            <a href="#saved" onClick={(event) => { event.preventDefault(); setSavedOpen(true); }}>{t.saved}{savedIds.size > 0 ? ` ${savedIds.size}` : ""}</a>
            <a href="#messages" onClick={(event) => { event.preventDefault(); setMessagesOpen(true); }}>{t.messages}{messageInquiries.length > 0 ? ` ${messageInquiries.length}` : ""}</a>
          </nav>
          <div className="topbar-actions">
            <button className="post-button" type="button" onClick={openPostFlow}>
              <span aria-hidden="true">+</span>
              {t.post}
            </button>
            <button className={`avatar-button ${currentUser ? "is-authenticated" : ""}`} type="button" onClick={openAccount} aria-label={currentUser ? currentUser.displayName : t.account}>{currentUser ? currentUser.displayName.slice(0, 1).toUpperCase() : "?"}</button>
          </div>
        </div>
      </header>

      <div className="page-content" id="top">
        <section className="workspace-heading" aria-labelledby="page-title">
          <div className="heading-copy">
            <p className="status-line"><span className="status-lamp" aria-hidden="true" />{t.pilot}</p>
            <h1 id="page-title">{t.heading}</h1>
            <p className="heading-subtitle">{t.subheading}</p>
          </div>
          <div className="heading-actions">
            <button className={`outline-button ${savedSearchIsCurrent ? "is-saved" : ""}`} type="button" onClick={toggleSavedSearch}>
              <span className="button-check" aria-hidden="true">{savedSearchIsCurrent ? <CheckIcon /> : ""}</span>
              {savedSearchIsCurrent ? t.savedSearch : (savedSearch ? (locale === "zh" ? "更新保存的搜索" : "Update saved search") : t.saveSearch)}
            </button>
          </div>
        </section>

        <section className="search-workbench" aria-label={locale === "zh" ? "找房工作台" : "Rental search workbench"}>
          <aside className="filter-column">
            <div className="filter-header">
              <div>
                <span className="section-label">FILTER DESK</span>
                <h2>{t.filters}</h2>
              </div>
              <button className="text-button" type="button" onClick={resetFilters}>{t.reset}</button>
            </div>

            <form className="filter-form" onSubmit={submitSearch}>
              <label className="field-label" htmlFor="location">{t.location}</label>
              <div className="input-shell search-input-shell">
                <SearchIcon />
                <input id="location" value={locationInput} onChange={(event) => setLocationInput(event.target.value)} placeholder={t.locationPlaceholder} />
              </div>
              <p className="field-note"><LockIcon size={14} />{t.approximate}</p>

              <label className="field-label" htmlFor="price">{t.maxPrice}</label>
              <select id="price" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
                <option value="">{t.anyPrice}</option>
                <option value="1800">$1,800</option>
                <option value="2400">$2,400</option>
                <option value="3000">$3,000</option>
                <option value="3500">$3,500</option>
              </select>

              <label className="field-label" htmlFor="type">{t.type}</label>
              <select id="type" value={rentalType} onChange={(event) => setRentalType(event.target.value as RentalType)}>
                <option value="all">{t.allTypes}</option>
                <option value="entire">{t.entire}</option>
                <option value="privateRoom">{t.privateRoom}</option>
                <option value="sublet">{t.sublet}</option>
              </select>

              <label className="field-label" htmlFor="move-in">{t.moveIn}</label>
              <select id="move-in" value={moveIn} onChange={(event) => setMoveIn(event.target.value)}>
                <option value="">{t.anytime}</option>
                <option value="august">{t.august}</option>
                <option value="september">{t.september}</option>
                <option value="october">{t.october}</option>
              </select>

              <button className="more-filters" type="button" onClick={() => setShowMore((current) => !current)}>
                <SlidersIcon />
                {showMore ? t.less : t.more}
                <span aria-hidden="true">{showMore ? "−" : "+"}</span>
              </button>

              {showMore && (
                <div className="feature-filters">
                  {POST_FEATURE_KEYS.map((key) => (
                    <button className={`feature-chip ${activeFeatures.includes(key) ? "active" : ""}`} key={key} type="button" onClick={() => toggleFeature(key)} aria-pressed={activeFeatures.includes(key)}>
                      <span className="chip-mark" aria-hidden="true">{activeFeatures.includes(key) ? <CheckIcon size={12} /> : ""}</span>
                      {t[key]}
                    </button>
                  ))}
                </div>
              )}

              <button className="primary-button search-button" type="submit"><SearchIcon />{t.search}</button>
            </form>
          </aside>

          <section className="results-column" id="rentals" aria-labelledby="results-heading">
            <div className="results-toolbar">
              <div>
                <span className="section-label">{filteredListings.length} / {allListings.length} {locale === "zh" ? "房源" : "listings"}</span>
                <h2 id="results-heading">{t.results}</h2>
              </div>
              <label className="sort-control">
                <span>{t.sort}</span>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label={t.sort}>
                  <option value="fit">{t.bestFit}</option>
                  <option value="price">{t.lowest}</option>
                  <option value="fresh">{t.fresh}</option>
                </select>
              </label>
            </div>

            {allListings.some((listing) => listing.source === "sample" || listing.source === "local") && <div className="synthetic-notice" role="note">
              <span className="notice-mark" aria-hidden="true"><i /><i /></span>
              <p>{t.syntheticNotice}</p>
              <button className="notice-action" type="button" onClick={() => showToast(t.addressPrivate)}>{locale === "zh" ? "为什么" : "Why"}</button>
            </div>}

            <div className="listing-list">
              {filteredListings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true"><SearchIcon size={22} /></div>
                  <h3>{t.noResults}</h3>
                  <p>{t.noResultsBody}</p>
                  <button className="outline-button" type="button" onClick={resetFilters}>{t.clearAndTry}</button>
                </div>
              ) : filteredListings.map((listing) => {
                const saved = savedIds.has(listing.id);
                const comparing = compareIds.includes(listing.id);
                const photoCount = listingPhotos(listing).length;
                const tags = listingTags(listing);
                return (
                  <article className="listing-card" key={listing.id}>
                    <div className="listing-image-wrap">
                      <Image src={listing.image} alt={locale === "zh" ? `${listing.titleZh} 房源照片` : `${listing.titleEn} listing photo`} fill sizes="(max-width: 600px) 100vw, (max-width: 1080px) 40vw, 31vw" priority={filteredListings[0]?.id === listing.id} loading={filteredListings[0]?.id === listing.id ? "eager" : "lazy"} unoptimized={listing.source !== "sample"} />
                      <span className="image-label"><span className="image-label-dot" aria-hidden="true" />{listingFreshness(listing)}</span>
                      {photoCount > 1 && <span className="image-photo-count"><GalleryIcon size={13} />{photoCount} {t.photoCount}</span>}
                      <button className={`save-button ${saved ? "is-saved" : ""}`} type="button" onClick={() => toggleSaved(listing.id)} aria-label={saved ? (locale === "zh" ? "取消收藏" : "Remove from saved") : (locale === "zh" ? "收藏房源" : "Save listing")} aria-pressed={saved}>
                        <HeartIcon filled={saved} />
                      </button>
                    </div>
                    <div className="listing-body">
                      <div className="listing-topline">
                        <span className="listing-type">{listingType(listing)}</span>
                        <span className="listing-source">{listing.source === "local" ? (locale === "zh" ? "你的本地房源" : "Your local listing") : listingPoster(listing)}</span>
                      </div>
                      <h3>{listingTitle(listing)}</h3>
                      <p className="listing-area"><PinIcon size={15} />{listingArea(listing)}</p>
                      <div className="price-line">
                        <strong>{formatPrice(listing)}</strong>
                        <span>{t.month}</span>
                        <span className="cost-badge"><CheckIcon size={11} />{t.costBreakdown}</span>
                      </div>
                      <div className="listing-facts" aria-label={locale === "zh" ? "房源基本信息" : "Listing basics"}>
                        <span><b>{listing.bedrooms}</b> {locale === "zh" ? "卧室" : "bed"}</span>
                        <span><b>{listing.bathrooms}</b> {locale === "zh" ? "卫" : "bath"}</span>
                        <span><b>{listingMoveIn(listing)}</b> {locale === "zh" ? "入住" : "move-in"}</span>
                        <span><b>{listing.lease}</b> {locale === "zh" ? "租期" : "lease"}</span>
                      </div>
                      <div className="tag-row">
                        {tags.slice(0, 3).map((tag) => <span className="listing-tag" key={tag}>{tag}</span>)}
                        {tags.length > 3 && <span className="listing-tag listing-tag-more">+{tags.length - 3}</span>}
                      </div>
                      <div className="trust-row">
                        <span><span className="trust-icon blue"><PinIcon size={12} /></span>{t.locationChecked}</span>
                        <span><span className="trust-icon lime"><CheckIcon size={12} /></span>{t.availability}</span>
                        {listing.posterVerified && <span><span className="trust-icon verified"><CheckIcon size={12} /></span>{t.verifiedEmail}</span>}
                        <span><span className="trust-icon photo"><GalleryIcon size={12} /></span>{photoCount} {t.photoCount}</span>
                        <span className="privacy-signal"><LockIcon size={12} />{listingPrivacy(listing)}</span>
                      </div>
                      <div className="listing-actions">
                        <button className="link-button" type="button" onClick={() => openListing(listing)}>{t.view}<ArrowIcon size={15} /></button>
                        <div className="action-group">
                          <button className={`compare-button ${comparing ? "active" : ""}`} type="button" onClick={() => toggleCompare(listing.id)} aria-pressed={comparing}>{comparing ? <CheckIcon size={13} /> : ""}{comparing ? t.comparing : t.compare}</button>
                          <button className="contact-button" type="button" onClick={() => openContact(listing)}><ChatIcon size={15} />{t.contact}</button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {compareListings.length > 0 && (
              <aside className="compare-bar" aria-label={t.comparing}>
                <div className="compare-heading">
                  <span className="compare-count">{compareListings.length}</span>
                  <div><strong>{t.comparing}</strong><small>{locale === "zh" ? "把关键条件放在一起看" : "Put the important facts side by side"}</small></div>
                </div>
                <div className="compare-items">
                  {compareListings.map((listing) => <span key={listing.id}>{listingTitle(listing)}<button type="button" onClick={() => toggleCompare(listing.id)} aria-label={`${t.close} ${listingTitle(listing)}`}><CloseIcon size={13} /></button></span>)}
                </div>
                <button className="compare-cta" type="button" onClick={() => setCompareOpen(true)}>{locale === "zh" ? "打开比较" : "Open compare"}<ArrowIcon size={15} /></button>
              </aside>
            )}
          </section>
        </section>

        <section className="guide-rail" aria-label={locale === "zh" ? "产品原则" : "Product principles"}>
          <div className="guide-block privacy-block">
            <span className="guide-icon"><LockIcon /></span>
            <div><h2>{t.privacyGuideTitle}</h2><p>{t.privacyGuideBody}</p></div>
          </div>
          <div className="guide-block">
            <span className="guide-icon blue-icon"><ShieldIcon /></span>
            <div><h2>{t.trustTitle}</h2><p>{t.trustBody}</p></div>
          </div>
          <div className="guide-block">
            <span className="guide-icon lime-icon"><ChatIcon /></span>
            <div><h2>{t.conversationTitle}</h2><p>{t.conversationBody}</p></div>
          </div>
        </section>
      </div>

      {savedOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSavedOpen(false); }}>
          <aside className="drawer form-drawer" role="dialog" aria-modal="true" aria-labelledby="saved-title">
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">SAVED DESK</span><button className="drawer-close" type="button" onClick={() => setSavedOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="saved-title">{locale === "zh" ? "我保存的房源" : "Saved listings"}</h2>
              <p className="drawer-intro">{currentUser ? (locale === "zh" ? "收藏保存在这个浏览器中；登录后可以继续同步搜索偏好。" : "Saved listings stay in this browser; signed-in search preferences can sync to your account.") : (locale === "zh" ? "收藏会保存在这个浏览器中，方便你继续比较。" : "Your saved listings stay in this browser so you can keep comparing.")}</p>
              {savedListings.length === 0 ? (
                <div className="drawer-empty"><div className="empty-icon" aria-hidden="true"><HeartIcon /></div><h3>{locale === "zh" ? "还没有收藏" : "Nothing saved yet"}</h3><p>{locale === "zh" ? "在房源照片上点击心形按钮，收藏会出现在这里。" : "Use the heart button on a listing photo to save it here."}</p></div>
              ) : (
                <div className="saved-list">
                  {savedListings.map((listing) => (
                    <button className="saved-item" type="button" key={listing.id} onClick={() => { openListing(listing); setSavedOpen(false); }}>
                    <Image src={listing.image} alt="" width={76} height={62} unoptimized={listing.source !== "sample"} />
                      <span><strong>{listingTitle(listing)}</strong><small>{listingArea(listing)} · {formatPrice(listing)}</small></span>
                      <ArrowIcon size={15} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {messagesOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessagesOpen(false); }}>
          <aside className="drawer form-drawer" role="dialog" aria-modal="true" aria-labelledby="messages-title">
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">MESSAGE DESK</span><button className="drawer-close" type="button" onClick={() => setMessagesOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="messages-title">{locale === "zh" ? "我的咨询" : "My inquiries"}</h2>
              <p className="drawer-intro">{locale === "zh" ? "这里记录你在本地预览中发送的咨询和看房偏好。" : "Your inquiries and tour preferences are recorded here in this local preview."}</p>
              {messageInquiries.length === 0 ? (
                <div className="drawer-empty"><div className="empty-icon" aria-hidden="true"><ChatIcon /></div><h3>{locale === "zh" ? "还没有消息" : "No inquiries yet"}</h3><p>{locale === "zh" ? "打开一个房源并发送结构化咨询，就会在这里看到记录。" : "Open a listing and send a structured inquiry to see it here."}</p></div>
              ) : (
                <div className="message-list">
                  {messageInquiries.map((inquiry) => (
                    <article className="message-item" key={inquiry.id}>
                      <div className="message-item-top"><strong>{inquiry.listingTitle}</strong><span>{new Date(inquiry.sentAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span></div>
                      <p>{locale === "zh" ? `入住 ${inquiry.moveIn} · ${inquiry.leaseLength} 个月 · ${inquiry.occupants} 位居住者` : `Move-in ${inquiry.moveIn} · ${inquiry.leaseLength} months · ${inquiry.occupants} occupant(s)`}</p>
                      <span className="message-status">{locale === "zh" ? "已发送 · 等待回复" : "Sent · waiting for reply"}</span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {compareOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompareOpen(false); }}>
          <aside className="drawer compare-drawer" role="dialog" aria-modal="true" aria-labelledby="compare-title">
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">COMPARE DESK</span><button className="drawer-close" type="button" onClick={() => setCompareOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="compare-title">{locale === "zh" ? "并排比较房源" : "Compare listings"}</h2>
              <p className="drawer-intro">{locale === "zh" ? "把租金、入住时间、租期和发布者信号放在一起看。" : "Put rent, move-in timing, lease, and poster signals side by side."}</p>
              <div className="compare-grid">
                {compareListings.map((listing) => (
                  <article className="compare-card" key={listing.id}>
                    <Image src={listing.image} alt="" width={180} height={120} unoptimized={listing.source !== "sample"} />
                    <strong>{listingTitle(listing)}</strong>
                    <span>{formatPrice(listing)} {t.month}</span>
                    <dl><div><dt>{t.detailArea}</dt><dd>{listingArea(listing)}</dd></div><div><dt>{t.detailMoveIn}</dt><dd>{listingMoveIn(listing)}</dd></div><div><dt>{t.detailLease}</dt><dd>{listing.lease}</dd></div><div><dt>{t.detailPoster}</dt><dd>{listing.source === "local" ? (locale === "zh" ? "本地账号" : "Local account") : listingPoster(listing)}</dd></div></dl>
                    <button className="outline-button" type="button" onClick={() => { openListing(listing); setCompareOpen(false); }}>{t.view}</button>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {postOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPostOpen(false); }}>
          <aside className="drawer form-drawer post-drawer" role="dialog" aria-modal="true" aria-labelledby="post-title">
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">POSTER WORKFLOW</span><button className="drawer-close" type="button" onClick={() => setPostOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="post-title">{editingListingId ? (locale === "zh" ? "编辑房源" : "Edit listing") : t.postTitle}</h2>
              <p className="drawer-intro">{t.postIntro}</p>
              <div className="post-progress"><span>{locale === "zh" ? `第 ${postStep} 步，共 5 步` : `Step ${postStep} of 5`}</span><span>{editingListingId ? (locale === "zh" ? "编辑模式" : "Editing") : draftSavedAt ? (locale === "zh" ? "草稿已自动保存" : "Draft autosaved") : (locale === "zh" ? "本地草稿" : "Local draft")}</span></div>
              <div className="stage-list">
                {[t.stageProperty, t.stageTerms, t.stageStory, t.stageContact, t.stagePublish].map((stage, index) => <div className="stage-row" key={stage}><span className={`stage-index ${index + 1 <= postStep ? "current" : ""}`}>{index + 1}</span><span>{stage}</span><span className="stage-state">{index + 1 < postStep ? (locale === "zh" ? "完成" : "Done") : index + 1 === postStep ? (locale === "zh" ? "当前" : "Current") : (locale === "zh" ? "待开始" : "Next")}</span></div>)}
              </div>

              {postStep === 1 && (
                <div className="post-form-grid">
                  <label className="field-label" htmlFor="post-title-zh">中文房源标题<input id="post-title-zh" value={draft.titleZh} onChange={(event) => updateDraft({ titleZh: event.target.value })} placeholder="近地铁的明亮两居" /></label>
                  <label className="field-label" htmlFor="post-area-zh">公开区域<input id="post-area-zh" value={draft.areaZh} onChange={(event) => updateDraft({ areaZh: event.target.value })} placeholder="皇后区 · Forest Hills 一带" /></label>
                  <label className="field-label" htmlFor="post-private-address">精确地址（私密）<input id="post-private-address" value={draft.privateAddress} onChange={(event) => updateDraft({ privateAddress: event.target.value })} placeholder="请输入完整街道地址" /></label>
                  <div className="post-privacy-note"><LockIcon /><div><strong>{t.addressPrivate}</strong><p>仅保存在本地草稿，不会出现在公开房源卡片。</p></div></div>
                  <label className="field-label" htmlFor="post-role">发布者角色<select id="post-role" value={draft.posterRole} onChange={(event) => updateDraft({ posterRole: event.target.value as ListingDraft["posterRole"] })}><option value="owner">房主</option><option value="agent">房产经纪</option></select></label>
                </div>
              )}

              {postStep === 2 && (
                <div className="post-form-grid">
                  <label className="field-label" htmlFor="post-type">{t.type}<select id="post-type" value={draft.rentalType} onChange={(event) => updateDraft({ rentalType: event.target.value as ListingDraft["rentalType"] })}><option value="entire">{t.entire}</option><option value="privateRoom">{t.privateRoom}</option><option value="sublet">{t.sublet}</option></select></label>
                  <label className="field-label" htmlFor="post-price">{t.maxPrice}<input id="post-price" type="number" min="1" value={draft.price} onChange={(event) => updateDraft({ price: event.target.value })} placeholder="2400" /></label>
                  <label className="field-label" htmlFor="post-currency">货币<select id="post-currency" value="USD" onChange={() => updateDraft({ currency: "USD" })}><option value="USD">USD</option></select></label>
                  <label className="field-label" htmlFor="post-bedrooms">{locale === "zh" ? "卧室" : "Bedrooms"}<select id="post-bedrooms" value={draft.bedrooms} onChange={(event) => updateDraft({ bedrooms: event.target.value })}><option value="0">Studio</option><option value="1">1</option><option value="2">2</option><option value="3">3+</option></select></label>
                  <label className="field-label" htmlFor="post-bathrooms">{locale === "zh" ? "卫生间" : "Bathrooms"}<select id="post-bathrooms" value={draft.bathrooms} onChange={(event) => updateDraft({ bathrooms: event.target.value })}><option value="1">1</option><option value="1.5">1.5</option><option value="2">2</option><option value="3">3+</option></select></label>
                  <label className="field-label" htmlFor="post-move-in-mode">可入住时间<select id="post-move-in-mode" value={draft.moveInMode} onChange={(event) => updateDraft({ moveInMode: event.target.value as ListingDraft["moveInMode"] })}><option value="immediate">{t.immediate}</option><option value="date">{t.chooseDate}</option></select></label>
                  {draft.moveInMode === "date" && <label className="field-label" htmlFor="post-move-in-date">入住日期<input id="post-move-in-date" type="date" value={draft.moveInDate} onInput={(event) => updateDraft({ moveInDate: event.currentTarget.value })} onChange={(event) => updateDraft({ moveInDate: event.target.value })} /></label>}
                  <label className="field-label" htmlFor="post-lease">{locale === "zh" ? "最短租期（月）" : "Minimum lease (months)"}<input id="post-lease" type="number" min="1" value={draft.lease} onChange={(event) => updateDraft({ lease: event.target.value })} /></label>
                  <div className="field-label feature-field-label">房源特点（可多选）<div className="feature-filters post-features">{POST_FEATURE_KEYS.map((key) => <button className={`feature-chip ${draft.features.includes(key) ? "active" : ""}`} key={key} type="button" onClick={() => updateDraft({ features: draft.features.includes(key) ? draft.features.filter((item) => item !== key) : [...draft.features, key] })} aria-pressed={draft.features.includes(key)}><span className="chip-mark" aria-hidden="true">{draft.features.includes(key) ? <CheckIcon size={12} /> : ""}</span>{t[key]}</button>)}</div></div>
                </div>
              )}

              {postStep === 3 && (
                <div className="post-form-grid">
                  <label className="field-label field-span-2" htmlFor="post-photos">{locale === "zh" ? "房源照片" : "Listing photos"}<input id="post-photos" type="file" accept="image/*" multiple disabled={mediaUploading} onChange={handlePhotoUpload} /><span className="field-help">{locale === "zh" ? `最多 4 张，当前 ${draft.photos.length} 张。照片会上传到云端。` : `Up to 4 photos, ${draft.photos.length} selected. Photos upload to cloud storage.`}</span></label>
                  {draft.photos.length > 0 && <div className="photo-preview field-span-2">{draft.photos.map((photo, index) => <div className="photo-preview-item" key={`${photo.slice(0, 24)}-${index}`}><Image src={photo} alt={`${locale === "zh" ? "房源照片" : "Listing photo"} ${index + 1}`} width={112} height={82} unoptimized /><span className="photo-order">{index === 0 ? (locale === "zh" ? "首图" : "Cover") : index + 1}</span><div className="photo-preview-actions"><button className="photo-action" type="button" onClick={() => movePhoto(index, "up")} disabled={index === 0} aria-label={locale === "zh" ? "设为首图" : "Move photo up"}><ChevronIcon direction="up" /></button><button className="photo-action" type="button" onClick={() => movePhoto(index, "down")} disabled={index === draft.photos.length - 1} aria-label={locale === "zh" ? "照片后移" : "Move photo down"}><ChevronIcon direction="down" /></button><button className="photo-action photo-remove" type="button" onClick={() => updateDraft({ photos: draft.photos.filter((_, photoIndex) => photoIndex !== index), photoKeys: draft.photoKeys.filter((_, photoIndex) => photoIndex !== index) })} aria-label={locale === "zh" ? `删除照片 ${index + 1}` : `Remove photo ${index + 1}`}><CloseIcon size={14} /></button></div></div>)}</div>}
                  <div className="ai-polish-panel field-span-2" role="note">
                    <div className="ai-polish-copy"><span className="ai-polish-mark" aria-hidden="true"><ShieldIcon size={16} /></span><div><strong>{t.polishTitle}</strong><p>{t.polishIntro}</p></div></div>
                    <button className="outline-button ai-polish-button" type="button" onClick={polishListingWithAi} disabled={aiPolishLoading || (!draft.titleZh.trim() && !draft.descriptionZh.trim())}>{aiPolishLoading ? t.polishLoading : t.polishAction}<ArrowIcon size={14} /></button>
                  </div>
                  {aiPolishSource && <p className="ai-polish-status field-span-2" role="status">{aiPolishSource === "openai" ? t.polishApplied : t.polishLocal}</p>}
                  {aiPolishNotes.length > 0 && <div className="ai-polish-notes field-span-2" role="note"><strong>{locale === "zh" ? "发布前请复核" : "Review before publishing"}</strong><ul>{aiPolishNotes.map((note) => <li key={note}>{note}</li>)}</ul></div>}
                  {aiPolishError && <p className="form-error field-span-2" role="alert">{aiPolishError}</p>}
                  <label className="field-label field-span-2" htmlFor="post-description-zh">房源介绍<textarea id="post-description-zh" rows={6} value={draft.descriptionZh} onChange={(event) => updateDraft({ descriptionZh: event.target.value })} placeholder="介绍采光、布局、交通、费用包含内容和其他真实情况。" /></label>
                </div>
              )}

              {postStep === 4 && (
                <div className="post-form-grid">
                  <label className="field-label" htmlFor="post-contact-name">{locale === "zh" ? "联系人姓名" : "Contact name"}<input id="post-contact-name" value={draft.contactName} onChange={(event) => updateDraft({ contactName: event.target.value })} placeholder="Your name" /></label>
                  <label className="field-label" htmlFor="post-contact-email">{locale === "zh" ? "联系邮箱" : "Contact email"}<input id="post-contact-email" type="email" value={draft.contactEmail} onChange={(event) => updateDraft({ contactEmail: event.target.value })} placeholder="you@example.com" /></label>
                  <label className="field-label field-span-2" htmlFor="post-tour-preference">{locale === "zh" ? "看房时间偏好" : "Tour availability"}<select id="post-tour-preference" value={draft.tourPreference} onChange={(event) => updateDraft({ tourPreference: event.target.value })}><option value="flexible">{locale === "zh" ? "时间灵活" : "Flexible"}</option><option value="weekday">{locale === "zh" ? "工作日" : "Weekdays"}</option><option value="weekend">{locale === "zh" ? "周末" : "Weekends"}</option></select></label>
                  <div className="post-privacy-note field-span-2"><LockIcon /><div><strong>{t.addressPrivate}</strong><p>{locale === "zh" ? "看房接受前，公开页面只显示大致区域。" : "Public pages show only the approximate area until a tour is accepted."}</p></div></div>
                </div>
              )}

              {postStep === 5 && (
                <div className="post-preview">
                  <div className="preview-photo">{draft.photos[0] ? <Image src={draft.photos[0]} alt="" fill sizes="460px" unoptimized /> : null}<span>{locale === "zh" ? "公开预览" : "Public preview"}</span></div>
                  <div className="preview-copy"><span className="listing-type">{draft.rentalType === "privateRoom" ? t.privateRoom : draft.rentalType === "sublet" ? t.sublet : t.entire}</span><h3>{draft.titleZh || (locale === "zh" ? "未命名房源" : "Untitled listing")}</h3><p className="listing-area"><PinIcon size={15} />{draft.areaZh || "大致区域"}</p><div className="price-line"><strong>{draft.price ? `$${Number(draft.price).toLocaleString("en-US")} USD` : "—"}</strong><span>{t.month}</span></div><p className="preview-move-in">{t.detailMoveIn}：{draft.moveInMode === "immediate" ? t.immediate : draft.moveInDate || "—"}</p><div className="tag-row">{draft.features.map((feature) => <span className="listing-tag" key={feature}>{featureLabel(feature)}</span>)}</div><div className="drawer-privacy"><div className="privacy-icon"><LockIcon /></div><div><strong>{t.addressPrivate}</strong><p>精确地址不会出现在公开预览中。</p></div></div></div>
                </div>
              )}

              {postError && <p className="form-error" role="alert">{postError}</p>}
              <div className="post-footer-actions">
                <button className="outline-button" type="button" onClick={() => { if (postStep === 1) setPostOpen(false); else setPostStep((current) => (current - 1) as PostStep); }}>{postStep === 1 ? t.close : (locale === "zh" ? "上一步" : "Back")}</button>
                <button className="text-button" type="button" onClick={saveDraftAndClose}>{locale === "zh" ? "保存草稿" : "Save draft"}</button>
                <button className="text-button" type="button" onClick={() => { setDraft(EMPTY_DRAFT); setEditingListingId(null); setPostStep(1); setPostError(""); setAiPolishError(""); setAiPolishSource(null); setAiPolishNotes([]); setDraftSavedAt(null); showToast(locale === "zh" ? "草稿已清除" : "Draft cleared"); }}>{locale === "zh" ? "清除草稿" : "Clear draft"}</button>
                {postStep < 5 ? <button className="primary-button" type="button" onClick={handlePostNext}>{locale === "zh" ? "下一步" : "Next"}<ArrowIcon /></button> : <button className="primary-button" type="button" disabled={publishLoading || mediaUploading} onClick={publishLocalListing}>{publishLoading ? (locale === "zh" ? "保存中…" : "Saving…") : (editingListingId ? (locale === "zh" ? "保存房源修改" : "Save listing changes") : (locale === "zh" ? "发布云端房源" : "Publish to cloud"))}<CheckIcon /></button>}
              </div>
            </div>
          </aside>
        </div>
      )}

      {selectedListing && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedListing(null); }}>
          <aside className="drawer detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="drawer-image-wrap">
              {selectedPhoto ? <Image key={selectedPhoto} className="gallery-photo" src={selectedPhoto} alt={listingTitle(selectedListing)} fill sizes="620px" unoptimized={selectedListing.source !== "sample"} /> : <div className="image-fallback" aria-hidden="true"><Image className="gallery-photo" src="/listings/elmwood-light.png" alt="" fill sizes="620px" /></div>}
              <button className="drawer-close image-close" type="button" onClick={() => setSelectedListing(null)} aria-label={t.close}><CloseIcon /></button>
              {selectedPhotos.length > 1 && <>
                <button className="gallery-control gallery-prev" type="button" onClick={() => setSelectedPhotoIndex((current) => (current - 1 + selectedPhotos.length) % selectedPhotos.length)} aria-label={locale === "zh" ? "上一张房源照片" : "Previous listing photo"}>‹</button>
                <button className="gallery-control gallery-next" type="button" onClick={() => setSelectedPhotoIndex((current) => (current + 1) % selectedPhotos.length)} aria-label={locale === "zh" ? "下一张房源照片" : "Next listing photo"}>›</button>
                <span className="gallery-count">{selectedPhotoIndex + 1} / {selectedPhotos.length}</span>
              </>}
              <span className="drawer-image-note"><LockIcon size={13} />{t.approximate}</span>
            </div>
            {selectedPhotos.length > 1 && <div className="gallery-thumbnails" aria-label={locale === "zh" ? "房源照片" : "Listing photos"}>{selectedPhotos.map((photo, index) => <button className={`gallery-thumbnail ${index === selectedPhotoIndex ? "active" : ""}`} type="button" key={`${photo}-${index}`} onClick={() => setSelectedPhotoIndex(index)} aria-label={`${locale === "zh" ? "查看照片" : "View photo"} ${index + 1}`} aria-pressed={index === selectedPhotoIndex}><Image src={photo} alt="" fill sizes="86px" unoptimized={selectedListing.source !== "sample"} /></button>)}</div>}
            <div className="drawer-content">
              <div className="drawer-heading"><span className="listing-type">{listingType(selectedListing)}</span><button className="drawer-close" type="button" onClick={() => setSelectedListing(null)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="detail-title">{listingTitle(selectedListing)}</h2>
              <p className="listing-area"><PinIcon size={15} />{listingArea(selectedListing)}</p>
              <p className="drawer-intro">{t.detailsIntro}</p>
              <div className="detail-price"><strong>{formatPrice(selectedListing)}</strong><span>{t.month}</span></div>
              <p className="cost-note"><CheckIcon size={13} />{t.costNote}</p>
              <div className="detail-assurance" aria-label={locale === "zh" ? "房源信号" : "Listing signals"}>
                <span className="assurance-item"><span className="assurance-icon verified"><CheckIcon size={12} /></span>{selectedListing.posterVerified ? t.verifiedEmail : selectedListing.source === "sample" ? t.sampleSignal : t.localSignal}</span>
                <span className="assurance-item"><span className="assurance-icon photo"><GalleryIcon size={12} /></span>{selectedPhotos.length} {t.photoCount}</span>
                <span className="assurance-item"><span className="assurance-icon privacy"><LockIcon size={12} /></span>{t.approximate}</span>
              </div>
              <div className="detail-grid">
                <div><small>{t.detailArea}</small><strong>{listingArea(selectedListing)}</strong></div>
                <div><small>{t.detailMoveIn}</small><strong>{listingMoveIn(selectedListing)}</strong></div>
                <div><small>{t.detailLease}</small><strong>{selectedListing.lease}</strong></div>
                <div><small>{t.detailPoster}</small><strong>{listingPoster(selectedListing)}</strong></div>
              </div>
              {listingDescription(selectedListing) && <section className="detail-description">
                <h3 className="drawer-section-heading">{t.detailDescription}</h3>
                <p>{listingDescription(selectedListing)}</p>
              </section>}
              <h3 className="drawer-section-heading">{t.detailAmenities}</h3>
              <div className="tag-row drawer-tags">{listingTags(selectedListing).map((tag) => <span className="listing-tag" key={tag}>{tag}</span>)}</div>
              <div className="drawer-privacy"><div className="privacy-icon"><LockIcon /></div><div><strong>{t.addressPrivate}</strong><p>{listingPrivacy(selectedListing)}</p></div></div>
              <div className="detail-action-dock">
                <button className="primary-button full-button" type="button" onClick={() => { setSelectedListing(null); openContact(selectedListing); }}><ChatIcon />{t.requestTour}</button>
              </div>
              <button className="text-button detail-report-button" type="button" onClick={openReportForListing}>{locale === "zh" ? "举报此房源" : "Report this listing"}</button>
            </div>
          </aside>
        </div>
      )}

      {reportOpen && selectedListing && <ReportDrawer locale={locale} listingTitle={listingTitle(selectedListing)} loading={reportLoading} error={reportError} onClose={() => { setReportOpen(false); setReportError(""); }} onSubmit={submitReport} />}

      {contactListing && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeContact(); }}>
          <aside className="drawer form-drawer" role="dialog" aria-modal="true" aria-labelledby="contact-title">
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">{contactListing.titleEn}</span><button className="drawer-close" type="button" onClick={closeContact} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="contact-title">{t.contactTitle}</h2>
              <p className="drawer-intro">{t.contactIntro}</p>
              <form key={contactListing.id} className="contact-form" onSubmit={submitInquiry}>
                {inquiryError && <p className="form-error" role="alert">{inquiryError}</p>}
                <label className="field-label" htmlFor="contact-move">{t.intendedMove}</label>
                <select id="contact-move" name="moveIn" defaultValue={contactListing.moveIn === "immediate" ? "immediate" : moveInMonth(contactListing.moveIn) || "september"}><option value="immediate">{locale === "zh" ? "立即入住" : "Move in immediately"}</option><option value="august">{locale === "zh" ? "2026年8月" : "Aug 2026"}</option><option value="september">{locale === "zh" ? "2026年9月" : "Sep 2026"}</option><option value="october">{locale === "zh" ? "2026年10月" : "Oct 2026"}</option></select>
                <label className="field-label" htmlFor="contact-lease">{t.leaseLength}</label>
                <select id="contact-lease" name="leaseLength" defaultValue="12"><option value="6">{locale === "zh" ? "6个月" : "6 months"}</option><option value="12">{locale === "zh" ? "12个月" : "12 months"}</option><option value="24">{locale === "zh" ? "24个月以上" : "24+ months"}</option><option value="undefined">{locale === "zh" ? "未确定" : "Undefined"}</option></select>
                <div className="form-row"><div><label className="field-label" htmlFor="contact-occupants">{t.occupants}</label><select id="contact-occupants" name="occupants" defaultValue="1"><option value="1">1</option><option value="2">2</option><option value="3+">3+</option></select></div><div><label className="field-label" htmlFor="contact-pets">{t.petsQuestion}</label><select id="contact-pets" name="pets" defaultValue="no"><option value="no">{t.noPets}</option><option value="yes">{t.yesPets}</option></select></div></div>
                <label className="field-label" htmlFor="contact-tour">{locale === "zh" ? "看房偏好" : "Tour preference"}</label>
                <select id="contact-tour" name="tourPreference" defaultValue="flexible"><option value="flexible">{locale === "zh" ? "时间灵活" : "Flexible"}</option><option value="weekday">{locale === "zh" ? "工作日" : "Weekdays"}</option><option value="weekend">{locale === "zh" ? "周末" : "Weekends"}</option></select>
                <fieldset className="inquiry-comment-options">
                  <legend className="field-label">{locale === "zh" ? "你想了解什么？（可多选）" : "What would you like to know? (Choose any)"}</legend>
                  <div className="comment-options">
                    {INQUIRY_COMMENT_OPTIONS.map((option) => {
                      const selected = selectedInquiryComments.includes(option.value);
                      return <button className={`comment-option ${selected ? "active" : ""}`} key={option.value} type="button" onClick={() => setSelectedInquiryComments((current) => selected ? current.filter((value) => value !== option.value) : [...current, option.value])} aria-pressed={selected}>{selected && <CheckIcon size={12} />}{locale === "zh" ? option.zh : option.en}</button>;
                    })}
                  </div>
                  <p className="field-help">{locale === "zh" ? "可选择多个，选中的内容会和你的消息一起发送给发布者。" : "Choose any number; selected prompts will be sent with your message."}</p>
                </fieldset>
                <label className="field-label" htmlFor="contact-message">{t.message}</label>
                <textarea id="contact-message" name="message" placeholder={t.messagePlaceholder} rows={4} />
                <p className="form-safety"><ShieldIcon size={15} />{locale === "zh" ? "我们不会在这个阶段要求信用资料或受保护特征。" : "We do not ask for credit files or protected traits at this stage."}</p>
                <button className="primary-button full-button" type="submit"><ChatIcon />{t.sendInquiry}</button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {authOpen && <AuthDrawer locale={locale} mode={authMode} loading={authLoading} error={authError} onGoogleLogin={() => { window.location.assign("/api/auth/google"); }} onClose={() => { setAuthOpen(false); setAuthError(""); }} onModeChange={(mode) => { setAuthMode(mode); setAuthError(""); }} onSubmit={handleAuthSubmit} />}

      {accountOpen && currentUser && <AccountDrawer locale={locale} user={currentUser} tab={dashboardTab} listings={dashboardListings} inquiries={receivedInquiries} loading={dashboardLoading} error={dashboardError} resendLoading={resendLoading} resendError={resendError} onClose={() => setAccountOpen(false)} onTabChange={setDashboardTab} onLogout={handleLogout} onResendVerification={handleResendVerification} onViewListing={viewDashboardListing} onEditListing={editDashboardListing} onSetListingStatus={handleDashboardStatus} />}

      {(toast || verificationNotice) && <div className="toast" role="status"><span className="toast-mark"><CheckIcon size={13} /></span>{toast || verificationNotice}</div>}
    </main>
  );
}
