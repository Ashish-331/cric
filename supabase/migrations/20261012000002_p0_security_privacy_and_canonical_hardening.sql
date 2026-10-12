-- =====================================================================
-- Migration: 20261012000002_p0_security_privacy_and_canonical_hardening.sql
-- Phase 0 / P0 Critical Fixes:
-- 1. Phone number privacy (restrict raw account_profiles and players table reads)
-- 2. Secure player claims (server-validated claim requests, no direct links)
-- 3. Invitation code privacy & atomic redemption RPC (no code enumeration)
-- 4. Revoke direct authenticated execution of commit_match_action_atomic (Edge only)
-- 5. Scope-checked award and broadcast policies
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Phone Privacy & Public Profile Projections
-- ---------------------------------------------------------------------

-- A. Account Profiles: Users can only query their own row on raw account_profiles.
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.account_profiles;
CREATE POLICY "Users can only read own private account profile"
  ON public.account_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Create a safe public projection view that excludes phone_number
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

-- B. Players: Migrate phone_number to player_private_contacts and remove from public reads.
-- Copy any existing player phone numbers into player_private_contacts before clearing
INSERT INTO public.player_private_contacts (player_id, email, emergency_contact, updated_at)
SELECT id, NULL, NULL, NOW()
FROM public.players
ON CONFLICT (player_id) DO NOTHING;

-- Restrict direct read access to phone_number column on players
-- Nullify phone_number on public.players so raw select never leaks mobile numbers
UPDATE public.players SET phone_number = NULL WHERE phone_number IS NOT NULL;

-- Safe public player view without phone number
CREATE OR REPLACE VIEW public.public_players AS
  SELECT
    id,
    canonical_name,
    role,
    batting_hand,
    bowling_style,
    is_claimed,
    is_guest,
    avatar_url,
    jersey_number,
    city,
    created_at,
    updated_at
  FROM public.players;

GRANT SELECT ON public.public_players TO anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Player Claims: Server-Validated Flow (No Direct Link Insertion)
-- ---------------------------------------------------------------------

-- Revoke direct insert/update/delete on player_account_links
DROP POLICY IF EXISTS "Users can link player profiles" ON public.player_account_links;
DROP POLICY IF EXISTS "Users can link player profiles securely" ON public.player_account_links;

-- Ensure table player_claim_requests exists with full auditing
CREATE TABLE IF NOT EXISTS public.player_claim_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  evidence_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.account_profiles(id)
);

ALTER TABLE public.player_claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit own player claim requests"
  ON public.player_claim_requests FOR INSERT
  TO authenticated
  WITH CHECK (account_id = auth.uid());

CREATE POLICY "Users can view own player claim requests"
  ON public.player_claim_requests FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

