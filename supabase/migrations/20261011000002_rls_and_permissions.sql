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
