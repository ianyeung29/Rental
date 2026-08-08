CREATE TABLE IF NOT EXISTS rental_location_lookup_settings (
  id TEXT PRIMARY KEY,
  places_calls_per_lookup INTEGER NOT NULL DEFAULT 5,
  route_calls_per_lookup INTEGER NOT NULL DEFAULT 5,
  updated_by TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO rental_location_lookup_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

UPDATE rental_location_lookup_settings
SET route_calls_per_lookup = 5
WHERE id = 'default' AND updated_by IS NULL AND route_calls_per_lookup = 7;
