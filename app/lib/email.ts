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
  if (!apiKey) throw new EmailError("Resend is not configured: RESEND_API_KEY is missing.");
  if (!from) throw new EmailError("Resend is not configured: RESEND_FROM_EMAIL is missing.");
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

function resendFailure(error: unknown, fallback: string) {
  const providerMessage = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message.trim() : "";
  return new EmailError(providerMessage ? `Resend: ${providerMessage}` : fallback, 502);
}

export async function sendVerificationEmail(input: { email: string; displayName: string; token: string }) {
  const { apiKey, from, appUrl } = config();
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(input.token)}`;
  const name = escapeHtml(input.displayName);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: "验证你的安居账户",
    text: `你好 ${input.displayName}，\n\n请打开以下链接验证你的安居账户：\n${verifyUrl}\n\n此链接将在 24 小时后失效。`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:30px;line-height:1.15;margin:24px 0 12px">验证你的安居账户</h1><p style="font-size:15px;line-height:1.7">你好 ${name}，请点击下面的按钮完成邮箱验证。</p><p style="margin:28px 0"><a href="${verifyUrl}" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">验证邮箱</a></p><p style="color:#637384;font-size:12px;line-height:1.6">如果按钮无法打开，请复制此链接：<br>${verifyUrl}<br><br>链接将在 24 小时后失效。</p></main></body></html>`,
  });
  if (error) throw resendFailure(error, "Resend could not send the verification email.");
}

export async function sendPasswordResetEmail(input: { email: string; displayName: string; token: string }) {
  const { apiKey, from, appUrl } = config();
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(input.token)}`;
  const name = escapeHtml(input.displayName || "there");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: "Reset your Anjurentals password / 重置安居密码",
    text: `Hello ${input.displayName || "there"},\n\nReset your Anjurentals password here:\n${resetUrl}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:30px;line-height:1.15;margin:24px 0 12px">Reset your password</h1><p style="font-size:15px;line-height:1.7">Hello ${name}, use the button below to choose a new Anjurentals password. 此链接将在一小时后失效。</p><p style="margin:28px 0"><a href="${resetUrl}" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">Reset password / 重置密码</a></p><p style="color:#637384;font-size:12px;line-height:1.6">If you did not request this, you can ignore this email. 如果不是你本人操作，请忽略此邮件。<br><br>${resetUrl}</p></main></body></html>`,
  });
  if (error) throw resendFailure(error, "Resend could not send the password reset email.");
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
  tourRequestedDate?: string | null;
  tourRequestedWindow?: string;
  message: string;
};

function tourWindowLabel(value?: string) {
  const labels: Record<string, string> = {
    weekdayDay: "工作日白天",
    weekdayEvening: "工作日晚上",
    weekendDay: "周末白天",
    weekendEvening: "周末晚上",
  };
  return labels[value || ""] || "时间不限";
}

function inquiryText(input: InquiryEmailInput) {
  return [
    `房源：${input.listingTitle}`,
    `咨询人：${input.requesterName} <${input.requesterEmail}>`,
    `预计入住：${input.moveIn}`,
    `租期：${input.leaseLength}`,
    `居住人数：${input.occupants}`,
    `宠物：${input.pets}`,
    `看房偏好：${input.tourPreference}`,
    input.tourRequestedDate ? `希望看房日期：${input.tourRequestedDate}` : "希望看房日期：未指定",
    `希望看房时段：${tourWindowLabel(input.tourRequestedWindow)}`,
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
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">你收到一条房源咨询</h1><p style="font-size:15px;line-height:1.7">你好 ${recipientName}，${requesterName} 正在咨询「${listingTitle}」。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7">${details}</p><p style="color:#637384;font-size:12px;line-height:1.6">直接回复此邮件即可联系咨询人：${requesterEmail}</p></main></body></html>`,
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
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">咨询已发送</h1><p style="font-size:15px;line-height:1.7">你的咨询已发送给「${listingTitle}」的发布者。请等待对方回复。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7">${details}</p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the inquiry confirmation.", 502);
}

