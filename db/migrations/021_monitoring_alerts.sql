CREATE TABLE IF NOT EXISTS rental_error_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error',
  route TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  error_name TEXT NOT NULL DEFAULT '',
  stack TEXT NOT NULL DEFAULT '',
  request_id TEXT NOT NULL DEFAULT '',
  user_id TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_usage_alert_settings (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  openai_monthly_cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 10.00,
  google_places_monthly_calls INTEGER NOT NULL DEFAULT 4000,
  google_routes_monthly_calls INTEGER NOT NULL DEFAULT 8000,
  blocked_requests_threshold INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO rental_usage_alert_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS rental_usage_alert_events (
  id TEXT PRIMARY KEY,
  alert_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  metric TEXT NOT NULL,
  value NUMERIC(16, 4) NOT NULL DEFAULT 0,
  threshold NUMERIC(16, 4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'recorded',
  message TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alert_key, period_key)
);

CREATE INDEX IF NOT EXISTS rental_error_events_created_idx
  ON rental_error_events(created_at DESC);

CREATE INDEX IF NOT EXISTS rental_error_events_source_idx
  ON rental_error_events(source, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_usage_alert_events_period_idx
  ON rental_usage_alert_events(period_key, created_at DESC);
