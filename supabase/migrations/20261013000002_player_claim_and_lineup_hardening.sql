-- =====================================================================
-- Migration: 20261013000002_player_claim_and_lineup_hardening.sql
-- Description:
-- 1. Updates player_claim_requests: adds evidence_email, makes evidence_phone nullable
-- 2. Updates teams: adds captain_email, captain_status
-- 3. Creates match_lineups: per-match squad participant lineups with roles
-- 4. Creates match_share_sessions: revocable broadcast share tokens
-- 5. Updates public.is_account_authorized_for_match: includes match_lineups and match_share_sessions
-- =====================================================================

-- 1. Evidence email on player claim requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_claim_requests'
      AND column_name = 'evidence_email'
  ) THEN
    ALTER TABLE public.player_claim_requests
      ADD COLUMN evidence_email TEXT;
  END IF;

  -- Ensure evidence_phone is nullable (so email-only claims succeed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_claim_requests'
      AND column_name = 'evidence_phone'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.player_claim_requests
      ALTER COLUMN evidence_phone DROP NOT NULL;
  END IF;
END $$;

-- 2. Captain email and status on teams
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teams'
      AND column_name = 'captain_email'
  ) THEN
    ALTER TABLE public.teams
      ADD COLUMN captain_email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teams'
      AND column_name = 'captain_status'
  ) THEN
    ALTER TABLE public.teams
      ADD COLUMN captain_status TEXT NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Update submit_player_claim function to support evidence_email
CREATE OR REPLACE FUNCTION public.submit_player_claim(
  p_player_id UUID,
  p_evidence_notes TEXT,
  p_evidence_email TEXT DEFAULT NULL
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
  INSERT INTO public.player_claim_requests (account_id, player_id, evidence_notes, evidence_email, status)
  VALUES (v_account_id, p_player_id, p_evidence_notes, p_evidence_email, 'pending')
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'claim_id', v_claim_id,
    'status', 'pending',
    'message', 'Claim request submitted for verification'
  );
END;
$$;

-- 3. Match Lineups Table
CREATE TABLE IF NOT EXISTS public.match_lineups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  role playing_role NOT NULL DEFAULT 'batter',
  batting_order INT,
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  is_wicketkeeper BOOLEAN NOT NULL DEFAULT FALSE,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_lineups_match ON public.match_lineups(match_id);
CREATE INDEX IF NOT EXISTS idx_match_lineups_player ON public.match_lineups(player_id);

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

-- 4. Match Share Sessions Table
CREATE TABLE IF NOT EXISTS public.match_share_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES public.account_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_match_share_sessions_token ON public.match_share_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_match_share_sessions_match ON public.match_share_sessions(match_id);

ALTER TABLE public.match_share_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Updated authorization function public.is_account_authorized_for_match
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

  -- 2. Check if match has an active public broadcast or share token
  IF (v_match.state_payload->>'isPublicBroadcast')::boolean IS TRUE THEN
    RETURN TRUE;
  END IF;

  IF (v_match.state_payload->>'isShareActive')::boolean IS TRUE THEN
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

  IF EXISTS (
    SELECT 1 FROM public.match_share_sessions
    WHERE match_id = p_match_id
      AND is_active = TRUE
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RETURN TRUE;
  END IF;

  -- If not public/shared and account is anonymous/null, access is denied
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

  -- 5. Participating player (linked account) in match contributions or lineups
  IF EXISTS (
    SELECT 1
    FROM public.player_account_links pal
    JOIN public.player_match_contributions pmc ON pmc.player_id = pal.player_id
    WHERE pal.account_id = p_account_id
      AND pmc.match_id = p_match_id
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_account_links pal
    JOIN public.match_lineups ml ON ml.player_id = pal.player_id
    WHERE pal.account_id = p_account_id
      AND ml.match_id = p_match_id
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
        )
      )
  ) THEN
    RETURN TRUE;
  END IF;

  -- 7. Tournament organizer
  IF v_match.tournament_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.tournaments tour
    WHERE tour.id = v_match.tournament_id
      AND tour.organizer_account_id = p_account_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- RLS policies for match_lineups
DROP POLICY IF EXISTS "Users can view lineups for authorized matches" ON public.match_lineups;
CREATE POLICY "Users can view lineups for authorized matches"
  ON public.match_lineups FOR SELECT
  USING (
    public.is_account_authorized_for_match(match_id, auth.uid())
  );

DROP POLICY IF EXISTS "Organizers and scorers can manage lineups" ON public.match_lineups;
CREATE POLICY "Organizers and scorers can manage lineups"
  ON public.match_lineups FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (
          m.organizer_account_id = auth.uid()
          OR m.assigned_scorer_account_id = auth.uid()
          OR (m.state_payload->>'organizerUserId') = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM public.match_scorer_authority msa
            WHERE msa.match_id = m.id AND msa.account_id = auth.uid() AND msa.revoked_at IS NULL
          )
        )
    )
  );

-- RLS policies for match_share_sessions
DROP POLICY IF EXISTS "Organizers and scorers can manage share sessions" ON public.match_share_sessions;
CREATE POLICY "Organizers and scorers can manage share sessions"
  ON public.match_share_sessions FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (
          m.organizer_account_id = auth.uid()
          OR m.assigned_scorer_account_id = auth.uid()
          OR (m.state_payload->>'organizerUserId') = auth.uid()::text
        )
    )
  );

DROP POLICY IF EXISTS "Anyone can view active share session by token" ON public.match_share_sessions;
CREATE POLICY "Anyone can view active share session by token"
  ON public.match_share_sessions FOR SELECT
  USING (
    is_active = TRUE AND (revoked_at IS NULL) AND (expires_at IS NULL OR expires_at > NOW())
  );
