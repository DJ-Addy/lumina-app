-- Migration 005: extend astrology_profiles with full natal chart data
-- Adds birth latitude/longitude (for Ascendant calc) and a JSON cache of the
-- computed natal chart so we don't have to recompute on every read.

ALTER TABLE public.astrology_profiles
  ADD COLUMN IF NOT EXISTS birth_latitude   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS birth_longitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS natal_chart      JSONB;

-- Optional sanity bounds
ALTER TABLE public.astrology_profiles
  DROP CONSTRAINT IF EXISTS astrology_lat_range;
ALTER TABLE public.astrology_profiles
  ADD CONSTRAINT astrology_lat_range
    CHECK (birth_latitude IS NULL OR (birth_latitude BETWEEN -90 AND 90));

ALTER TABLE public.astrology_profiles
  DROP CONSTRAINT IF EXISTS astrology_lon_range;
ALTER TABLE public.astrology_profiles
  ADD CONSTRAINT astrology_lon_range
    CHECK (birth_longitude IS NULL OR (birth_longitude BETWEEN -180 AND 180));
