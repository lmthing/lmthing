-- Zitadel user IDs are numeric snowflake strings, not UUIDs.
-- Change sso_codes.user_id from uuid to text to match profiles.id.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sso_codes'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.sso_codes
      ALTER COLUMN user_id TYPE text USING user_id::text;
  END IF;
END $$;
