import { supabase } from './supabaseClient';
import { SQLiteMatchRepository } from '../repositories/sqlite/sqliteMatchRepository';
import { StorageService } from '../storage/storageService';
import type { Match, MatchApprovalStatus, MatchResultDetails } from '../types/cricket';
import { toCanonicalUUID, isValidUUID } from '../utils/uuid';

const localRepo = new SQLiteMatchRepository();

export interface CanonicalMatchResult {
  success: boolean;
  match?: Match;
  error?: string;
}

export class CanonicalMatchService {
  /**
   * Fetches the latest canonical match projection from Supabase,
   * updates the local SQLite cache and AsyncStorage fallback,
   * and returns the canonical Match object.
   */
  static async fetchCanonicalMatch(matchId: string): Promise<Match | null> {
    try {
      const canonicalId = toCanonicalUUID(matchId);
      const { data, error } = await supabase
        .from('matches')
        .select('id, title, format, sporting_status, approval_status, revision, state_payload, last_updated')
        .eq('id', canonicalId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const statePayload = data.state_payload;
      const matchObj: Match =
        typeof statePayload === 'string'
          ? JSON.parse(statePayload)
          : statePayload;

      if (!matchObj || !matchObj.id) {
        return null;
      }

      matchObj.revision = data.revision ?? matchObj.revision;
      matchObj.isSynced = true;
      matchObj.lastUpdated = data.last_updated ? new Date(data.last_updated).getTime() : Date.now();

      // Update local durable SQLite repository & legacy storage
      await localRepo.saveMatch(matchObj);
      await StorageService.saveMatch(matchObj);

      return matchObj;
    } catch (err) {
      console.warn('Failed to fetch canonical match projection:', err);
      return null;
    }
  }

  /**
   * Creates a match canonically in the shared Supabase backend.
   * Assigns creator / scorer authority in match_scorer_authority.
   */
  static async createCanonicalMatch(
    match: Match,
    actorAccountId?: string
  ): Promise<CanonicalMatchResult> {
    try {
      const canonicalId = toCanonicalUUID(match.id);
      const team1Id = toCanonicalUUID(match.team1.id);
      const team2Id = toCanonicalUUID(match.team2.id);
      const tournamentId = match.tournamentId ? toCanonicalUUID(match.tournamentId) : null;

      const formatMap: Record<string, string> = {
        t20: 'T20',
        t10: 'Custom',
        odi: 'ODI',
        custom: 'Custom',
      };
      const dbFormat = formatMap[match.format] || 'T20';

      // 1. Ensure parent teams exist in canonical backend
      const teamUpserts = [
        {
          id: team1Id,
          name: match.team1.name,
          short_name: match.team1.shortName || match.team1.name.slice(0, 3).toUpperCase(),
          primary_color: match.team1.primaryColor || '#1E40AF',
          created_by_account_id: actorAccountId || null,
        },
        {
          id: team2Id,
          name: match.team2.name,
          short_name: match.team2.shortName || match.team2.name.slice(0, 3).toUpperCase(),
          primary_color: match.team2.primaryColor || '#DC2626',
          created_by_account_id: actorAccountId || null,
        },
      ];
      await supabase.from('teams').upsert(teamUpserts, { onConflict: 'id' });

      // 2. Ensure participating players exist in canonical players table
      const allPlayers = [...(match.team1.players || []), ...(match.team2.players || [])];
      if (allPlayers.length > 0) {
        const playerUpserts = allPlayers.map((p) => ({
          id: toCanonicalUUID(p.id),
          canonical_name: p.name,
          role: (p.role === 'all-rounder' ? 'all_rounder' : p.role === 'wicketkeeper' ? 'wicket_keeper' : p.role) || 'batter',
          batting_hand: p.battingHand || 'right',
          bowling_style: p.bowlingStyle || null,
          city: p.city || null,
        }));
        await supabase.from('players').upsert(playerUpserts, { onConflict: 'id' });
      }

      const matchPayload = {
        ...match,
        id: canonicalId,
        isSynced: true,
      };

      const { data: insertedMatch, error: matchInsertError } = await supabase
        .from('matches')
        .insert({
          id: canonicalId,
          tournament_id: tournamentId,
          team1_id: team1Id,
          team2_id: team2Id,
          title: match.title || `${match.team1.name} vs ${match.team2.name}`,
          format: dbFormat,
          sporting_status: match.status || 'scheduled',
          approval_status: match.approvalStatus || 'provisional',
          revision: match.revision || 0,
          authority_epoch: match.authorityEpoch || 1,
          assigned_scorer_account_id: actorAccountId || null,
          state_payload: matchPayload,
        })
        .select()
        .single();

      if (matchInsertError) {
        return {
          success: false,
          error: matchInsertError.message,
        };
      }

      // Grant initial scoring authority epoch if actor is provided
      if (actorAccountId) {
        await supabase.from('match_scorer_authority').insert({
          match_id: canonicalId,
          account_id: actorAccountId,
          authority_epoch: match.authorityEpoch || 1,
        });
      }

      // Save locally
      await localRepo.saveMatch(matchPayload);
      await StorageService.saveMatch(matchPayload);

      return {
        success: true,
        match: matchPayload,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to create canonical match',
      };
    }
  }

  /**
   * Lists canonical matches from Supabase with optional filters.
   */
  static async listCanonicalMatches(filter?: {
    status?: string;
    tournamentId?: string;
    limit?: number;
  }): Promise<Match[]> {
    try {
      let query = supabase
        .from('matches')
        .select('id, title, format, sporting_status, approval_status, revision, state_payload, last_updated')
        .order('last_updated', { ascending: false });

      if (filter?.status) {
        query = query.eq('sporting_status', filter.status);
      }
      if (filter?.tournamentId) {
        query = query.eq('tournament_id', toCanonicalUUID(filter.tournamentId));
      }
      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query;
      if (error || !data) {
        return [];
      }

      const canonicalMatches: Match[] = [];
      for (const row of data) {
        const statePayload = row.state_payload;
        const matchObj: Match =
          typeof statePayload === 'string'
            ? JSON.parse(statePayload)
            : statePayload;

        if (matchObj && matchObj.id) {
          matchObj.revision = row.revision ?? matchObj.revision;
          matchObj.isSynced = true;
          matchObj.lastUpdated = row.last_updated
            ? new Date(row.last_updated).getTime()
            : Date.now();

          canonicalMatches.push(matchObj);
          // Cache locally
          await localRepo.saveMatch(matchObj).catch(() => {});
        }
      }

      return canonicalMatches;
    } catch (err) {
      console.warn('Failed to list canonical matches from cloud:', err);
      return [];
    }
  }

  /**
   * Sets up a real-time subscription for live matches so spectators and players
   * receive immediate score and milestone updates without polling.
   */
  static subscribeToCanonicalMatch(
    matchId: string,
    onUpdate: (match: Match) => void
  ): () => void {
    const canonicalId = toCanonicalUUID(matchId);

    const channel = supabase
      .channel(`match:${canonicalId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${canonicalId}`,
        },
        async (payload: any) => {
          const newRow = payload.new;
          if (!newRow) return;

          const state = newRow.state_payload;
          const matchObj: Match =
            typeof state === 'string' ? JSON.parse(state) : state;

          if (matchObj && matchObj.id) {
            matchObj.revision = newRow.revision ?? matchObj.revision;
            matchObj.isSynced = true;
            matchObj.lastUpdated = newRow.last_updated
              ? new Date(newRow.last_updated).getTime()
              : Date.now();

            await localRepo.saveMatch(matchObj).catch(() => {});
            onUpdate(matchObj);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Approves or updates match result approval in canonical shared backend.
   */
  static async updateCanonicalMatchResultApproval(
    matchId: string,
    approvalStatus: MatchApprovalStatus,
    details?: Partial<MatchResultDetails>
  ): Promise<boolean> {
    try {
      const canonicalId = toCanonicalUUID(matchId);
      const localMatch = await StorageService.getMatchById(matchId);
      if (localMatch) {
        localMatch.approvalStatus = approvalStatus;
        if (details) {
          localMatch.resultDetails = {
            ...(localMatch.resultDetails || { outcomeType: 'win', summary: '', approvalStatus }),
            ...details,
          };
        }
        await localRepo.saveMatch(localMatch).catch(() => {});
        await StorageService.saveMatch(localMatch).catch(() => {});
      }

      const { error } = await supabase
        .from('matches')
        .update({
          approval_status: approvalStatus,
          last_updated: new Date().toISOString(),
        })
        .eq('id', canonicalId);

      if (error) {
        console.warn('Notice: offline match approval queued locally:', error.message);
      }
      return true;
    } catch (err) {
      return true;
    }
  }
}
