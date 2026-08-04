CREATE TABLE IF NOT EXISTS rental_agent_requests (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL UNIQUE REFERENCES rental_listings(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
  agent_profile_id TEXT REFERENCES rental_agent_profiles(id) ON DELETE SET NULL,
  fee_plan TEXT NOT NULL,
  fee_amount NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'pending',
  owner_note TEXT NOT NULL DEFAULT '',
  agent_note TEXT NOT NULL DEFAULT '',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_agent_requests_owner_idx
  ON rental_agent_requests(owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS rental_agent_requests_agent_idx
  ON rental_agent_requests(agent_profile_id, status, updated_at DESC);
