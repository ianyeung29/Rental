import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminUsageDesk from "../../components/AdminUsageDesk";
import { getCurrentUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API usage · Anjurentals",
  description: "Private Anjurentals API usage and cost monitoring.",
  robots: { index: false, follow: false },
};

export default async function AdminUsagePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.emailVerified || user.role !== "admin") redirect("/");
  return <AdminUsageDesk adminName={user.displayName} />;
}
