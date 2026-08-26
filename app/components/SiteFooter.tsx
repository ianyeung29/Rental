"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SiteFooter({ locale = "zh" }: { locale?: "zh" | "en" }) {
  const [showSecurityLink, setShowSecurityLink] = useState(false);
  const english = locale === "en";

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSecurityLink(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-top">
          <Link className="site-footer-brand" href="/" aria-label="安居 Anjurentals home">
            <Image className="brand-logo" src="/brand/anjurentals-mark.svg" alt="" width={30} height={30} />
            <span>
              <strong>安居</strong>
              <small>ANJURENTALS</small>
            </span>
          </Link>
          <p>{english ? "A rental marketplace for New York’s Chinese community. Start with clear rent, lease, and privacy expectations before you connect." : "纽约华人社区的租房信息工作台。先把租金、租期和隐私边界说清楚，再开始沟通。"}</p>
        </div>

        <div className="site-footer-links">
          <div>
            <h2>{english ? "About Anjurentals" : "了解安居"}</h2>
            <a href="/about">{english ? "About us" : "关于安居"}</a>
            <a href="/contact">{english ? "Contact us" : "联系我们"}</a>
            <a href="/feedback">{english ? "Send feedback" : "提交反馈"}</a>
            <a href="/agents">{english ? "Agent directory" : "经纪目录"}</a>
          </div>
          <div>
            <h2>{english ? "Find and post" : "找房与发布"}</h2>
            <Link href="/">{english ? "Find rentals" : "找房"}</Link>
            <Link href="/">{english ? "Post a listing" : "发布房源"}</Link>
            <a href="/install">{english ? "Install on your phone" : "安装到手机桌面"}</a>
            <a href="/sitemap">{english ? "Site map" : "网站地图"}</a>
          </div>
          <div>
            <h2>{english ? "Trust and policies" : "信任与规则"}</h2>
            <a href={english ? "/legal/en#privacy" : "/legal#privacy"}>{english ? "Privacy policy" : "隐私说明"}</a>
            <a href={english ? "/delete-account/en" : "/delete-account"}>{english ? "Delete account" : "删除账户"}</a>
            <a href={english ? "/legal/en#terms" : "/legal#terms"}>{english ? "Terms of use" : "使用条款"}</a>
            <a href={english ? "/legal/en#fair-housing" : "/legal#fair-housing"}>{english ? "Fair housing" : "公平住房"}</a>
            {showSecurityLink && <a href={english ? "/legal/en#security" : "/legal#security"}>{english ? "Safety and security" : "安全与平台边界"}</a>}
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>© 2026 安居 · ANJURENTALS</span>
          <span>NY / Long Island pilot</span>
          <a href={english ? "/legal/en" : "/legal"}>{english ? "Legal and platform policies" : "法律与平台规则"}</a>
        </div>
      </div>
    </footer>
  );
}
