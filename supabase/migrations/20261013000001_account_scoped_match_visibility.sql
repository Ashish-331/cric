-- =====================================================================
-- Migration: 20261013000001_account_scoped_match_visibility.sql
-- Description:
-- 1. Adds organizer_account_id to public.matches
-- 2. Defines non-recursive SECURITY DEFINER function public.is_account_authorized_for_match
-- 3. Replaces global USING (true) SELECT policies on matches, match_actions, and player_match_contributions
--    with relationship-based security checks.
-- =====================================================================

-- 1. Add organizer_account_id column to matches if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'matches'
      AND column_name = 'organizer_account_id'
  ) THEN
    ALTER TABLE public.matches
      ADD COLUMN organizer_account_id UUID REFERENCES public.account_profiles(id);
  END IF;
END $$;

-- Backfill organizer_account_id from assigned_scorer_account_id or state_payload
UPDATE public.matches
SET organizer_account_id = COALESCE(
  organizer_account_id,
  CASE
    WHEN (state_payload->>'organizerUserId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN (state_payload->>'organizerUserId')::uuid
    ELSE NULL
  END,
  assigned_scorer_account_id
)
WHERE organizer_account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_matches_organizer ON public.matches(organizer_account_id);

-- 2. Non-recursive SECURITY DEFINER authorization function
CREATE OR REPLACE FUNCTION public.is_account_authorized_for_match(
  p_match_id UUID,
  p_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
BEGIN
  -- 1. Retrieve match record
  SELECT
    id,
    tournament_id,
    team1_id,
    team2_id,
    assigned_scorer_account_id,
    organizer_account_id,
    state_payload
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 2. Check if match is public broadcast
  IF (v_match.state_payload->>'isPublicBroadcast')::boolean IS TRUE THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.live_broadcasts
    WHERE match_id = p_match_id
      AND status = 'active'
      AND audience_visibility = 'public'
  ) THEN
    RETURN TRUE;
  END IF;

  -- If not public broadcast and account is anonymous/null, access is denied
  IF p_account_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. Match organizer / creator
  IF v_match.organizer_account_id = p_account_id THEN
    RETURN TRUE;
  END IF;

  IF (v_match.state_payload->>'organizerUserId') = p_account_id::text THEN
    RETURN TRUE;
  END IF;

  -- 4. Assigned or active scorer
  IF v_match.assigned_scorer_account_id = p_account_id THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_scorer_authority
    WHERE match_id = p_match_id
      AND account_id = p_account_id
      AND revoked_at IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  -- 5. Participating player (linked account) in match contributions
  IF EXISTS (
    SELECT 1
    FROM public.player_account_links pal
    JOIN public.player_match_contributions pmc ON pmc.player_id = pal.player_id
    WHERE pal.account_id = p_account_id
      AND pmc.match_id = p_match_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- 6. Team manager, creator, captain, or registered squad member
  IF EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE (t.id = v_match.team1_id OR t.id = v_match.team2_id)
      AND (
        t.manager_account_id = p_account_id
        OR t.created_by_account_id = p_account_id
        OR EXISTS (
          SELECT 1 FROM public.player_account_links pal
          WHERE pal.player_id = t.captain_player_id
            AND pal.account_id = p_account_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.team_memberships tm
          JOIN public.player_account_links pal ON pal.player_id = tm.player_id
          WHERE tm.team_id = t.id
            AND pal.account_id = p_account_id
            AND tm.status = 'approved'
        )
      )
  ) THEN
    RETURN TRUE;
  END IF;

  -- 7. Tournament organizer or approved tournament squad member
  IF v_match.tournament_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = v_match.tournament_id
        AND organizer_account_id = p_account_id
    ) THEN
      RETURN TRUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.tournament_entries te
      JOIN public.tournament_squad_members tsm ON tsm.entry_id = te.id
      JOIN public.player_account_links pal ON pal.player_id = tsm.player_id
      WHERE te.tournament_id = v_match.tournament_id
        AND te.status = 'approved'
        AND pal.account_id = p_account_id
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- 3. Replace global SELECT policies with relationship-scoped policies

-- A. matches table
DROP POLICY IF EXISTS "Matches are publicly readable" ON public.matches;
DROP POLICY IF EXISTS "Authorized accounts can select matches" ON public.matches;

CREATE POLICY "Authorized accounts can select matches"
  ON public.matches FOR SELECT
  TO anon, authenticated
  USING (public.is_account_authorized_for_match(id, auth.uid()));

-- B. match_actions table
DROP POLICY IF EXISTS "Match actions are publicly readable" ON public.match_actions;
DROP POLICY IF EXISTS "Authorized accounts can select match actions" ON public.match_actions;

CREATE POLICY "Authorized accounts can select match actions"
  ON public.match_actions FOR SELECT
  TO anon, authenticated
  USING (public.is_account_authorized_for_match(match_id, auth.uid()));

-- C. player_match_contributions table
DROP POLICY IF EXISTS "Contributions are publicly readable" ON public.player_match_contributions;
DROP POLICY IF EXISTS "Authorized accounts can select player contributions" ON public.player_match_contributions;

CREATE POLICY "Authorized accounts can select player contributions"
  ON public.player_match_contributions FOR SELECT
  TO anon, authenticated
  USING (public.is_account_authorized_for_match(match_id, auth.uid()));
