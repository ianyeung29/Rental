import type { Metadata } from "next";
import PublicPageShell from "../components/PublicPageShell";
import AgentDirectory from "../components/AgentDirectory";

export const metadata: Metadata = {
  title: "经纪目录 · 安居",
  description: "查看安居平台已核验的房产经纪服务区域、语言、费用说明和已验证评价。",
};

export default function AgentsPage() {
  return (
    <PublicPageShell
      title="把找房和出租的下一步说清楚。"
      description="浏览管理员已核验的经纪档案，按服务区域和语言筛选，并查看来自已验证平台互动的评价。精确执照编号不会显示在公开目录中。"
    >
      <AgentDirectory />
    </PublicPageShell>
  );
}
