import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "安居 · Anjurentals",
    short_name: "安居",
    description: "安居房源搜索与租赁市场。",
    lang: "zh-CN",
    dir: "ltr",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f6f4ef",
    theme_color: "#142a44",
    icons: [
      {
        src: "/icons/anjurentals-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/anjurentals-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["real estate", "lifestyle"],
  };
}
