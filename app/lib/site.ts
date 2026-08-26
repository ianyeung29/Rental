export const PUBLIC_ROUTES = ["/", "/about", "/agents", "/contact", "/feedback", "/install", "/legal", "/legal/en", "/delete-account", "/delete-account/en", "/sitemap"] as const;

export function getSiteUrl() {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  return (configured || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3010")).replace(/\/+$/, "");
}
