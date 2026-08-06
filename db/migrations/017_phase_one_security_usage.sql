CREATE TABLE IF NOT EXISTS rental_password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_rate_limits (
  scope_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_api_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  request_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'success',
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  places_calls INTEGER NOT NULL DEFAULT 0,
  route_calls INTEGER NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_password_resets_user_idx
  ON rental_password_resets(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS rental_rate_limits_updated_idx
  ON rental_rate_limits(updated_at DESC);

CREATE INDEX IF NOT EXISTS rental_api_usage_created_idx
  ON rental_api_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS rental_api_usage_provider_idx
  ON rental_api_usage(provider, endpoint, created_at DESC);
