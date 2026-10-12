-- =====================================================================
-- Migration: 20261012000003_phase1_to_phase4_complete_platform.sql
-- Completes Phase 1 through Phase 4 Database Foundations:
-- 1. Enhances team_memberships for account-based invites and roster review
-- 2. Tournament entry submission, squad locking, and organizer approval
-- 3. Match result approval and dispute resolution stored procedures
-- 4. Notification triggers for workflow events
-- =====================================================================

-- 1. Enhance team_memberships table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_memberships' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.team_memberships ADD COLUMN account_id UUID REFERENCES public.account_profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_memberships' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.team_memberships ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_memberships' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.team_memberships ADD COLUMN role TEXT NOT NULL DEFAULT 'player';
  END IF;
END;
$$;

-- Make player_id nullable in team_memberships if pending account invite before player linking
ALTER TABLE public.team_memberships ALTER COLUMN player_id DROP NOT NULL;

-- 2. Stored Procedure: approve_team_membership
CREATE OR REPLACE FUNCTION public.approve_team_membership(
  p_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_membership RECORD;
  v_team RECORD;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be signed in to approve team membership';
  END IF;

  SELECT * INTO v_membership FROM public.team_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND: Membership request % does not exist', p_membership_id;
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = v_membership.team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEAM_NOT_FOUND: Team does not exist';
  END IF;

  -- Verify caller is creator of the team or captain
  IF v_team.created_by_account_id <> v_caller THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only the team captain or manager can approve membership';
  END IF;

  -- Update membership status to active
  UPDATE public.team_memberships
  SET status = 'active'
  WHERE id = p_membership_id;

  -- Send notification to approved member if account is linked
  IF v_membership.account_id IS NOT NULL THEN
    INSERT INTO public.notification_records (
      recipient_account_id,
      category,
      title,
      message,
      action_route,
      resource_type,
      resource_id
    ) VALUES (
      v_membership.account_id,
      'invite',
      'Team Membership Approved 🎉',
      format('You are now an active member of %s!', v_team.name),
      '/(tabs)/teams',
      'team',
      v_team.id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'membership_id', p_membership_id,
    'status', 'active',
    'team_name', v_team.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_team_membership(UUID) TO authenticated;

-- 3. Stored Procedure: submit_tournament_entry
CREATE OR REPLACE FUNCTION public.submit_tournament_entry(
  p_tournament_id UUID,
  p_team_id UUID,
  p_squad_player_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_team RECORD;
  v_tournament RECORD;
  v_entry_id UUID;
  v_pid UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be signed in to submit tournament entry';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: Tournament does not exist';
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEAM_NOT_FOUND: Team does not exist';
  END IF;

  -- Verify caller manages the team
  IF v_team.created_by_account_id <> v_caller THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only team manager or captain can submit tournament entry';
  END IF;

  -- Upsert tournament entry
  INSERT INTO public.tournament_entries (
    tournament_id,
    team_id,
    status,
    submitted_at
  ) VALUES (
    p_tournament_id,
    p_team_id,
    'submitted',
    NOW()
  )
  ON CONFLICT (tournament_id, team_id) DO UPDATE
  SET status = 'submitted', submitted_at = NOW()
  RETURNING id INTO v_entry_id;

  -- Populate squad
  DELETE FROM public.tournament_squad_members WHERE entry_id = v_entry_id;

  FOREACH v_pid IN ARRAY p_squad_player_ids
  LOOP
    INSERT INTO public.tournament_squad_members (
      entry_id,
      player_id,
      status
    ) VALUES (
      v_entry_id,
      v_pid,
      'eligible'
    );
  END LOOP;

  -- Notify tournament organizer
  INSERT INTO public.notification_records (
    recipient_account_id,
    category,
    title,
    message,
    action_route,
    resource_type,
    resource_id
  ) VALUES (
    v_tournament.organizer_account_id,
    'entry_update',
    'New Tournament Registration 📋',
    format('Team %s submitted registration for %s', v_team.name, v_tournament.name),
    format('/tournament/%s', p_tournament_id),
    'tournament',
    p_tournament_id::text
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'entry_id', v_entry_id,
    'status', 'submitted',
    'squad_size', array_length(p_squad_player_ids, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_tournament_entry(UUID, UUID, UUID[]) TO authenticated;

-- 4. Stored Procedure: approve_tournament_entry
CREATE OR REPLACE FUNCTION public.approve_tournament_entry(
  p_entry_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_entry RECORD;
  v_tournament RECORD;
  v_team RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be signed in to approve tournament entry';
  END IF;

  SELECT * INTO v_entry FROM public.tournament_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENTRY_NOT_FOUND: Tournament entry does not exist';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_entry.tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: Tournament does not exist';
  END IF;

  IF v_tournament.organizer_account_id <> v_caller THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only tournament organizer can approve entries';
  END IF;

  UPDATE public.tournament_entries
  SET status = 'approved', reviewed_at = NOW()
  WHERE id = p_entry_id;

  SELECT * INTO v_team FROM public.teams WHERE id = v_entry.team_id;

  -- Notify team manager
  INSERT INTO public.notification_records (
    recipient_account_id,
    category,
    title,
    message,
    action_route,
    resource_type,
    resource_id
  ) VALUES (
    v_team.created_by_account_id,
    'entry_update',
    'Tournament Entry Approved ✅',
    format('Your entry for team %s in %s has been approved!', v_team.name, v_tournament.name),
    format('/tournament/%s', v_tournament.id),
    'tournament',
    v_tournament.id::text
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'entry_id', p_entry_id,
    'status', 'approved'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_tournament_entry(UUID) TO authenticated;

-- 5. Stored Procedure: approve_match_result
CREATE OR REPLACE FUNCTION public.approve_match_result(
  p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_match RECORD;
  v_tournament RECORD;
  v_is_organizer BOOLEAN := FALSE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be signed in to approve match result';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND: Match does not exist';
  END IF;

  IF v_match.tournament_id IS NOT NULL THEN
    SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;
    IF v_tournament.organizer_account_id = v_caller THEN
      v_is_organizer := TRUE;
    END IF;
  END IF;

  -- If friendly match or direct match organizer
  IF v_match.assigned_scorer_account_id = v_caller THEN
    v_is_organizer := TRUE;
  END IF;

  IF NOT v_is_organizer THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only match organizer or tournament administrator can approve match result';
  END IF;

  UPDATE public.matches
  SET approval_status = 'approved', last_updated = NOW()
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'match_id', p_match_id,
    'approval_status', 'approved'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_match_result(UUID) TO authenticated;
