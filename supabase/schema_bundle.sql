-- =====================================================================
-- Cric Canonical Shared Platform Schema
-- Stage 2: Identity, Teams, Tournaments, Matches, Actions, Ledger
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE cricket_format AS ENUM ('T20', 'ODI', 'Test', 'Hundred', 'Custom');
CREATE TYPE playing_role AS ENUM ('batter', 'bowler', 'all_rounder', 'wicket_keeper');
CREATE TYPE tournament_status AS ENUM (
  'draft', 'registration_open', 'registration_closed', 'scheduled', 'active', 'completed', 'archived'
);
CREATE TYPE entry_status AS ENUM (
  'draft', 'submitted', 'changes_requested', 'resubmitted', 'approved', 'rejected', 'waitlisted', 'withdrawn', 'disqualified'
);
CREATE TYPE match_sporting_status AS ENUM (
  'scheduled', 'toss', 'live', 'innings_break', 'completed', 'abandoned', 'tied'
);
CREATE TYPE match_approval_status AS ENUM (
  'provisional', 'submitted', 'approved', 'disputed', 'reopened'
);

-- 1. Account Profiles (auth.users identity extension)
CREATE TABLE IF NOT EXISTS public.account_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Permanent Cricket Player Identity
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name TEXT NOT NULL,
  role playing_role NOT NULL DEFAULT 'batter',
  batting_hand TEXT NOT NULL DEFAULT 'right',
  bowling_style TEXT,
  phone_number TEXT,
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  jersey_number INT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Player-Account Links (Strict 1-to-1 canonical ownership)
CREATE TABLE IF NOT EXISTS public.player_account_links (
  account_id UUID NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (account_id, player_id),
  UNIQUE (account_id),
  UNIQUE (player_id)
);

-- 4. Player Claim Requests (Review queue for claimed profiles)
CREATE TABLE IF NOT EXISTS public.player_claim_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  evidence_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by UUID REFERENCES public.account_profiles(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 5. Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#1E40AF',
  logo_url TEXT,
  captain_player_id UUID REFERENCES public.players(id),
  created_by_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Team Memberships
CREATE TABLE IF NOT EXISTS public.team_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  is_wicketkeeper BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE (team_id, player_id)
);

-- 7. Tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  format cricket_format NOT NULL DEFAULT 'T20',
  total_overs INT NOT NULL DEFAULT 20,
  ball_type TEXT NOT NULL DEFAULT 'leather',
  status tournament_status NOT NULL DEFAULT 'draft',
  max_teams INT NOT NULL DEFAULT 8,
  organizer_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  registration_deadline TIMESTAMPTZ,
  rules_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Tournament Entries & Squads
CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  applying_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  status entry_status NOT NULL DEFAULT 'submitted',
  review_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (tournament_id, team_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_squad_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES public.tournament_entries(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  is_wicketkeeper BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'eligible', -- eligible, replacement, suspended
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, player_id)
);

-- 9. Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  team1_id UUID NOT NULL REFERENCES public.teams(id),
  team2_id UUID NOT NULL REFERENCES public.teams(id),
  title TEXT NOT NULL,
  format cricket_format NOT NULL DEFAULT 'T20',
  sporting_status match_sporting_status NOT NULL DEFAULT 'scheduled',
  approval_status match_approval_status NOT NULL DEFAULT 'provisional',
  revision INT NOT NULL DEFAULT 0,
  authority_epoch INT NOT NULL DEFAULT 1,
  assigned_scorer_account_id UUID REFERENCES public.account_profiles(id),
  state_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_different_teams CHECK (team1_id <> team2_id)
);

-- 10. Scorer Authority Epochs (Handover & concurrency protection)
CREATE TABLE IF NOT EXISTS public.match_scorer_authority (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  authority_epoch INT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (match_id, authority_epoch)
);

-- 11. Append-Only Match Action Ledger
CREATE TABLE IF NOT EXISTS public.match_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  action_id TEXT NOT NULL,
  sequence_number INT NOT NULL,
  expected_revision INT NOT NULL,
  actor_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, action_id),
  UNIQUE (match_id, sequence_number)
);

