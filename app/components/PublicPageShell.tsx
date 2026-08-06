"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import SiteFooter from "./SiteFooter";

type PublicPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export default function PublicPageShell({ title, description, children }: PublicPageShellProps) {
  return (
    <div className="public-shell">
      <a className="skip-link" href="#public-content">跳到主要内容</a>
      <header className="public-topbar">
        <div className="public-topbar-inner">
          <Link className="brand" href="/" aria-label="安居 Anjurentals home">
            <Image className="brand-logo" src="/brand/anjurentals-mark.svg" alt="" width={30} height={30} priority />
            <span className="brand-wordmark">
              <strong>安居</strong>
              <small>ANJURENTALS</small>
            </span>
          </Link>

          <nav className="public-nav" aria-label="公共导航">
            <Link href="/">找房</Link>
            <Link href="/agents">经纪目录</Link>
            <a href="/about">关于安居</a>
            <a href="/contact">联系我们</a>
            <a href="/feedback">反馈</a>
          </nav>

          <Link className="public-topbar-cta" href="/">发布房源 <span aria-hidden="true">+</span></Link>
        </div>
      </header>

      <main id="public-content" className="public-main">
        <header className="public-hero">
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
