import { supabase } from './supabaseClient';
import { StorageService } from '../storage/storageService';
import type { Tournament, TournamentEntry, Match, Team, Player, MatchFormat } from '../types/cricket';
import { toCanonicalUUID, isValidUUID } from '../utils/uuid';
import { TournamentEngine, type TournamentStanding } from '../engine/tournamentEngine';

export interface CanonicalTournamentResult {
  success: boolean;
  tournament?: Tournament;
  error?: string;
}

export class CanonicalTournamentService {
  /**
   * Creates a tournament canonically in Supabase.
   */
  static async createCanonicalTournament(
    tournament: Tournament,
    organizerAccountId?: string
  ): Promise<CanonicalTournamentResult> {
    try {
      const canonicalId = toCanonicalUUID(tournament.id);

      const formatMap: Record<string, string> = {
        t20: 'T20',
        t10: 'Custom',
        odi: 'ODI',
        custom: 'Custom',
      };
      const dbFormat = formatMap[tournament.format] || 'T20';

      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          id: canonicalId,
          name: tournament.name,
          format: dbFormat,
          total_overs: tournament.totalOvers,
          ball_type: tournament.ballType,
          status: tournament.status === 'upcoming' ? 'scheduled' : tournament.status,
          max_teams: tournament.maxTeams || 8,
          organizer_account_id: organizerAccountId || null,
          rules_payload: {
            totalOvers: tournament.totalOvers,
            ballType: tournament.ballType,
          },
        })
        .select()
        .single();

      if (error) {
        console.warn('Notice: offline/canonical tournament creation fallback:', error.message);
      }

      const canonicalTournament: Tournament = {
        ...tournament,
        id: canonicalId,
      };

      await StorageService.saveTournament(canonicalTournament);

      return {
        success: true,
        tournament: canonicalTournament,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to create canonical tournament',
      };
    }
  }

  /**
   * Lists tournaments from canonical backend and merges with local storage.
   */
  static async listCanonicalTournaments(): Promise<Tournament[]> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        return StorageService.getTournaments();
      }

      const formatReverse: Record<string, MatchFormat> = {
        T20: 't20',
        ODI: 'odi',
        Custom: 'custom',
      };

      const mapped: Tournament[] = data.map((t) => ({
        id: t.id,
        name: t.name,
        format: formatReverse[t.format] || 't20',
        totalOvers: t.total_overs,
        ballType: t.ball_type,
        creatorUserId: t.organizer_account_id || '',
        creatorName: 'Tournament Organizer',
        teams: [],
        matches: [],
        status: t.status === 'scheduled' ? 'upcoming' : t.status,
        createdAt: new Date(t.created_at).getTime(),
      }));

      // Merge with local storage
      const local = await StorageService.getTournaments();
      const map = new Map<string, Tournament>();
      mapped.forEach((t) => map.set(t.id, t));
      local.forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, t);
      });

      return Array.from(map.values());
    } catch (err) {
      console.warn('Notice: listing tournaments from local cache:', err);
      return StorageService.getTournaments();
    }
  }

  /**
   * Submits a team entry with roster squad to a tournament.
   */
  static async submitTournamentEntry(
    tournamentId: string,
    teamId: string,
    squadPlayerIds: string[]
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const canonicalTournId = toCanonicalUUID(tournamentId);
      const canonicalTeamId = toCanonicalUUID(teamId);
      const canonicalSquad = squadPlayerIds.map((p) => toCanonicalUUID(p));

      const { data, error } = await supabase.rpc('submit_tournament_entry', {
        p_tournament_id: canonicalTournId,
        p_team_id: canonicalTeamId,
        p_squad_player_ids: canonicalSquad,
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: data?.success ?? true,
        message: 'Tournament entry submitted for organizer review.',
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Approves a tournament entry by organizer.
   */
  static async approveTournamentEntry(entryId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('approve_tournament_entry', {
        p_entry_id: entryId,
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Tournament entry approved.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Computes official standings and NRR from accepted tournament matches.
   */
  static calculateStandings(matches: Match[], teams: Team[]): TournamentStanding[] {
    return TournamentEngine.calculateStandings(teams, matches);
  }
}
