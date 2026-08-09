export const TOUR_REQUEST_WINDOWS = [
  "any",
  "weekdayDay",
  "weekdayEvening",
  "weekendDay",
  "weekendEvening",
] as const;

export type TourRequestWindow = (typeof TOUR_REQUEST_WINDOWS)[number];

export function isTourRequestWindow(value: unknown): value is TourRequestWindow {
  return typeof value === "string" && (TOUR_REQUEST_WINDOWS as readonly string[]).includes(value);
}
