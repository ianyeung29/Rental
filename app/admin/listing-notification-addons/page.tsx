import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminListingNotificationAddonsDesk from "../../components/AdminListingNotificationAddonsDesk";
import { getCurrentUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "房源提醒 · 安居",
  description: "安居管理员确认房源提醒增值功能的付款状态。",
  robots: { index: false, follow: false },
};

export default async function AdminListingNotificationAddonsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.emailVerified || user.role !== "admin") redirect("/");
  return <AdminListingNotificationAddonsDesk adminName={user.displayName} />;
}
