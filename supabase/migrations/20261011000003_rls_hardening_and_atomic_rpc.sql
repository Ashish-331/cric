-- =====================================================================
-- Migration: 20261011000003_rls_hardening_and_atomic_rpc.sql
-- Review Remediation: RLS hardening, admin column protection, phone masking,
-- Realtime publication, and atomic server-side scoring commit function.
-- =====================================================================

-- 1. Protect is_admin column on account_profiles (Prevent self-elevation)
CREATE OR REPLACE FUNCTION public.protect_account_profile_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_admin <> OLD.is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.account_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Only existing administrators can modify the is_admin flag.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_account_profile_admin ON public.account_profiles;
CREATE TRIGGER trg_protect_account_profile_admin
  BEFORE UPDATE ON public.account_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_account_profile_admin();

-- 2. Player Phone Number Protection (Masking view for public access)
CREATE OR REPLACE VIEW public.players_public AS
SELECT
  id,
  canonical_name,
  role,
  batting_hand,
  bowling_style,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.player_account_links
      WHERE player_id = public.players.id AND account_id = auth.uid()
    ) THEN phone_number
    ELSE NULL
  END AS phone_number,
  is_claimed,
  is_guest,
  avatar_url,
  jersey_number,
  city,
  created_at,
  updated_at
FROM public.players;

-- 3. Hardened Matches INSERT Policy (Restricted to Organizers & Team Managers)
DROP POLICY IF EXISTS "Organizers or team managers can create matches" ON public.matches;
CREATE POLICY "Organizers or team managers can create matches"
  ON public.matches FOR INSERT
  TO authenticated
  WITH CHECK (
    (tournament_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = matches.tournament_id AND organizer_account_id = auth.uid()
    )) OR
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE (id = team1_id OR id = team2_id) AND created_by_account_id = auth.uid()
    )
  );

-- 4. Hardened Tournament Entries INSERT Policy (Enforce status = 'submitted')
DROP POLICY IF EXISTS "Team creators can submit tournament entries" ON public.tournament_entries;
CREATE POLICY "Team creators can submit tournament entries"
  ON public.tournament_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'submitted' AND
    applying_account_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = team_id AND created_by_account_id = auth.uid()
    )
  );

-- 5. Revoke direct public/scorer UPDATE on matches scoring state & match_actions ledger
-- Scoring updates must strictly flow through commit_match_action_atomic RPC / Edge Function.
DROP POLICY IF EXISTS "Assigned scorer can append match actions" ON public.match_actions;
DROP POLICY IF EXISTS "Assigned scorer can update match during match play" ON public.matches;

CREATE POLICY "Tournament organizers can update match administrative metadata"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = matches.tournament_id AND organizer_account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = matches.tournament_id AND organizer_account_id = auth.uid()
    )
  );

-- 6. Enable Supabase Realtime on matches table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback for local environments where publication might be configured differently
    NULL;
END;
$$;

-- 7. Atomic Server-Side Match Scoring Commit RPC
CREATE OR REPLACE FUNCTION public.commit_match_action_atomic(
  p_match_id UUID,
  p_action_id TEXT,
  p_expected_revision INT,
  p_authority_epoch INT,
  p_actor_account_id UUID,
  p_action_type TEXT,
  p_action_payload JSONB,
  p_next_state_payload JSONB,
  p_next_revision INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_existing_action RECORD;
  v_is_scorer BOOLEAN := FALSE;
  v_has_epoch_authority BOOLEAN := FALSE;
  v_updated_match RECORD;
BEGIN
  -- 1. Idempotency Check: Was this action already committed?
  SELECT * INTO v_existing_action
  FROM match_actions
  WHERE match_id = p_match_id AND action_id = p_action_id;

  IF FOUND THEN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    RETURN jsonb_build_object(
      'accepted', TRUE,
      'idempotent_replay', TRUE,
      'revision', v_match.revision,
      'match', row_to_json(v_match)
    );
  END IF;

  -- 2. Lock the match row exclusively for update
  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND: Match % does not exist', p_match_id;
  END IF;

  -- 3. Verify Scoring Authority and Authority Epoch
  IF v_match.assigned_scorer_account_id = p_actor_account_id THEN
    v_is_scorer := TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM match_scorer_authority
    WHERE match_id = p_match_id
      AND account_id = p_actor_account_id
      AND authority_epoch = p_authority_epoch
      AND revoked_at IS NULL
  ) INTO v_has_epoch_authority;

  IF NOT (v_is_scorer OR v_has_epoch_authority) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Actor does not hold scoring authority for epoch %', p_authority_epoch;
  END IF;

  -- 4. Optimistic Concurrency / Expected Revision Check
  IF v_match.revision <> p_expected_revision THEN
    RETURN jsonb_build_object(
      'accepted', FALSE,
      'conflict', TRUE,
      'canonical_revision', v_match.revision,
      'error', 'REVISION_CONFLICT',
      'message', format('Expected revision %s but current canonical revision is %s', p_expected_revision, v_match.revision)
    );
  END IF;

  -- 5. Append to Immutable Match Actions Ledger
  INSERT INTO match_actions (
    match_id,
    action_id,
    sequence_number,
    expected_revision,
    actor_account_id,
    action_type,
    payload
  ) VALUES (
    p_match_id,
    p_action_id,
    p_next_revision,
    p_expected_revision,
    p_actor_account_id,
    p_action_type,
    p_action_payload
  );

  -- 6. Atomically Update Match Projection and Advance Revision
  UPDATE matches
  SET
    revision = p_next_revision,
    state_payload = p_next_state_payload,
    last_updated = NOW()
  WHERE id = p_match_id
  RETURNING * INTO v_updated_match;

  RETURN jsonb_build_object(
    'accepted', TRUE,
    'idempotent_replay', FALSE,
    'revision', v_updated_match.revision,
    'action_id', p_action_id,
    'match', row_to_json(v_updated_match)
  );
END;
$$;
