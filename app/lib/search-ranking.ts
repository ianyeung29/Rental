export type SearchSortMode = "fit" | "price" | "fresh" | "moveIn" | "verified" | "popular";

export type SearchRankingListing = {
  id: string;
  searchableLocation: string;
  price: number;
  bedrooms: string;
  bathrooms: string;
  squareFeet?: number | null;
  type: string;
  moveIn: string;
  features: string[];
  posterVerified?: boolean;
  popularityScore?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SearchRankingSnapshot = {
  locationVariants: string[];
  minPrice: number;
  maxPrice: number;
  minSqft: number;
  maxSqft: number;
  bedrooms: string;
  bathrooms: string;
  rentalType: string;
  moveIn: string;
  activeFeatures: string[];
};

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function listingFreshnessTimestamp(listing: SearchRankingListing) {
  return timestamp(listing.updatedAt || listing.createdAt);
}

function rangeFit(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value) || (!minimum && !maximum)) return 0;
  if (minimum && value < minimum) return 0;
  if (maximum && value > maximum) return 0;
  if (minimum && maximum && maximum > minimum) {
    const midpoint = (minimum + maximum) / 2;
    const halfRange = (maximum - minimum) / 2;
    return 0.72 + (1 - Math.min(Math.abs(value - midpoint) / halfRange, 1)) * 0.28;
  }
  if (maximum) return 0.78 + (1 - Math.min(value / maximum, 1)) * 0.22;
  return 0.9;
}

function moveInMatches(value: string, selected: string) {
  if (!selected || value === "immediate") return Boolean(value === "immediate" || !selected);
  const month = ({ august: "08", september: "09", october: "10" } as Record<string, string>)[selected] || "";
  if (month && value.slice(5, 7) === month) return true;
  return value.toLocaleLowerCase().includes(selected.slice(0, 3).toLocaleLowerCase());
}

function freshnessBoost(listing: SearchRankingListing) {
  const freshness = listingFreshnessTimestamp(listing);
  if (!freshness) return 0;
  const ageDays = Math.max(0, (Date.now() - freshness) / (24 * 60 * 60 * 1000));
  if (ageDays <= 7) return 5;
  if (ageDays <= 30) return 3;
  return 1;
}

export function listingMatchScore(listing: SearchRankingListing, snapshot: SearchRankingSnapshot) {
  let score = 0;
  const hasLocation = snapshot.locationVariants.length > 0;
  const hasPrice = Boolean(snapshot.minPrice || snapshot.maxPrice);
  const hasSize = Boolean(snapshot.minSqft || snapshot.maxSqft);

  if (hasLocation && snapshot.locationVariants.some((variant) => listing.searchableLocation.includes(variant))) score += 28;
  if (hasPrice) score += rangeFit(listing.price, snapshot.minPrice, snapshot.maxPrice) * 16;
  if (snapshot.bedrooms) score += listing.bedrooms === snapshot.bedrooms ? 12 : 0;
  if (snapshot.bathrooms) score += listing.bathrooms === snapshot.bathrooms ? 12 : 0;
  if (hasSize && typeof listing.squareFeet === "number") score += rangeFit(listing.squareFeet, snapshot.minSqft, snapshot.maxSqft) * 10;
  if (snapshot.rentalType !== "all") score += listing.type === snapshot.rentalType ? 10 : 0;
  if (snapshot.moveIn && moveInMatches(listing.moveIn, snapshot.moveIn)) score += 8;
  if (snapshot.activeFeatures.length > 0) {
    const featureMatchRatio = snapshot.activeFeatures.filter((feature) => listing.features.includes(feature)).length / snapshot.activeFeatures.length;
    score += featureMatchRatio * 12;
  }

  score += listing.posterVerified ? 5 : 0;
  score += freshnessBoost(listing);
  score += Math.min(Math.log2(Number(listing.popularityScore || 0) + 1), 5);
  return score;
}

function moveInSortValue(value: string) {
  if (value === "immediate") return 0;
  const parsed = timestamp(value);
  return parsed || Number.POSITIVE_INFINITY;
}

function stableFallback(aOrder: number, bOrder: number) {
  return aOrder - bOrder;
}

export function compareListingsForSearch(
  a: SearchRankingListing,
  b: SearchRankingListing,
  mode: SearchSortMode,
  snapshot: SearchRankingSnapshot,
  aOrder: number,
  bOrder: number,
) {
  const freshnessDifference = listingFreshnessTimestamp(b) - listingFreshnessTimestamp(a);
  const popularityDifference = Number(b.popularityScore || 0) - Number(a.popularityScore || 0);
  const verificationDifference = Number(Boolean(b.posterVerified)) - Number(Boolean(a.posterVerified));

  if (mode === "price") return a.price - b.price || freshnessDifference || stableFallback(aOrder, bOrder);
  if (mode === "popular") return popularityDifference || freshnessDifference || verificationDifference || stableFallback(aOrder, bOrder);
  if (mode === "fresh") return freshnessDifference || popularityDifference || stableFallback(aOrder, bOrder);
  if (mode === "verified") return verificationDifference || freshnessDifference || popularityDifference || stableFallback(aOrder, bOrder);
  if (mode === "moveIn") return moveInSortValue(a.moveIn) - moveInSortValue(b.moveIn) || freshnessDifference || stableFallback(aOrder, bOrder);

  return listingMatchScore(b, snapshot) - listingMatchScore(a, snapshot)
    || freshnessDifference
    || verificationDifference
    || popularityDifference
    || stableFallback(aOrder, bOrder);
}
