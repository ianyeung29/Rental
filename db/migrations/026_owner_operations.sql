ALTER TABLE rental_listings
  ADD COLUMN IF NOT EXISTS availability_confirmed_at TIMESTAMPTZ;

ALTER TABLE rental_listings
  ADD COLUMN IF NOT EXISTS availability_reminder_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS rental_reply_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_zh TEXT NOT NULL,
  body_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_reply_templates_user_idx
  ON rental_reply_templates(user_id, updated_at DESC);
