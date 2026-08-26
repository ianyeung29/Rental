"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import SiteFooter from "./SiteFooter";

type PublicPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  locale?: "zh" | "en";
  languageHref?: string;
};

export default function PublicPageShell({ title, description, children, locale = "zh", languageHref }: PublicPageShellProps) {
  const english = locale === "en";
  return (
    <div className="public-shell" lang={english ? "en" : "zh-CN"}>
      <a className="skip-link" href="#public-content">{english ? "Skip to main content" : "跳到主要内容"}</a>
      <header className="public-topbar">
        <div className="public-topbar-inner">
          <Link className="brand" href="/" aria-label="安居 Anjurentals home">
            <Image className="brand-logo" src="/brand/anjurentals-mark.svg" alt="" width={30} height={30} priority />
            <span className="brand-wordmark">
              <strong>安居</strong>
              <small>ANJURENTALS</small>
            </span>
          </Link>

          <nav className="public-nav" aria-label={english ? "Public navigation" : "公共导航"}>
            <Link href="/">{english ? "Find rentals" : "找房"}</Link>
            <Link href="/agents">{english ? "Agents" : "经纪目录"}</Link>
            <a href="/about">{english ? "About" : "关于安居"}</a>
            <a href="/contact">{english ? "Contact" : "联系我们"}</a>
            <a href="/feedback">{english ? "Feedback" : "反馈"}</a>
            {languageHref && <Link href={languageHref}>{english ? "中文" : "English"}</Link>}
          </nav>

          <Link className="public-topbar-cta" href="/">{english ? "Post listing" : "发布房源"} <span aria-hidden="true">+</span></Link>
        </div>
      </header>

      <main id="public-content" className="public-main">
        <header className="public-hero">
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
