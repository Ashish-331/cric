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
