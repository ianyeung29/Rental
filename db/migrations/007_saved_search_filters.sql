ALTER TABLE rental_saved_searches
  ADD COLUMN IF NOT EXISTS min_price NUMERIC(12, 2);

ALTER TABLE rental_saved_searches
  ADD COLUMN IF NOT EXISTS bedrooms TEXT NOT NULL DEFAULT '';

ALTER TABLE rental_saved_searches
  ADD COLUMN IF NOT EXISTS bathrooms TEXT NOT NULL DEFAULT '';
