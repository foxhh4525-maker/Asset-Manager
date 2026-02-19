-- Safe restore of clip fields and artworks tables
-- This migration is idempotent and will only create missing columns/tables

-- Add missing clip columns (if they don't exist)
ALTER TABLE clips ADD COLUMN IF NOT EXISTS submitter_name text;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS video_id text;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS start_time integer DEFAULT 0;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS end_time integer DEFAULT 0;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS platform text DEFAULT 'youtube';
ALTER TABLE clips ADD COLUMN IF NOT EXISTS submitter_avatar text;

-- Create artworks table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'artworks') THEN
    CREATE TABLE artworks (
      id serial PRIMARY KEY,
      image_data text NOT NULL,
      artist_name text NOT NULL DEFAULT 'زائر',
      artist_avatar text,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamp NOT NULL DEFAULT now()
    );
  END IF;
END
$$;

-- Create artwork_ratings table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'artwork_ratings') THEN
    CREATE TABLE artwork_ratings (
      id serial PRIMARY KEY,
      artwork_id integer NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
      voter_key text NOT NULL,
      overall integer NOT NULL CHECK (overall BETWEEN 1 AND 5),
      quality integer,
      speed integer,
      communication integer,
      value integer,
      comment text,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (artwork_id, voter_key)
    );
  END IF;
END
$$;
