CREATE TABLE IF NOT EXISTS rental_notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES rental_users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  saved_search_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  inquiry_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  listing_expiration_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  agent_response_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_listing_expiration_alerts (
  listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
  expires_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (listing_id, expires_on)
);

CREATE INDEX IF NOT EXISTS rental_notification_preferences_updated_idx
  ON rental_notification_preferences(updated_at DESC);

CREATE INDEX IF NOT EXISTS rental_listing_expiration_alerts_user_idx
  ON rental_listing_expiration_alerts(user_id, expires_on);
