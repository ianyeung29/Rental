ALTER TABLE rental_inquiries
  ADD COLUMN IF NOT EXISTS address_reveal_status TEXT NOT NULL DEFAULT 'hidden';

ALTER TABLE rental_inquiries
  ADD COLUMN IF NOT EXISTS address_revealed_at TIMESTAMPTZ;

ALTER TABLE rental_inquiries
  ADD COLUMN IF NOT EXISTS address_revealed_by TEXT REFERENCES rental_users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS rental_address_reveal_events (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES rental_inquiries(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
  recipient_id TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_address_reveal_events_inquiry_idx
  ON rental_address_reveal_events(inquiry_id, created_at DESC);
