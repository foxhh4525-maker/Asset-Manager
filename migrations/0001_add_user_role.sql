-- Ensure 'user' role exists in user_role enum
-- Safe operation: only adds if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'user'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'user' BEFORE 'streamer';
  END IF;
END
$$;
