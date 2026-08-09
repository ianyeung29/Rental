import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || "https://www.anjurentals.com";

const config: CapacitorConfig = {
  appId: "com.anjurentals.app",
  appName: "Anjurentals",
  webDir: "capacitor-web",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    // Keep top-level WebView navigation inside the Anjurentals web surface.
    // OAuth opens in the system browser and returns through the app deep link.
    allowNavigation: ["anjurentals.com", "www.anjurentals.com"],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