-- 12. Player Match Contributions & Aggregates
CREATE TABLE IF NOT EXISTS public.player_match_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  revision INT NOT NULL,
  runs INT NOT NULL DEFAULT 0,
  balls_faced INT NOT NULL DEFAULT 0,
  fours INT NOT NULL DEFAULT 0,
  sixes INT NOT NULL DEFAULT 0,
  is_out BOOLEAN NOT NULL DEFAULT FALSE,
  wickets INT NOT NULL DEFAULT 0,
  legal_balls_bowled INT NOT NULL DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  maidens INT NOT NULL DEFAULT 0,
  catches INT NOT NULL DEFAULT 0,
  stumpings INT NOT NULL DEFAULT 0,
  run_outs INT NOT NULL DEFAULT 0,
  is_provisional BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, player_id, revision)
);

CREATE TABLE IF NOT EXISTS public.career_stat_totals (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  matches_count INT NOT NULL DEFAULT 0,
  innings_count INT NOT NULL DEFAULT 0,
  runs INT NOT NULL DEFAULT 0,
  balls_faced INT NOT NULL DEFAULT 0,
  fours INT NOT NULL DEFAULT 0,
  sixes INT NOT NULL DEFAULT 0,
  highest_score INT NOT NULL DEFAULT 0,
  wickets INT NOT NULL DEFAULT 0,
  overs_balls INT NOT NULL DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  maidens INT NOT NULL DEFAULT 0,
  catches INT NOT NULL DEFAULT 0,
  stumpings INT NOT NULL DEFAULT 0,
  run_outs INT NOT NULL DEFAULT 0,
  last_rebuilt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for critical query paths
CREATE INDEX IF NOT EXISTS idx_matches_tourney ON public.matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_scorer ON public.matches(assigned_scorer_account_id);
CREATE INDEX IF NOT EXISTS idx_match_actions_lookup ON public.match_actions(match_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_contributions_player ON public.player_match_contributions(player_id, match_id);
CREATE INDEX IF NOT EXISTS idx_entries_lookup ON public.tournament_entries(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_players_phone_lookup ON public.players(phone_number);
-- =====================================================================
-- Cric Row-Level Security (RLS) Policies & Access Control
-- =====================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.account_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_claim_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scorer_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_stat_totals ENABLE ROW LEVEL SECURITY;

-- 2. Account Profiles Policies
CREATE POLICY "Public profiles are readable by authenticated users"
  ON public.account_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.account_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.account_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. Players Policies
CREATE POLICY "Player profiles are publicly readable"
  ON public.players FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create unclaimed player profiles"
  ON public.players FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Linked player owner can update own profile"
  ON public.players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_account_links
      WHERE player_id = public.players.id AND account_id = auth.uid()
    )
  );

-- 4. Player Account Links
CREATE POLICY "Account links are readable by everyone"
  ON public.player_account_links FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can link only their own account"
  ON public.player_account_links FOR INSERT
  TO authenticated
  WITH CHECK (account_id = auth.uid());

-- 5. Teams & Memberships
CREATE POLICY "Teams are publicly readable"
  ON public.teams FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (created_by_account_id = auth.uid());

CREATE POLICY "Team creator can update team"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (created_by_account_id = auth.uid());

CREATE POLICY "Memberships are publicly readable"
  ON public.team_memberships FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Team managers can manage memberships"
  ON public.team_memberships FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = public.team_memberships.team_id AND created_by_account_id = auth.uid()
    )
  );

-- 6. Tournaments & Governance
CREATE POLICY "Tournaments are publicly readable"
  ON public.tournaments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Organizers can create tournaments"
  ON public.tournaments FOR INSERT
  TO authenticated
  WITH CHECK (organizer_account_id = auth.uid());

CREATE POLICY "Organizer can update their tournament"
  ON public.tournaments FOR UPDATE
  TO authenticated
  USING (organizer_account_id = auth.uid());

CREATE POLICY "Tournament entries are publicly readable"
  ON public.tournament_entries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Team creators can submit tournament entries"
  ON public.tournament_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    applying_account_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = team_id AND created_by_account_id = auth.uid()
    )
  );

