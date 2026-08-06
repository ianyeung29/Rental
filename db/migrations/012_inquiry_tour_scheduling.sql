ALTER TABLE rental_inquiries
  ADD COLUMN IF NOT EXISTS tour_scheduled_at TIMESTAMPTZ;

ALTER TABLE rental_inquiries
  ADD COLUMN IF NOT EXISTS tour_timezone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE rental_inquiries
  ADD COLUMN IF NOT EXISTS tour_note TEXT NOT NULL DEFAULT '';
