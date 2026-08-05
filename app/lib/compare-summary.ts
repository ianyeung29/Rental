export type CompareSummaryLocale = "zh" | "en";

export type CompareListingFacts = {
  id: string;
  title: string;
  area: string;
  price: number;
  bedrooms: string;
  bathrooms: string;
  moveIn: string;
  lease: string;
  features: string[];
  poster: string;
};

export type CompareSummaryContent = {
  headline: string;
  summary: string;
  bestFor: string;
  tradeoffs: string[];
};

function countValue(value: string) {
  const parsed = Number.parseFloat(value.replace("+", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function bedroomLabel(value: string, locale: CompareSummaryLocale) {
  if (value === "0") return locale === "zh" ? "单间" : "studio";
  return locale === "zh" ? `${value} 卧室` : `${value} bedroom${value === "1" ? "" : "s"}`;
}

function bathroomLabel(value: string, locale: CompareSummaryLocale) {
  return locale === "zh" ? `${value} 卫生间` : `${value} bathroom${value === "1" ? "" : "s"}`;
}

function priceLabel(value: number, locale: CompareSummaryLocale) {
  const amount = `$${value.toLocaleString("en-US")}`;
  return locale === "zh" ? `${amount}/月` : `${amount}/month`;
}

export function buildLocalCompareSummary(listings: CompareListingFacts[], locale: CompareSummaryLocale): CompareSummaryContent {
  const [first, second] = listings.slice(0, 2);
  if (!first || !second) {
    return locale === "zh"
      ? {
          headline: "再选一套房源",
          summary: "选择两套房源后，系统会把租金、户型、房源特点和租期放在一起梳理。",
          bestFor: "适合先收集两套候选房源",
          tradeoffs: [],
        }
      : {
          headline: "Choose one more listing",
          summary: "Select two listings to compare rent, layout, features, and lease terms together.",
          bestFor: "Best for building a two-listing shortlist",
          tradeoffs: [],
        };
  }

  const cheaper = first.price <= second.price ? first : second;
  const moreBedrooms = countValue(first.bedrooms) >= countValue(second.bedrooms) ? first : second;
  const moreBathrooms = countValue(first.bathrooms) >= countValue(second.bathrooms) ? first : second;
  const moreFeatures = first.features.length >= second.features.length ? first : second;
  const priceDifference = Math.abs(first.price - second.price);
  const samePrice = priceDifference === 0;
  const sameBedrooms = countValue(first.bedrooms) === countValue(second.bedrooms);
  const sameBathrooms = countValue(first.bathrooms) === countValue(second.bathrooms);
  const sameFeatureCount = first.features.length === second.features.length;

  if (locale === "zh") {
    const priceSentence = samePrice
      ? `两套房源月租都是 ${priceLabel(first.price, locale)}`
      : `${cheaper.title} 月租更低，为 ${priceLabel(cheaper.price, locale)}，每月相差 $${priceDifference.toLocaleString("en-US")}`;
    const layoutSentence = sameBedrooms && sameBathrooms
      ? `两套都是 ${bedroomLabel(first.bedrooms, locale)}、${bathroomLabel(first.bathrooms, locale)}`
      : `${moreBedrooms.title} 的户型更宽裕（${bedroomLabel(moreBedrooms.bedrooms, locale)}、${bathroomLabel(moreBedrooms.bathrooms, locale)}）`;
    const featureSentence = sameFeatureCount
      ? `两套各列出 ${first.features.length} 项房源特点`
      : `${moreFeatures.title} 列出的房源特点更多（${moreFeatures.features.length} 项）`;
    return {
      headline: samePrice ? "租金接近，重点看户型与入住安排" : `${cheaper.title} 更省月租，另一套更适合比较配置`,
      summary: `${priceSentence}；${layoutSentence}。${featureSentence}。还可以结合入住时间（${first.title}：${first.moveIn}；${second.title}：${second.moveIn}）和最短租期（${first.lease} / ${second.lease}）做最后决定。`,
      bestFor: samePrice
        ? "适合在租金相近时，优先按户型、特点和入住时间选择"
        : `预算优先可先看 ${cheaper.title}；如果更在意空间或配置，再重点看 ${moreBedrooms.title === moreBathrooms.title ? moreBedrooms.title : `${moreBedrooms.title} / ${moreBathrooms.title}`}`,
      tradeoffs: [
        `${first.title}：${bedroomLabel(first.bedrooms, locale)} · ${bathroomLabel(first.bathrooms, locale)} · ${first.features.length} 项特点`,
        `${second.title}：${bedroomLabel(second.bedrooms, locale)} · ${bathroomLabel(second.bathrooms, locale)} · ${second.features.length} 项特点`,
        `入住与租期：${first.moveIn} / ${first.lease} 对比 ${second.moveIn} / ${second.lease}`,
      ],
    };
  }

  const priceSentence = samePrice
    ? `Both listings are ${priceLabel(first.price, locale)}`
    : `${cheaper.title} is lower at ${priceLabel(cheaper.price, locale)}, a $${priceDifference.toLocaleString("en-US")} monthly difference`;
  const layoutSentence = sameBedrooms && sameBathrooms
    ? `Both offer ${bedroomLabel(first.bedrooms, locale)} and ${bathroomLabel(first.bathrooms, locale)}`
    : `${moreBedrooms.title} lists the roomier layout (${bedroomLabel(moreBedrooms.bedrooms, locale)}, ${bathroomLabel(moreBedrooms.bathrooms, locale)})`;
  const featureSentence = sameFeatureCount
    ? `Each listing names ${first.features.length} feature${first.features.length === 1 ? "" : "s"}`
    : `${moreFeatures.title} names more listed features (${moreFeatures.features.length})`;
  return {
    headline: samePrice ? "Similar rent; focus on layout and timing" : `${cheaper.title} saves monthly rent; compare the added signals`,
    summary: `${priceSentence}. ${layoutSentence}. ${featureSentence}. Use move-in timing (${first.title}: ${first.moveIn}; ${second.title}: ${second.moveIn}) and minimum lease (${first.lease} / ${second.lease}) for the final decision.`,
    bestFor: samePrice
      ? "Best for choosing by layout, listed features, and move-in timing when rent is similar"
      : `Budget-first renters can start with ${cheaper.title}; renters prioritizing space or amenities should inspect ${moreBedrooms.title === moreBathrooms.title ? moreBedrooms.title : `${moreBedrooms.title} / ${moreBathrooms.title}`}`,
    tradeoffs: [
      `${first.title}: ${bedroomLabel(first.bedrooms, locale)} · ${bathroomLabel(first.bathrooms, locale)} · ${first.features.length} listed feature${first.features.length === 1 ? "" : "s"}`,
      `${second.title}: ${bedroomLabel(second.bedrooms, locale)} · ${bathroomLabel(second.bathrooms, locale)} · ${second.features.length} listed feature${second.features.length === 1 ? "" : "s"}`,
      `Move-in and lease: ${first.moveIn} / ${first.lease} vs ${second.moveIn} / ${second.lease}`,
    ],
  };
}
