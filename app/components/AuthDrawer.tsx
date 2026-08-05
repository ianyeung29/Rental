"use client";

import { FormEvent } from "react";

type Locale = "zh" | "en";
type AuthMode = "login" | "register";

type AuthDrawerProps = {
  locale: Locale;
  mode: AuthMode;
  loading: boolean;
  error: string;
  onGoogleLogin: () => void;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.27c0-.78-.07-1.54-.23-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
      <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z" />
      <path fill="#FBBC05" d="M6.54 13.58A5.85 5.85 0 0 1 6.23 12c0-.55.11-1.09.31-1.58V7.89H3.3A9.5 9.5 0 0 0 2.5 12c0 1.48.35 2.88.8 4.11l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.46 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 8.11 9.46 6.39 12 6.39Z" />
    </svg>
  );
}

export default function AuthDrawer({ locale, mode, loading, error, onGoogleLogin, onClose, onModeChange, onSubmit }: AuthDrawerProps) {
  const isRegister = mode === "register";
  const zh = locale === "zh";
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer auth-drawer" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="drawer-content">
          <div className="drawer-heading">
            <span className="section-label">{isRegister ? (zh ? "创建账户" : "CREATE ACCOUNT") : (zh ? "账户登录" : "ACCOUNT SIGN IN")}</span>
            <button className="drawer-close" type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><CloseIcon /></button>
          </div>
          <h2 id="auth-title">{isRegister ? (zh ? "建立你的安居账户" : "Create your Anjurentals account") : (zh ? "欢迎回来" : "Welcome back")}</h2>
          <p className="drawer-intro">{isRegister ? (zh ? "账户可以保存你的房源、草稿和咨询记录。" : "Your account keeps listings, drafts, and inquiries connected across devices.") : (zh ? "登录后可以发布房源、管理房源并查看咨询。" : "Sign in to publish listings, manage your rentals, and see inquiries.")}</p>
          <form className="auth-form" onSubmit={onSubmit}>
            {isRegister && <label className="field-label" htmlFor="auth-name">{zh ? "姓名" : "Name"}<input id="auth-name" name="displayName" autoComplete="name" required placeholder={zh ? "请输入姓名" : "Your name"} /></label>}
            <label className="field-label" htmlFor="auth-email">{zh ? "邮箱" : "Email"}<input id="auth-email" name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></label>
            <label className="field-label" htmlFor="auth-password">{zh ? "密码" : "Password"}<input id="auth-password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} required placeholder={zh ? "至少 8 个字符" : "At least 8 characters"} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button full-button" type="submit" disabled={loading}>{loading ? (zh ? "处理中…" : "Working…") : (isRegister ? (zh ? "创建账户" : "Create account") : (zh ? "登录" : "Sign in"))}</button>
          </form>
          <div className="auth-divider" aria-hidden="true"><span>{zh ? "或" : "OR"}</span></div>
          <button className="google-button" type="button" onClick={onGoogleLogin} disabled={loading}><GoogleIcon />{zh ? "使用 Google 登录" : "Continue with Google"}</button>
          <div className="auth-switch">
            <p>{isRegister ? (zh ? "已经有账户？" : "Already have an account?") : (zh ? "还没有账户？" : "New to the marketplace?")}</p>
            <button className="text-button" type="button" onClick={() => onModeChange(isRegister ? "login" : "register")}>{isRegister ? (zh ? "登录" : "Sign in") : (zh ? "创建账户" : "Create an account")}</button>
          </div>
          <p className="form-safety">{zh ? "我们只在账户和咨询流程中使用你的邮箱；精确地址不会出现在公开房源页面。" : "Your email is used for account and inquiry workflows; exact addresses stay private from public listings."}</p>
        </div>
      </aside>
    </div>
  );
}
