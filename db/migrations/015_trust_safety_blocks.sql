-- Reversible publisher controls for renters who do not want to see a user's listings.
CREATE TABLE IF NOT EXISTS rental_user_blocks (
  blocker_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_user_id),
  CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS rental_user_blocks_blocker_idx
  ON rental_user_blocks(blocker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_user_blocks_blocked_idx
  ON rental_user_blocks(blocked_user_id, created_at DESC);
