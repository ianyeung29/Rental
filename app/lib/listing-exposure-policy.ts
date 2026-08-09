export function savedSearchExposureIsActive(listingId: string, ownerId: string, addonActive: boolean) {
  return Boolean(listingId && ownerId && addonActive);
}
