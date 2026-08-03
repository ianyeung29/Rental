import { Resend } from "resend";

export class EmailError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.status = status;
  }
}

function config() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3010")).replace(/\/+$/, "");
  if (!apiKey || !from) throw new EmailError("Resend email is not configured on the server yet.");
  return { apiKey, from, appUrl };
}

export function emailIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

export async function sendVerificationEmail(input: { email: string; displayName: string; token: string }) {
  const { apiKey, from, appUrl } = config();
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(input.token)}`;
  const name = escapeHtml(input.displayName);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: "验证你的租住账户",
    text: `你好 ${input.displayName}，\n\n请打开以下链接验证你的租住账户：\n${verifyUrl}\n\n此链接将在 24 小时后失效。`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">租住 · RENTALS</p><h1 style="font-size:30px;line-height:1.15;margin:24px 0 12px">验证你的租住账户</h1><p style="font-size:15px;line-height:1.7">你好 ${name}，请点击下面的按钮完成邮箱验证。</p><p style="margin:28px 0"><a href="${verifyUrl}" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">验证邮箱</a></p><p style="color:#637384;font-size:12px;line-height:1.6">如果按钮无法打开，请复制此链接：<br>${verifyUrl}<br><br>链接将在 24 小时后失效。</p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the verification email.", 502);
}

type InquiryEmailInput = {
  recipientEmail: string;
  recipientName: string;
  listingTitle: string;
  requesterName: string;
  requesterEmail: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  tourPreference: string;
  message: string;
};

function inquiryText(input: InquiryEmailInput) {
  return [
    `房源：${input.listingTitle}`,
    `咨询人：${input.requesterName} <${input.requesterEmail}>`,
    `预计入住：${input.moveIn}`,
    `租期：${input.leaseLength}`,
    `居住人数：${input.occupants}`,
    `宠物：${input.pets}`,
    `看房偏好：${input.tourPreference}`,
    input.message ? `补充信息：${input.message}` : "补充信息：无",
  ].join("\n");
}

export async function sendInquiryNotification(input: InquiryEmailInput) {
  const { apiKey, from } = config();
  const resend = new Resend(apiKey);
  const recipientName = escapeHtml(input.recipientName || "房源发布者");
  const listingTitle = escapeHtml(input.listingTitle);
  const requesterName = escapeHtml(input.requesterName);
  const requesterEmail = escapeHtml(input.requesterEmail);
  const details = escapeHtml(inquiryText(input)).replace(/\n/g, "<br>");
  const { error } = await resend.emails.send({
    from,
    to: [input.recipientEmail],
    replyTo: input.requesterEmail,
    subject: `有人咨询你的房源 · ${input.listingTitle}`,
    text: `你好 ${input.recipientName || "房源发布者"}，\n\n${inquiryText(input)}\n\n你可以直接回复这封邮件联系咨询人。`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">租住 · RENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">你收到一条房源咨询</h1><p style="font-size:15px;line-height:1.7">你好 ${recipientName}，${requesterName} 正在咨询「${listingTitle}」。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7">${details}</p><p style="color:#637384;font-size:12px;line-height:1.6">直接回复此邮件即可联系咨询人：${requesterEmail}</p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the inquiry notification.", 502);
}

export async function sendInquiryConfirmation(input: InquiryEmailInput) {
  const { apiKey, from } = config();
  const resend = new Resend(apiKey);
  const listingTitle = escapeHtml(input.listingTitle);
  const details = escapeHtml(inquiryText(input)).replace(/\n/g, "<br>");
  const { error } = await resend.emails.send({
    from,
    to: [input.requesterEmail],
    subject: `咨询已发送 · ${input.listingTitle}`,
    text: `你的咨询已发送给房源发布者。\n\n${inquiryText(input)}`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">租住 · RENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">咨询已发送</h1><p style="font-size:15px;line-height:1.7">你的咨询已发送给「${listingTitle}」的发布者。请等待对方回复。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7">${details}</p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the inquiry confirmation.", 502);
}
