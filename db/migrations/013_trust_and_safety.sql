ALTER TABLE rental_listings
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE rental_listings
  ADD COLUMN IF NOT EXISTS moderation_note TEXT NOT NULL DEFAULT '';

ALTER TABLE rental_listings
  ADD COLUMN IF NOT EXISTS moderation_updated_at TIMESTAMPTZ;

ALTER TABLE rental_listings
  ADD COLUMN IF NOT EXISTS moderation_updated_by TEXT REFERENCES rental_users(id) ON DELETE SET NULL;

ALTER TABLE rental_listing_reports
  ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT '';

ALTER TABLE rental_listing_reports
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES rental_users(id) ON DELETE SET NULL;

ALTER TABLE rental_listing_reports
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS rental_moderation_events (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
  report_id TEXT REFERENCES rental_listing_reports(id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_status TEXT NOT NULL DEFAULT '',
  to_status TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_listing_reports_listing_idx
  ON rental_listing_reports(listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_moderation_events_listing_idx
  ON rental_moderation_events(listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_listings_moderation_idx
  ON rental_listings(moderation_status, updated_at DESC);
