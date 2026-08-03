CREATE TABLE IF NOT EXISTS rental_saved_searches (
  user_id TEXT PRIMARY KEY REFERENCES rental_users(id) ON DELETE CASCADE,
  location TEXT NOT NULL DEFAULT '',
  max_price NUMERIC(12, 2),
  rental_type TEXT NOT NULL DEFAULT 'all',
  move_in TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_mode TEXT NOT NULL DEFAULT 'fit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
