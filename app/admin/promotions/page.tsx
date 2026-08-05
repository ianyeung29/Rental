import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminPromotionsDesk from "../../components/AdminPromotionsDesk";
import { getCurrentUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "推广申请 · 安居",
  description: "安居管理员处理房源推广申请。",
  robots: { index: false, follow: false },
};

export default async function AdminPromotionsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.emailVerified || user.role !== "admin") redirect("/");
  return <AdminPromotionsDesk adminName={user.displayName} />;
}
