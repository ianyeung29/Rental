import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminAgentVerificationDesk from "../../components/AdminAgentVerificationDesk";
import { getCurrentUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "经纪身份核验 · 安居",
  description: "安居管理员审核经纪身份和执照资料。",
  robots: { index: false, follow: false },
};

export default async function AdminAgentVerificationsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.emailVerified || user.role !== "admin") redirect("/");

  return <AdminAgentVerificationDesk adminName={user.displayName} />;
}