type InquiryStatusUpdateInput = {
  recipientEmail: string;
  recipientName: string;
  listingTitle: string;
  status: "tourScheduled" | "closed" | "contacted";
  scheduledAt?: string | null;
  timeZone?: string;
  tourNote?: string;
};

function tourDateLabel(value: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(value));
  } catch {
    return value;
  }
}

export async function sendInquiryStatusUpdate(input: InquiryStatusUpdateInput) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const recipientName = escapeHtml(input.recipientName || "租客");
  const listingTitle = escapeHtml(input.listingTitle);
  const scheduledAt = input.scheduledAt ? tourDateLabel(input.scheduledAt, input.timeZone || "UTC") : "";
  const note = input.tourNote?.trim() || "无补充说明";
  const title = input.status === "tourScheduled" ? "看房时间已安排" : input.status === "closed" ? "房源咨询已完成" : "房源咨询有新进展";
  const details = input.status === "tourScheduled"
    ? `看房时间：${scheduledAt}\n时区：${input.timeZone || "UTC"}\n补充说明：${note}`
    : input.status === "closed" ? "这条咨询已被标记为完成。" : "发布者已更新这条咨询的状态。";
  const { error } = await resend.emails.send({
    from,
    to: [input.recipientEmail],
    subject: `${title} · ${input.listingTitle}`,
    text: `你好 ${input.recipientName || "租客"}，\n\n「${input.listingTitle}」${title}。\n\n${details}\n\n登录安居查看：${appUrl}/#messages`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">${title}</h1><p style="font-size:15px;line-height:1.7">你好 ${recipientName}，房源「${listingTitle}」有新的咨询进展。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7">${escapeHtml(details).replace(/\n/g, "<br>")}</p><p style="margin:28px 0"><a href="${appUrl}/#messages" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">查看咨询</a></p><p style="color:#637384;font-size:12px;line-height:1.6">如时间或安排有变化，请在安居中联系房源发布者确认。</p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the inquiry status update.", 502);
}

export async function sendTourReminder(input: { recipientEmail: string; recipientName: string; listingTitle: string; scheduledAt: string; timeZone: string; note: string }) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const recipientName = escapeHtml(input.recipientName || "安居用户");
  const listingTitle = escapeHtml(input.listingTitle);
  const scheduledAt = tourDateLabel(input.scheduledAt, input.timeZone || "UTC");
  const note = escapeHtml(input.note || "无补充说明");
  const details = `看房时间：${scheduledAt}\n时区：${input.timeZone || "UTC"}\n备注：${input.note || "无补充说明"}`;
  const { error } = await resend.emails.send({
    from,
    to: [input.recipientEmail],
    subject: `看房提醒 · ${input.listingTitle}`,
    text: `你好 ${input.recipientName || "安居用户"}，\n\n明天有一场「${input.listingTitle}」的看房安排。\n\n${details}\n\n登录安居查看详情：${appUrl}/#messages`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">看房提醒</h1><p style="font-size:15px;line-height:1.7">你好 ${recipientName}，明天有一场「${listingTitle}」的看房安排。</p><p style="padding:16px;background:#f4f8d4;font-size:13px;line-height:1.7">看房时间：${scheduledAt}<br>时区：${escapeHtml(input.timeZone || "UTC")}<br>备注：${note}</p><p style="margin:28px 0"><a href="${appUrl}/#messages" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">查看看房安排</a></p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the tour reminder.", 502);
}

type ApplicationNotificationInput = {
  recipientEmail: string;
  recipientName: string;
  listingTitle: string;
  listingArea: string;
  applicantName: string;
  applicantEmail: string;
  phone: string;
  currentCity?: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  employmentStatus: string;
  incomeRange: string;
  message: string;
};

function applicationDetails(input: ApplicationNotificationInput) {
  return [
    ...(input.currentCity ? [`Current city: ${input.currentCity}`] : []),
    `房源：${input.listingTitle}`,
    `区域：${input.listingArea || "未提供"}`,
    `申请人：${input.applicantName} <${input.applicantEmail}>`,
    `电话：${input.phone}`,
    `入住：${input.moveIn}`,
    `租期：${input.leaseLength}`,
    `居住人数：${input.occupants}`,
    `宠物：${input.pets}`,
    `工作情况：${input.employmentStatus || "未提供"}`,
    `收入范围：${input.incomeRange || "未提供"}`,
    input.message ? `补充信息：${input.message}` : "补充信息：无",
  ].join("\n");
}

export async function sendApplicationNotification(input: ApplicationNotificationInput) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const recipientName = escapeHtml(input.recipientName || "房源发布者");
  const listingTitle = escapeHtml(input.listingTitle);
  const applicantName = escapeHtml(input.applicantName);
  const details = escapeHtml(applicationDetails(input)).replace(/\n/g, "<br>");
  const { error } = await resend.emails.send({
    from,
    to: [input.recipientEmail],
    replyTo: input.applicantEmail,
    subject: `收到新的租赁申请 · ${input.listingTitle}`,
    text: `你好 ${input.recipientName || "房源发布者"}，\n\n${applicationDetails(input)}\n\n登录安居查看并处理申请：${appUrl}/#messages`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">收到新的租赁申请</h1><p style="font-size:15px;line-height:1.7">你好 ${recipientName}，${applicantName} 申请了「${listingTitle}」。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7">${details}</p><p style="margin:28px 0"><a href="${appUrl}/#messages" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">打开申请工作台</a></p><p style="color:#637384;font-size:12px;line-height:1.6">你可以在安居中更新申请状态。申请阶段不会要求上传身份证件或信用文件。</p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the rental application notification.", 502);
}

type ApplicationStatusUpdateInput = {
  recipientEmail: string;
  recipientName: string;
  listingTitle: string;
  status: "submitted" | "reviewing" | "approved" | "declined" | "withdrawn";
  note: string;
  recipientRole: "renter" | "owner";
};

export async function sendApplicationStatusUpdate(input: ApplicationStatusUpdateInput) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const title = input.status === "approved"
    ? "租赁申请已通过"
    : input.status === "declined"
      ? "租赁申请未通过"
      : input.status === "reviewing"
        ? "租赁申请正在审核"
        : input.status === "withdrawn"
          ? "租客撤回了申请"
          : "租赁申请已提交";
  const note = input.note?.trim() || "无补充说明";
  const recipientName = escapeHtml(input.recipientName || (input.recipientRole === "renter" ? "租客" : "房源发布者"));
  const listingTitle = escapeHtml(input.listingTitle);
  const details = escapeHtml(`房源：${input.listingTitle}\n状态：${title}\n备注：${note}`).replace(/\n/g, "<br>");
  const { error } = await resend.emails.send({
    from,
    to: [input.recipientEmail],
    subject: `${title} · ${input.listingTitle}`,
    text: `你好 ${input.recipientName || (input.recipientRole === "renter" ? "租客" : "房源发布者")}，\n\n「${input.listingTitle}」${title}。\n\n备注：${note}\n\n登录安居查看详情：${appUrl}/#messages`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">${title}</h1><p style="font-size:15px;line-height:1.7">你好 ${recipientName}，申请「${listingTitle}」的状态有更新。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7">${details}</p><p style="margin:28px 0"><a href="${appUrl}/#messages" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">查看申请</a></p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the application status update.", 502);
}

type AgentRequestNotificationInput = {
  recipientEmail: string;
  recipientName: string;
  listingTitle: string;
  listingArea: string;
  ownerName: string;
  ownerEmail: string;
  agentName: string;
  feeLabel: string;
};

export async function sendAgentRequestNotification(input: AgentRequestNotificationInput) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const recipientName = escapeHtml(input.recipientName || "房产经纪");
  const listingTitle = escapeHtml(input.listingTitle);
  const listingArea = escapeHtml(input.listingArea);
  const ownerName = escapeHtml(input.ownerName);
  const ownerEmail = escapeHtml(input.ownerEmail);
  const agentName = escapeHtml(input.agentName);
  const feeLabel = escapeHtml(input.feeLabel);
  const accountUrl = `${appUrl}/#top`;
  const { error } = await resend.emails.send({
    from,
    to: [input.recipientEmail],
    replyTo: input.ownerEmail,
    subject: `新的经纪协助请求 · ${input.listingTitle}`,
    text: `你好 ${input.recipientName || "房产经纪"}，\n\n${input.ownerName} 为「${input.listingTitle}」请求经纪协助。\n大致区域：${input.listingArea}\n费用意向：${input.feeLabel}\n\n请登录安居账户查看并接受或拒绝：${accountUrl}`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">你收到一项经纪协助请求</h1><p style="font-size:15px;line-height:1.7">你好 ${recipientName}，${ownerName} 正在为「${listingTitle}」请求你的协助。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7"><strong>${agentName}</strong><br>房源区域：${listingArea}<br>费用意向：${feeLabel}<br>房主邮箱：${ownerEmail}</p><p style="margin:28px 0"><a href="${accountUrl}" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">查看请求</a></p><p style="color:#637384;font-size:12px;line-height:1.6">请先在安居账户中确认，再与房主沟通合作细节。</p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the agent request notification.", 502);
}

export async function sendAgentRequestResponse(input: AgentRequestNotificationInput & { status: "accepted" | "declined"; agentNote: string }) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const recipientName = escapeHtml(input.recipientName || "房主");
  const listingTitle = escapeHtml(input.listingTitle);
  const listingArea = escapeHtml(input.listingArea);
  const agentName = escapeHtml(input.agentName);
  const feeLabel = escapeHtml(input.feeLabel);
  const agentNote = escapeHtml(input.agentNote || "无补充留言");
  const statusText = input.status === "accepted" ? "经纪已接受你的请求" : "经纪暂时无法接受你的请求";
  const accountUrl = `${appUrl}/#top`;
  const { error } = await resend.emails.send({
    from,
    to: [input.recipientEmail],
    replyTo: input.ownerEmail,
    subject: `${statusText} · ${input.listingTitle}`,
    text: `你好 ${input.recipientName || "房主"}，\n\n${input.agentName} ${input.status === "accepted" ? "已接受" : "暂时无法接受"}你对「${input.listingTitle}」的经纪协助请求。\n大致区域：${input.listingArea}\n费用意向：${input.feeLabel}\n经纪留言：${input.agentNote || "无补充留言"}\n\n登录安居账户查看详情：${accountUrl}`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">${statusText}</h1><p style="font-size:15px;line-height:1.7">你好 ${recipientName}，${agentName} 已更新「${listingTitle}」的协助请求。</p><p style="padding:16px;background:${input.status === "accepted" ? "#f4f8d4" : "#fff3ee"};font-size:13px;line-height:1.7">房源区域：${listingArea}<br>费用意向：${feeLabel}<br>经纪留言：${agentNote}</p><p style="margin:28px 0"><a href="${accountUrl}" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">查看房源工作台</a></p></main></body></html>`,
  });
  if (error) throw new EmailError("Resend could not send the agent request response.", 502);
}

export async function sendSavedSearchAlert(input: { email: string; displayName: string; location: string; listingTitles: string[] }) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const name = escapeHtml(input.displayName || "租客");
  const location = escapeHtml(input.location || "你保存的搜索条件");
  const titles = input.listingTitles.slice(0, 8).map((title) => escapeHtml(title));
  const listingText = titles.join("\n");
  const listingHtml = titles.map((title) => `<li>${title}</li>`).join("");
  const { error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: `安居搜索提醒 · ${input.listingTitles.length} 套新房源`,
    text: `你好 ${input.displayName || "租客"}，\n\n你的搜索「${input.location || "已保存条件"}」发现了 ${input.listingTitles.length} 套新房源：\n${listingText}\n\n打开安居继续查看：${appUrl}/#rentals`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">你的搜索有新房源</h1><p style="font-size:15px;line-height:1.7">你好 ${name}，搜索「${location}」发现了 ${input.listingTitles.length} 套新房源。</p><ul style="padding:16px 16px 16px 34px;background:#edf3ff;font-size:13px;line-height:1.8">${listingHtml}</ul><p style="margin:28px 0"><a href="${appUrl}/#rentals" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">查看新房源</a></p></main></body></html>`,
  });
  if (error) throw resendFailure(error, "Resend could not send the saved search alert.");
}

type PublicMessageInput = {
  name: string;
  email: string;
  message: string;
};

type SiteContactEmailInput = PublicMessageInput & {
  topic: string;
};

type SiteFeedbackEmailInput = {
  name: string;
  email: string;
  type: string;
  message: string;
  pageUrl: string;
};

function publicRecipient(variable: "CONTACT_RECIPIENT_EMAIL" | "FEEDBACK_RECIPIENT_EMAIL") {
  const recipient = process.env[variable]?.trim() || process.env.SITE_CONTACT_EMAIL?.trim();
  if (!recipient) throw new EmailError(`Resend is not configured: ${variable} or SITE_CONTACT_EMAIL is missing.`);
  if (/[\r\n]/.test(recipient)) throw new EmailError(`Resend is not configured: ${variable} is invalid.`);
  return recipient;
}

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function subjectText(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
}

function publicEmailHtml(title: string, intro: string, details: string, footer: string) {
  return `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:600px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.7">${escapeHtml(intro)}</p><div style="padding:18px;background:#edf3ff;font-size:13px;line-height:1.8">${escapeHtml(details).replace(/\n/g, "<br>")}</div><p style="color:#637384;font-size:12px;line-height:1.6">${escapeHtml(footer)}</p></main></body></html>`;
}

export async function sendSiteContactEmail(input: SiteContactEmailInput) {
  const { apiKey, from } = config();
  const to = publicRecipient("CONTACT_RECIPIENT_EMAIL");
  const resend = new Resend(apiKey);
  const replyTo = emailLooksValid(input.email) ? input.email : undefined;
  const text = `姓名：${input.name}\n邮箱：${input.email}\n问题类型：${input.topic}\n\n${input.message}`;
  const { error } = await resend.emails.send({
    from,
    to: [to],
    ...(replyTo ? { replyTo } : {}),
    subject: `[安居联系] ${input.topic} · ${subjectText(input.name)}`,
    text,
    html: publicEmailHtml("收到一条联系留言", `${input.name} 通过安居联系我们。`, text, "你可以直接回复此邮件联系留言者。"),
  });
  if (error) throw resendFailure(error, "Resend could not send the contact message.");
}

export async function sendSiteFeedbackEmail(input: SiteFeedbackEmailInput) {
  const { apiKey, from } = config();
  const to = publicRecipient("FEEDBACK_RECIPIENT_EMAIL");
  const resend = new Resend(apiKey);
  const replyTo = emailLooksValid(input.email) ? input.email : undefined;
  const text = `姓名：${input.name || "未填写"}\n邮箱：${input.email || "未填写"}\n反馈类型：${input.type}\n页面：${input.pageUrl || "未提供"}\n\n${input.message}`;
  const { error } = await resend.emails.send({
    from,
    to: [to],
    ...(replyTo ? { replyTo } : {}),
    subject: `[安居反馈] ${input.type}${input.name ? ` · ${subjectText(input.name)}` : ""}`,
    text,
    html: publicEmailHtml("收到一条产品反馈", `${input.name || "一位用户"} 通过安居提交了反馈。`, text, "如果用户留下邮箱，可以直接回复此邮件。"),
  });
  if (error) throw resendFailure(error, "Resend could not send the feedback message.");
}

type ModerationDecisionStatus = "approved" | "under_review" | "hidden" | "rejected";

export async function sendModerationDecision(input: {
  email: string;
  displayName: string;
  listingTitle: string;
  area: string;
  status: ModerationDecisionStatus;
  note: string;
}) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const labels: Record<ModerationDecisionStatus, [string, string]> = {
    approved: ["房源已恢复公开", "Listing restored to public view"],
    under_review: ["房源正在审核中", "Listing is under review"],
    hidden: ["房源已暂时隐藏", "Listing temporarily hidden"],
    rejected: ["房源未通过审核", "Listing was not approved"],
  };
  const [titleZh, titleEn] = labels[input.status];
  const detail = [
    `房源：${input.listingTitle}`,
    input.area ? `区域：${input.area}` : "",
    `审核状态：${titleZh}`,
    input.note ? `审核说明：${input.note}` : "",
  ].filter(Boolean).join("\n");
  const escapedName = escapeHtml(input.displayName || "房源发布者");
  const escapedDetail = escapeHtml(detail).replace(/\n/g, "<br>");
  const { error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: `安居 · ${titleEn} · ${subjectText(input.listingTitle)}`,
    text: `你好 ${input.displayName || "房源发布者"}，\n\n${detail}\n\n请登录安居查看房源状态：${appUrl}/#account`,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">${titleZh}</h1><p style="font-size:15px;line-height:1.7">你好 ${escapedName}，管理员已更新你的房源审核状态。</p><p style="padding:16px;background:#edf3ff;font-size:13px;line-height:1.7">${escapedDetail}</p><p style="margin:28px 0"><a href="${appUrl}/#account" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">查看房源工作台</a></p></main></body></html>`,
  });
  if (error) throw resendFailure(error, "Resend could not send the moderation decision.");
}

export async function sendListingExpirationAlert(input: { email: string; displayName: string; listingTitle: string; expiresOn: string }) {
  const { apiKey, from, appUrl } = config();
  const resend = new Resend(apiKey);
  const name = escapeHtml(input.displayName || "房源发布者");
  const title = escapeHtml(input.listingTitle || "你的房源");
  const expiresOn = escapeHtml(input.expiresOn);
  const text = `你好 ${input.displayName || "房源发布者"}，\n\n房源「${input.listingTitle || "你的房源"}」将在 ${input.expiresOn} 到期并从公开搜索中隐藏。\n\n登录安居工作台续期或修改房源：${appUrl}/#account`;
  const { error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: `房源即将到期 · ${input.listingTitle || "你的房源"}`,
    text,
    html: `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">房源即将到期</h1><p style="font-size:15px;line-height:1.7">你好 ${name}，房源「${title}」将在 ${expiresOn} 到期。</p><p style="padding:16px;background:#fff3ee;font-size:13px;line-height:1.7">到期后房源会从公开搜索中隐藏。你可以在安居工作台续期、暂停或修改房源。</p><p style="margin:28px 0"><a href="${appUrl}/#account" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">打开房源工作台</a></p></main></body></html>`,
  });
  if (error) throw resendFailure(error, "Resend could not send the listing expiration alert.");
}

