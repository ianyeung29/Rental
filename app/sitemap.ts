import type { MetadataRoute } from "next";
import { getSiteUrl, PUBLIC_ROUTES } from "./lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${getSiteUrl()}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "daily" : "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
