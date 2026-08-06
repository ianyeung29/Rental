import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminReportsDesk from "../../components/AdminReportsDesk";
import { getCurrentUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "安全审核 · 安居",
  description: "安居管理员处理房源安全举报和公开状态。",
  robots: { index: false, follow: false },
};

export default async function AdminReportsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.emailVerified || user.role !== "admin") redirect("/");
  return <AdminReportsDesk adminName={user.displayName} />;
}
