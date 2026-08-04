CREATE TABLE IF NOT EXISTS rental_agent_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES rental_users(id) ON DELETE SET NULL,
  display_name_zh TEXT NOT NULL,
  display_name_en TEXT NOT NULL,
  brokerage TEXT NOT NULL,
  license_state TEXT NOT NULL,
  license_number TEXT NOT NULL,
  service_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  fee_summary_zh TEXT NOT NULL DEFAULT '',
  fee_summary_en TEXT NOT NULL DEFAULT '',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rental_listing_private_details
  ADD COLUMN IF NOT EXISTS agent_profile_id TEXT REFERENCES rental_agent_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rental_agent_profiles_active_idx
  ON rental_agent_profiles(is_active, is_verified, display_name_zh);

CREATE INDEX IF NOT EXISTS rental_listing_private_agent_idx
  ON rental_listing_private_details(agent_profile_id);
