import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "安居 · Anjurentals rental marketplace",
  description:
    "A bilingual rental marketplace prototype with structured listings and privacy-first address reveal.",
  icons: {
    icon: "/brand/anjurentals-mark.svg",
    shortcut: "/brand/anjurentals-mark.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <template
          data-direction-contract="civic-signal-desk"
          dangerouslySetInnerHTML={{
            __html:
              "<!-- THESIS: a rental search that behaves like a clear public service desk, not a low-information classified feed. OWN-WORLD: porcelain paper, enamel blue, visibility lime, tabbed panels, and precise status signals. STORY: compare a synthetic rental, understand the cost and privacy boundary, then start a qualified conversation. FIRST VIEWPORT: utility header, split search workbench, filters to the left, listing image and privacy summary to the right. FORM: comparison desk, assigned surface candidate 7, direction seed 500d0030. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->",
          }}
        />
        {children}
      </body>
    </html>
  );
}