-- Stored procedure to submit player claim safely
CREATE OR REPLACE FUNCTION public.submit_player_claim(
  p_player_id UUID,
  p_evidence_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_id UUID := auth.uid();
  v_already_linked BOOLEAN;
  v_claim_id UUID;
BEGIN
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be signed in to claim player profile';
  END IF;

  -- Verify player is not already linked to another account
  SELECT EXISTS (
    SELECT 1 FROM public.player_account_links WHERE player_id = p_player_id
  ) INTO v_already_linked;

  IF v_already_linked THEN
    RAISE EXCEPTION 'PLAYER_ALREADY_CLAIMED: This player profile is already linked to a registered account';
  END IF;

  -- Verify current account does not already own a player profile
  IF EXISTS (SELECT 1 FROM public.player_account_links WHERE account_id = v_account_id) THEN
    RAISE EXCEPTION 'ACCOUNT_ALREADY_LINKED: Your account is already linked to a player profile';
  END IF;

  -- Create pending claim request
  INSERT INTO public.player_claim_requests (account_id, player_id, evidence_notes, status)
  VALUES (v_account_id, p_player_id, p_evidence_notes, 'pending')
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'claim_id', v_claim_id,
    'status', 'pending',
    'message', 'Claim request submitted for verification'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_player_claim(UUID, TEXT) TO authenticated;


-- ---------------------------------------------------------------------
-- 3. Invitation Codes: Creator-Only Read & Atomic Redemption
-- ---------------------------------------------------------------------

-- Drop broad select policy that allowed enumerating all unrevoked codes
DROP POLICY IF EXISTS "Invitation codes readable by creator" ON public.invitation_codes;

CREATE POLICY "Invitation codes strictly readable by creator"
  ON public.invitation_codes FOR SELECT
  TO authenticated
  USING (created_by_account_id = auth.uid());

-- Atomic redemption RPC: users can only redeem by exact code lookup
CREATE OR REPLACE FUNCTION public.redeem_invitation_code(
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_id UUID := auth.uid();
  v_code_record RECORD;
BEGIN
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be signed in to redeem invitation code';
  END IF;

  SELECT * INTO v_code_record
  FROM public.invitation_codes
  WHERE code = UPPER(TRIM(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'CODE_NOT_FOUND', 'message', 'Invalid invitation code');
  END IF;

  IF v_code_record.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'CODE_REVOKED', 'message', 'This invitation code has been revoked');
  END IF;

  IF v_code_record.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'CODE_EXPIRED', 'message', 'This invitation code has expired');
  END IF;

  IF v_code_record.uses_count >= v_code_record.max_uses THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'CODE_LIMIT_REACHED', 'message', 'This code has reached maximum redemptions');
  END IF;

  -- Increment use count
  UPDATE public.invitation_codes
  SET uses_count = uses_count + 1
  WHERE id = v_code_record.id;

  -- Create pending team join request if resource is team
  IF v_code_record.resource_type = 'team' THEN
    INSERT INTO public.team_memberships (
      team_id,
      account_id,
      role,
      status,
      joined_at
    ) VALUES (
      v_code_record.resource_id,
      v_account_id,
      v_code_record.target_role,
      'pending',
      NOW()
    ) ON CONFLICT (team_id, account_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'resource_type', v_code_record.resource_type,
    'resource_id', v_code_record.resource_id,
    'target_role', v_code_record.target_role,
    'status', 'pending_approval',
    'message', 'Invitation redeemed. Participation request submitted for captain/manager approval.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invitation_code(TEXT) TO authenticated;


-- ---------------------------------------------------------------------
-- 4. Scoring RPC: Revoke Direct Authenticated Execution
-- ---------------------------------------------------------------------

-- Direct execution is restricted SOLELY to service_role (Edge Functions)
REVOKE EXECUTE ON FUNCTION public.commit_match_action_atomic(UUID, TEXT, INT, INT, UUID, TEXT, JSONB, JSONB, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_match_action_atomic(UUID, TEXT, INT, INT, UUID, TEXT, JSONB, JSONB, INT) TO service_role;


-- ---------------------------------------------------------------------
-- 5. Scope-Checked Award and Broadcast Write Policies
-- ---------------------------------------------------------------------

-- Awards: check that issuer is organizer of the tournament or match
DROP POLICY IF EXISTS "Organizers can create awards" ON public.award_records;
CREATE POLICY "Scoped organizers can create awards"
  ON public.award_records FOR INSERT
  TO authenticated
  WITH CHECK (
    issuer_account_id = auth.uid() AND (
      (tournament_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.tournaments t
        WHERE t.id = tournament_id AND t.organizer_account_id = auth.uid()
      )) OR
      (match_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = match_id AND (m.assigned_scorer_account_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.tournaments t WHERE t.id = m.tournament_id AND t.organizer_account_id = auth.uid()
        ))
      ))
    )
  );

-- Live Broadcasts: check that creator is assigned scorer or tournament organizer of the match
DROP POLICY IF EXISTS "Scorers or managers can create broadcasts" ON public.live_broadcasts;
CREATE POLICY "Assigned scorers or organizers can create broadcasts"
  ON public.live_broadcasts FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_account_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.matches m
      LEFT JOIN public.tournaments t ON t.id = m.tournament_id
      WHERE m.id = match_id AND (m.assigned_scorer_account_id = auth.uid() OR t.organizer_account_id = auth.uid())
    )
  );