CREATE POLICY "Organizer can review entries"
  ON public.tournament_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = tournament_id AND organizer_account_id = auth.uid()
    )
  );

CREATE POLICY "Squad members are publicly readable"
  ON public.tournament_squad_members FOR SELECT
  TO anon, authenticated
  USING (true);

-- 7. Matches, Scoring & Authorisation
CREATE POLICY "Matches are publicly readable"
  ON public.matches FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Organizers or team managers can create matches"
  ON public.matches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Assigned scorer can update match during match play"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (
    assigned_scorer_account_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = matches.tournament_id AND organizer_account_id = auth.uid()
    )
  );

CREATE POLICY "Match actions are publicly readable"
  ON public.match_actions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Assigned scorer can append match actions"
  ON public.match_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_account_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_actions.match_id AND (
        assigned_scorer_account_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.match_scorer_authority
          WHERE match_id = match_actions.match_id
            AND account_id = auth.uid()
            AND revoked_at IS NULL
        )
      )
    )
  );

CREATE POLICY "Contributions are publicly readable"
  ON public.player_match_contributions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Career totals are publicly readable"
  ON public.career_stat_totals FOR SELECT
  TO anon, authenticated
  USING (true);
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
-- =====================================================================
-- Migration: 20261012000001_security_hardening_and_schema_complete.sql
-- Hardens SECURITY DEFINER atomic RPC against caller spoofing,
-- revokes public execution, and introduces Associations, Clubs,
-- Invitation Codes, Live Broadcasts, Awards, and Transactional Notifications.
-- =====================================================================

-- 1. Hardened Server-Side Scoring Atomic Commit RPC
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
  -- Strict Caller Authorization:
  -- If caller is authenticated user (not service_role execution),
  -- p_actor_account_id MUST strictly match session auth.uid().
  IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL THEN
    IF p_actor_account_id <> auth.uid() THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Actor account ID (%) does not match authenticated session (%)', p_actor_account_id, auth.uid();
    END IF;
  END IF;

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
    RAISE EXCEPTION 'UNAUTHORIZED: Actor does not hold scoring authority for match % in epoch %', p_match_id, p_authority_epoch;
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

