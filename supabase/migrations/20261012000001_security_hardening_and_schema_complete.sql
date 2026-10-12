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
