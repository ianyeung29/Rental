ALTER TABLE rental_listing_media
  ADD COLUMN IF NOT EXISTS thumbnail_object_key TEXT;

ALTER TABLE rental_listing_media
  ADD COLUMN IF NOT EXISTS thumbnail_public_url TEXT;

ALTER TABLE rental_listing_media
  ADD COLUMN IF NOT EXISTS thumbnail_content_type TEXT;

ALTER TABLE rental_listing_media
  ADD COLUMN IF NOT EXISTS width INTEGER;

ALTER TABLE rental_listing_media
  ADD COLUMN IF NOT EXISTS height INTEGER;
