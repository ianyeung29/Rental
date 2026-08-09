export const OWNER_STALE_DAYS = 14;

export type ReplyTemplate = {
  id: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  isDefault?: boolean;
};

export const DEFAULT_REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: "default-tour",
    titleZh: "安排看房",
    titleEn: "Arrange a tour",
    bodyZh: "你好 {{renter}}，谢谢你咨询“{{listing}}”。房源目前仍可安排看房。请告诉我你方便的日期和时间，我会尽快确认。",
    bodyEn: "Hi {{renter}}, thanks for asking about “{{listing}}”. The listing is still available for a tour. Share a date and time that works for you and I’ll confirm it shortly.",
    isDefault: true,
  },
  {
    id: "default-availability",
    titleZh: "确认房源仍可租",
    titleEn: "Confirm availability",
    bodyZh: "你好 {{renter}}，谢谢你的消息。“{{listing}}”目前仍可租。请告诉我你的预计入住时间和租期，我会回复下一步安排。",
    bodyEn: "Hi {{renter}}, thanks for reaching out. “{{listing}}” is still available. Please share your expected move-in date and lease length so I can confirm the next step.",
    isDefault: true,
  },
  {
    id: "default-follow-up",
    titleZh: "跟进咨询",
    titleEn: "Follow up",
    bodyZh: "你好 {{renter}}，想跟进一下你对“{{listing}}”的咨询。如果你仍然感兴趣，请告诉我，我可以继续安排看房或回答问题。",
    bodyEn: "Hi {{renter}}, I wanted to follow up on your inquiry about “{{listing}}”. If you’re still interested, let me know and I can arrange a tour or answer your questions.",
    isDefault: true,
  },
];

export function listingNeedsAvailabilityConfirmation(input: {
  status: string;
  availabilityAnchor?: string | null;
  now?: Date;
  staleDays?: number;
}) {
  if (input.status !== "published" || !input.availabilityAnchor) return false;
  const anchor = new Date(input.availabilityAnchor).getTime();
  if (!Number.isFinite(anchor)) return false;
  const now = input.now?.getTime() ?? Date.now();
  const staleDays = Number.isFinite(input.staleDays) && (input.staleDays || 0) > 0 ? input.staleDays || OWNER_STALE_DAYS : OWNER_STALE_DAYS;
  return now - anchor >= staleDays * 24 * 60 * 60 * 1000;
}

export function personalizeReply(value: string, input: { renter?: string; listing?: string }) {
  return value
    .replace(/\{\{renter\}\}/g, input.renter?.trim() || "there")
    .replace(/\{\{listing\}\}/g, input.listing?.trim() || "this listing");
}

export function normalizeReplyTemplateInput(input: Record<string, unknown>) {
  const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const titleZh = text(input.titleZh, 100);
  const titleEn = text(input.titleEn, 100) || titleZh;
  const bodyZh = text(input.bodyZh, 2_000);
  const bodyEn = text(input.bodyEn, 2_000) || bodyZh;
  return { titleZh, titleEn, bodyZh, bodyEn };
}
