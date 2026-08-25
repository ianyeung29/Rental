import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "../components/PublicPageShell";

export const metadata: Metadata = {
  title: "安装安居 Web App · Anjurentals",
  description: "了解如何在 iPhone、iPad 或 Android 手机上把安居添加到主屏幕，像 App 一样使用。",
};

const iosSteps = [
  {
    title: "用 Safari 打开安居",
    body: "请使用 iPhone 或 iPad 自带的 Safari 打开 anjurentals.com。其他浏览器可能不会显示完整的添加选项。",
  },
  {
    title: "打开分享菜单",
    body: "点击 Safari 的“分享”按钮。地址栏在屏幕顶部或底部时，按钮的位置会不同。",
  },
  {
    title: "添加到主屏幕",
    body: "向下滑动并选择“添加到主屏幕”。如看到“作为 Web App 打开”，请保持开启，然后点击“添加”。",
  },
];

const androidSteps = [
  {
    title: "用 Chrome 打开安居",
    body: "请使用 Android 手机上的 Chrome 打开 anjurentals.com。",
  },
  {
    title: "打开浏览器菜单",
    body: "点击右上角的三个点菜单。Chrome 有时会直接显示“安装应用”提示。",
  },
  {
    title: "安装或添加到主屏幕",
    body: "选择“安装应用”或“添加到主屏幕”，确认后安居图标会出现在手机桌面或应用列表中。",
  },
];

type InstallStepsProps = {
  id: string;
  title: string;
  description: string;
  steps: typeof iosSteps;
  note: string;
};

function InstallSteps({ id, title, description, steps, note }: InstallStepsProps) {
  return (
    <section className="install-platform" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p className="install-platform-description">{description}</p>
      <ol className="install-step-list">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="install-platform-note">{note}</p>
    </section>
  );
}

export default function InstallPage() {
  return (
    <PublicPageShell
      title="把安居放到手机桌面。"
      description="不需要在 App Store 或 Google Play 下载。把安居添加到主屏幕后，可以像一般 App 一样打开，并接收你已允许的通知。"
    >
      <section className="install-intro public-section-first" aria-labelledby="install-start-title">
        <div>
          <h2 id="install-start-title">选择你的设备，三步完成。</h2>
          <p>安装后，主屏幕会显示安居图标；下次可直接从图标进入，无需先打开浏览器搜索。</p>
        </div>
        <Link className="primary-button" href="/">打开安居 <span aria-hidden="true">→</span></Link>
      </section>

      <section className="install-guide-grid public-section" aria-label="安装说明">
        <InstallSteps
          id="ios-install-title"
          title="iPhone / iPad：添加到主屏幕"
          description="iOS 需要通过 Safari 添加；这是 Apple 提供的标准方式。"
          steps={iosSteps}
          note="如果没有看到“添加到主屏幕”，请在分享菜单底部选择“编辑操作”，再把它加入常用操作。"
        />
        <InstallSteps
          id="android-install-title"
          title="Android：安装安居"
          description="Chrome 会把安居作为可安装的 Web App 添加到你的设备。"
          steps={androidSteps}
          note="不同 Android 品牌的菜单文字可能略有不同；请查找“安装应用”或“添加到主屏幕”。"
        />
      </section>

      <section className="install-check public-section" aria-labelledby="install-check-title">
        <div>
          <h2 id="install-check-title">完成后，找安居图标。</h2>
          <p>从主屏幕打开安居后，你仍可浏览房源、发布房源和接收已允许的通知。若想移除，只需像其他 App 一样长按图标后删除即可。</p>
        </div>
        <a className="outline-button" href="/contact">需要帮助？联系我们 <span aria-hidden="true">→</span></a>
      </section>
    </PublicPageShell>
  );
}
