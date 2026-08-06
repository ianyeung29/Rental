export const OCCUPANT_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;

export type OccupantCount = (typeof OCCUPANT_OPTIONS)[number];

export function isExactOccupantCount(value: unknown): value is OccupantCount {
  return typeof value === "string" && (OCCUPANT_OPTIONS as readonly string[]).includes(value);
}

export function exactOccupantOrDefault(value: unknown, fallback: OccupantCount = "1"): OccupantCount {
  return isExactOccupantCount(value) ? value : fallback;
}
