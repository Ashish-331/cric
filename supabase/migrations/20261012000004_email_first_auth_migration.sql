-- =====================================================================
-- Migration: 20261012000004_email_first_auth_migration.sql
-- Implements Email-First / No-SMS Authentication Foundation:
-- 1. Makes phone_number strictly optional in account_profiles (drop NOT NULL)
-- 2. Adds email column to account_profiles
-- 3. Ensures public_account_profiles projection excludes email and phone
-- 4. Ensures player_private_contacts stores optional contact details safely
-- =====================================================================

-- 1. Make phone_number optional and add email to account_profiles
DO $$
BEGIN
  -- Drop NOT NULL constraint on phone_number if present
  ALTER TABLE public.account_profiles ALTER COLUMN phone_number DROP NOT NULL;

  -- Add email column if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.account_profiles ADD COLUMN email TEXT;
  END IF;
END;
$$;

-- Create index on email for quick lookup
CREATE INDEX IF NOT EXISTS idx_account_profiles_email ON public.account_profiles(email);

-- 2. Ensure public projection view excludes all private contact info (email & phone)
CREATE OR REPLACE VIEW public.public_account_profiles AS
  SELECT
    id,
    display_name,
    avatar_url,
    is_admin,
    created_at,
    updated_at
  FROM public.account_profiles;

GRANT SELECT ON public.public_account_profiles TO anon, authenticated;

-- 3. Ensure player_private_contacts has columns for optional contact data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_private_contacts' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.player_private_contacts ADD COLUMN phone_number TEXT;
  END IF;
END;
$$;

-- Ensure RLS on player_private_contacts restricts access solely to linked account owner
DROP POLICY IF EXISTS "Private contacts only accessible by linked account owner" ON public.player_private_contacts;
CREATE POLICY "Private contacts strictly accessible by linked account owner"
  ON public.player_private_contacts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_account_links
      WHERE player_id = public.player_private_contacts.player_id AND account_id = auth.uid()
    )
  );
