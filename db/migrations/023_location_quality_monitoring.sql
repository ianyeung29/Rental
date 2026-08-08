ALTER TABLE rental_usage_alert_settings
  ADD COLUMN IF NOT EXISTS google_places_quality_issues_threshold INTEGER NOT NULL DEFAULT 3;

ALTER TABLE rental_usage_alert_settings
  ADD COLUMN IF NOT EXISTS google_routes_quality_issues_threshold INTEGER NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS rental_location_quality_events (
  id TEXT PRIMARY KEY,
  lookup_kind TEXT NOT NULL DEFAULT 'location-context',
  places_calls INTEGER NOT NULL DEFAULT 0,
  route_calls INTEGER NOT NULL DEFAULT 0,
  places_quality_issues INTEGER NOT NULL DEFAULT 0,
  routes_quality_issues INTEGER NOT NULL DEFAULT 0,
  rejection_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_location_quality_events_created_idx
  ON rental_location_quality_events(created_at DESC);
