ALTER TABLE rental_users
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS agent_verification_status TEXT NOT NULL DEFAULT 'unsubmitted';

CREATE INDEX IF NOT EXISTS rental_users_account_type_idx
  ON rental_users(account_type, agent_verification_status);

ALTER TABLE rental_agent_profiles
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_note TEXT NOT NULL DEFAULT '';
