CREATE TABLE IF NOT EXISTS rental_saved_listings (
  user_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS rental_listing_drafts (
  user_id TEXT PRIMARY KEY REFERENCES rental_users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_saved_listings_user_idx
  ON rental_saved_listings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_saved_listings_listing_idx
  ON rental_saved_listings(listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_listing_drafts_updated_idx
  ON rental_listing_drafts(updated_at DESC);
