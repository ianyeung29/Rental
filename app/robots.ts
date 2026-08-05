import type { MetadataRoute } from "next";
import { getSiteUrl } from "./lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/_next/"] },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
