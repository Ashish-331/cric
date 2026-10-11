import { supabase } from './supabaseClient';
import { SQLiteMatchRepository } from '../repositories/sqlite/sqliteMatchRepository';
import { StorageService } from '../storage/storageService';
import type { Match } from '../types/cricket';

const localRepo = new SQLiteMatchRepository();

export class CanonicalMatchService {
  /**
   * Fetches the latest canonical match projection from Supabase,
   * updates the local SQLite cache and AsyncStorage fallback,
   * and returns the canonical Match object.
   */
  static async fetchCanonicalMatch(matchId: string): Promise<Match | null> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id, title, format, sporting_status, approval_status, revision, state_payload, last_updated')
        .eq('id', matchId)
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
}
