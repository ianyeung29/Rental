"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SiteFooter() {
  const [showSecurityLink, setShowSecurityLink] = useState(false);

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
          <p>纽约华人社区的租房信息工作台。先把租金、租期和隐私边界说清楚，再开始沟通。</p>
        </div>

        <div className="site-footer-links">
          <div>
            <h2>了解安居</h2>
            <a href="/about">关于安居</a>
            <a href="/contact">联系我们</a>
            <a href="/feedback">提交反馈</a>
            <a href="/agents">经纪目录</a>
          </div>
          <div>
            <h2>找房与发布</h2>
            <Link href="/">找房</Link>
            <Link href="/">发布房源</Link>
            <a href="/install">安装到手机桌面</a>
            <a href="/sitemap">网站地图</a>
          </div>
          <div>
            <h2>信任与规则</h2>
            <a href="/legal#privacy">隐私说明</a>
            <a href="/legal#terms">使用条款</a>
            <a href="/legal#fair-housing">公平住房</a>
            {showSecurityLink && <a href="/legal#security">安全与平台边界</a>}
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>© 2026 安居 · ANJURENTALS</span>
          <span>NY / Long Island pilot</span>
          <a href="/legal">法律与平台规则</a>
        </div>
      </div>
    </footer>
  );
}
