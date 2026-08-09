export type RenterProfileShareOptions = {
  shareCurrentCity: boolean;
  shareEmployment: boolean;
  shareIncome: boolean;
};

export const DEFAULT_RENTER_PROFILE_SHARING: RenterProfileShareOptions = {
  shareCurrentCity: false,
  shareEmployment: false,
  shareIncome: false,
};

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === 1;
}

export function normalizeRenterProfileSharing(input: Partial<Record<keyof RenterProfileShareOptions, unknown>> | null | undefined): RenterProfileShareOptions {
  return {
    shareCurrentCity: booleanValue(input?.shareCurrentCity),
    shareEmployment: booleanValue(input?.shareEmployment),
    shareIncome: booleanValue(input?.shareIncome),
  };
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function applicationFieldsForSharing(input: {
  currentCity?: unknown;
  employmentStatus?: unknown;
  incomeRange?: unknown;
}, sharing: RenterProfileShareOptions) {
  return {
    currentCity: sharing.shareCurrentCity ? text(input.currentCity, 100) : "",
    employmentStatus: sharing.shareEmployment ? text(input.employmentStatus, 40) : "",
    incomeRange: sharing.shareIncome ? text(input.incomeRange, 40) : "",
  };
}
