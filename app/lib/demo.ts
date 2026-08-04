export function demoModeEnabled() {
  return process.env.NEXT_PUBLIC_DEMO_MODE?.trim().toLowerCase() === "true";
}