export async function sendUsageAlertEmail(input: { recipients: string[]; provider: string; metric: string; message: string; period: string }) {
  const { apiKey, from, appUrl } = config();
  const recipients = input.recipients.map((value) => value.trim()).filter(Boolean).slice(0, 10);
  if (!recipients.length) throw new EmailError("No verified admin recipients are configured for usage alerts.");
  const resend = new Resend(apiKey);
  const subject = `Anjurentals usage alert · ${input.provider} · ${input.metric}`;
  const text = [
    "Anjurentals usage alert",
    "",
    `Provider: ${input.provider}`,
    `Metric: ${input.metric}`,
    `Period: ${input.period}`,
    `Status: ${input.message}`,
    "",
    `Open the admin usage desk: ${appUrl}/admin/usage`,
  ].join("\n");
  const details = escapeHtml(text).replace(/\n/g, "<br>");
  const { error } = await resend.emails.send({
    from,
    to: recipients,
    subject,
    text,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f3f6f1;color:#142a44;font-family:Arial,'Microsoft YaHei',sans-serif"><main style="max-width:560px;margin:0 auto;padding:42px 24px"><p style="color:#637384;font-size:12px;letter-spacing:.12em;font-weight:700">安居 · ANJURENTALS</p><h1 style="font-size:28px;line-height:1.15;margin:24px 0 12px">Usage threshold alert</h1><p style="padding:16px;background:#fffceb;font-size:13px;line-height:1.7">${details}</p><p style="margin:28px 0"><a href="${appUrl}/admin/usage" style="display:inline-block;padding:13px 18px;background:#2768f0;color:#fff;text-decoration:none;font-weight:700">Open usage desk</a></p></main></body></html>`,
  });
  if (error) throw resendFailure(error, "Resend could not send the usage alert.");
}
