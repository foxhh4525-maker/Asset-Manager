-- Initialize schema to match shared/schema.ts
-- Safe idempotent operations: add enum values and create tables only if missing.

-- Ensure user_role enum exists with the required values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('viewer','user','streamer','moderator');
  ELSE
    -- Add missing labels safely
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'user'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'user' BEFORE 'streamer';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'moderator'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'moderator';
    END IF;
  END IF;
END
$$;

-- Ensure clip_status enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'clip_status') THEN
    CREATE TYPE clip_status AS ENUM ('pending','approved','rejected','watched');
  END IF;
END
$$;

-- Create users table if missing
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  discord_id text NOT NULL UNIQUE,
  username text NOT NULL,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at timestamp NOT NULL DEFAULT now()
);

-- Create clips table if missing
CREATE TABLE IF NOT EXISTS clips (
  id serial PRIMARY KEY,
  url text NOT NULL,
  title text NOT NULL,
  thumbnail_url text NOT NULL,
  channel_name text NOT NULL,
  duration text NOT NULL,
  tag text NOT NULL,
  submitted_by integer NOT NULL REFERENCES users(id),
  status clip_status NOT NULL DEFAULT 'pending',
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Create votes table if missing
CREATE TABLE IF NOT EXISTS votes (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  clip_id integer NOT NULL REFERENCES clips(id),
  value integer NOT NULL,
  CONSTRAINT votes_user_clip_unique UNIQUE (user_id, clip_id)
);
