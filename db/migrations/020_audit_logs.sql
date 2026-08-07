CREATE TABLE IF NOT EXISTS rental_audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success',
  user_id TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL DEFAULT '',
  is_authenticated BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address_encrypted TEXT NOT NULL DEFAULT '',
  ip_address_hash TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  operating_system TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT '',
  route TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_audit_logs_created_idx
  ON rental_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS rental_audit_logs_event_idx
  ON rental_audit_logs(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_audit_logs_user_idx
  ON rental_audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_audit_logs_ip_hash_idx
  ON rental_audit_logs(ip_address_hash, created_at DESC);