-- Restrict execution on commit_match_action_atomic
REVOKE EXECUTE ON FUNCTION public.commit_match_action_atomic(UUID, TEXT, INT, INT, UUID, TEXT, JSONB, JSONB, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.commit_match_action_atomic(UUID, TEXT, INT, INT, UUID, TEXT, JSONB, JSONB, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.commit_match_action_atomic(UUID, TEXT, INT, INT, UUID, TEXT, JSONB, JSONB, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_match_action_atomic(UUID, TEXT, INT, INT, UUID, TEXT, JSONB, JSONB, INT) TO authenticated;

-- 2. Associations (Cricket Governing Bodies)
CREATE TABLE IF NOT EXISTS public.associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  created_by_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  logo_url TEXT,
  rules_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Clubs (Member Clubs under Associations)
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  city TEXT,
  created_by_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional linkage on teams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'club_id'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'association_id'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- 4. Invitation Codes (Scoped Join/Invite Tokens with Expiry & Rate Limits)
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  resource_type TEXT NOT NULL, -- 'team' | 'tournament' | 'match' | 'club' | 'association'
  resource_id UUID NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'player', -- 'player' | 'scorer' | 'manager'
  created_by_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  max_uses INT NOT NULL DEFAULT 1,
  uses_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Live Broadcast Sessions (Truthful score-only baseline & gated video state)
CREATE TABLE IF NOT EXISTS public.live_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  broadcast_mode TEXT NOT NULL DEFAULT 'score_only', -- 'score_only' | 'video'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'stopped'
  provider TEXT NOT NULL DEFAULT 'none',
  provider_reference TEXT,
  audience_visibility TEXT NOT NULL DEFAULT 'public',
  created_by_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ
);

-- 6. Award Records (Auditable Manual and Formula Honours)
CREATE TABLE IF NOT EXISTS public.award_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  award_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'player_of_match' | 'player_of_tournament' | 'milestone' | 'mvp' | 'best_batter' | 'best_bowler' | 'manual'
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  formula_version TEXT,
  formula_breakdown JSONB,
  issuer_account_id UUID REFERENCES public.account_profiles(id),
  reason TEXT,
  is_provisional BOOLEAN NOT NULL DEFAULT FALSE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Transactional Notifications & Inbox Notices
CREATE TABLE IF NOT EXISTS public.notification_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_account_id UUID NOT NULL REFERENCES public.account_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'invite' | 'scorer_assignment' | 'entry_update' | 'fixture_update' | 'result_approval' | 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_route TEXT,
  resource_type TEXT,
  resource_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Player Private Contacts (Separated from public profiles)
CREATE TABLE IF NOT EXISTS public.player_private_contacts (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  email TEXT,
  emergency_contact TEXT,
  address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Match Disputes & Reopening Audits
CREATE TABLE IF NOT EXISTS public.match_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  disputing_account_id UUID NOT NULL REFERENCES public.account_profiles(id),
  reason TEXT NOT NULL,
  evidence_payload JSONB,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'investigating' | 'resolved' | 'dismissed'
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.account_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS on all new tables
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.award_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_private_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_disputes ENABLE ROW LEVEL SECURITY;

-- Associations & Clubs policies
CREATE POLICY "Associations are publicly readable"
  ON public.associations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can create associations"
  ON public.associations FOR INSERT TO authenticated WITH CHECK (created_by_account_id = auth.uid());
CREATE POLICY "Association creators can update"
  ON public.associations FOR UPDATE TO authenticated USING (created_by_account_id = auth.uid());

CREATE POLICY "Clubs are publicly readable"
  ON public.clubs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can create clubs"
  ON public.clubs FOR INSERT TO authenticated WITH CHECK (created_by_account_id = auth.uid());
CREATE POLICY "Club creators can update"
  ON public.clubs FOR UPDATE TO authenticated USING (created_by_account_id = auth.uid());

-- Invitation codes policies
CREATE POLICY "Invitation codes readable by creator"
  ON public.invitation_codes FOR SELECT TO authenticated
  USING (created_by_account_id = auth.uid() OR revoked_at IS NULL);
CREATE POLICY "Users can create invitation codes"
  ON public.invitation_codes FOR INSERT TO authenticated
  WITH CHECK (created_by_account_id = auth.uid());

-- Live broadcasts policies
CREATE POLICY "Broadcasts are publicly readable"
  ON public.live_broadcasts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Scorers or managers can create broadcasts"
  ON public.live_broadcasts FOR INSERT TO authenticated WITH CHECK (created_by_account_id = auth.uid());
CREATE POLICY "Broadcast creators can update"
  ON public.live_broadcasts FOR UPDATE TO authenticated USING (created_by_account_id = auth.uid());

-- Award records policies
CREATE POLICY "Awards are publicly readable"
  ON public.award_records FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Organizers can create awards"
  ON public.award_records FOR INSERT TO authenticated WITH CHECK (issuer_account_id = auth.uid());

-- Notification records policies
CREATE POLICY "Users can only read own notifications"
  ON public.notification_records FOR SELECT TO authenticated
  USING (recipient_account_id = auth.uid());
CREATE POLICY "Users can update own notification read status"
  ON public.notification_records FOR UPDATE TO authenticated
  USING (recipient_account_id = auth.uid())
  WITH CHECK (recipient_account_id = auth.uid());

-- Player private contacts policies
CREATE POLICY "Private contacts only accessible by linked account owner"
  ON public.player_private_contacts FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_account_links
      WHERE player_id = public.player_private_contacts.player_id AND account_id = auth.uid()
    )
  );

-- Match disputes policies
CREATE POLICY "Match disputes readable by participants and organizers"
  ON public.match_disputes FOR SELECT TO authenticated
  USING (
    disputing_account_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.matches m
      LEFT JOIN public.tournaments t ON t.id = m.tournament_id
      WHERE m.id = match_disputes.match_id AND (t.organizer_account_id = auth.uid() OR m.assigned_scorer_account_id = auth.uid())
    )
  );
CREATE POLICY "Users can file match disputes"
  ON public.match_disputes FOR INSERT TO authenticated
  WITH CHECK (disputing_account_id = auth.uid());
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
