ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS expires_on DATE;
ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS rental_listings_public_lifecycle_idx
  ON rental_listings(status, expires_on, created_at DESC);
