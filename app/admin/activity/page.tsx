import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminActivityDesk from "../../components/AdminActivityDesk";
import { getCurrentUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "安全活动日志 · 安居",
  description: "安居管理员查看登录、发布和安全活动信号。",
  robots: { index: false, follow: false },
};

export default async function AdminActivityPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.emailVerified || user.role !== "admin") redirect("/");
  return <AdminActivityDesk adminName={user.displayName} />;
}
