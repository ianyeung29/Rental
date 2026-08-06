-- Private renter profile and reusable listing applications.
-- This phase intentionally does not collect identity, credit, or income documents.

CREATE TABLE IF NOT EXISTS rental_renter_profiles (
  user_id TEXT PRIMARY KEY REFERENCES rental_users(id) ON DELETE CASCADE,
  preferred_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  current_city TEXT NOT NULL DEFAULT '',
  employment_status TEXT NOT NULL DEFAULT '',
  income_range TEXT NOT NULL DEFAULT '',
  household_size TEXT NOT NULL DEFAULT '1',
  pets TEXT NOT NULL DEFAULT 'no',
  move_in TEXT NOT NULL DEFAULT '',
  lease_length TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_applications (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
  inquiry_id TEXT REFERENCES rental_inquiries(id) ON DELETE SET NULL,
  preferred_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  move_in TEXT NOT NULL,
  lease_length TEXT NOT NULL,
  occupants TEXT NOT NULL,
  pets TEXT NOT NULL,
  employment_status TEXT NOT NULL DEFAULT '',
  income_range TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  owner_note TEXT NOT NULL DEFAULT '',
  requester_note TEXT NOT NULL DEFAULT '',
  owner_read_at TIMESTAMPTZ,
  requester_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, requester_id)
);

CREATE INDEX IF NOT EXISTS rental_renter_profiles_updated_idx ON rental_renter_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS rental_applications_requester_idx ON rental_applications(requester_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS rental_applications_listing_idx ON rental_applications(listing_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS rental_applications_status_idx ON rental_applications(status, updated_at DESC);

ALTER TABLE rental_inquiries ADD COLUMN IF NOT EXISTS tour_reminder_sent_at TIMESTAMPTZ;
