ALTER TABLE rental_renter_profiles
  ADD COLUMN IF NOT EXISTS share_current_city BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rental_renter_profiles
  ADD COLUMN IF NOT EXISTS share_employment BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rental_renter_profiles
  ADD COLUMN IF NOT EXISTS share_income BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rental_applications
  ADD COLUMN IF NOT EXISTS current_city TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS rental_application_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES rental_applications(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('renter', 'owner')),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'reviewing', 'approved', 'declined', 'withdrawn')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_application_events_application_idx
  ON rental_application_events(application_id, created_at);

CREATE INDEX IF NOT EXISTS rental_application_events_actor_idx
  ON rental_application_events(actor_id, created_at);
