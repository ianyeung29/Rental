ALTER TABLE rental_listings
  ADD COLUMN IF NOT EXISTS square_feet INTEGER;

ALTER TABLE rental_saved_searches
  ADD COLUMN IF NOT EXISTS min_sqft INTEGER;

ALTER TABLE rental_saved_searches
  ADD COLUMN IF NOT EXISTS max_sqft INTEGER;
