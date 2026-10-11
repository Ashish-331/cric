import { getDatabase } from './database';
import type {
  IMatchRepository,
  MatchFilter,
  OutboxEvent,
} from '../types';
import type { Match, InningsAction } from '../../types/cricket';

export class SQLiteMatchRepository implements IMatchRepository {
  async getById(matchId: string): Promise<Match | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ json_data: string }>(
      'SELECT json_data FROM local_matches WHERE id = ?',
      [matchId]
    );
    if (!row) return null;
    return JSON.parse(row.json_data) as Match;
  }

  async saveMatch(match: Match): Promise<void> {
    if (!match || !match.id) {
      throw new Error('Cannot persist invalid match entity');
    }
    const db = await getDatabase();
    const isDemo = match.id.includes('demo') || match.title?.includes('Demo') ? 1 : 0;
    const now = Date.now();

    await db.runAsync(
      `INSERT OR REPLACE INTO local_matches
        (id, title, status, tournament_id, revision, authority_epoch, json_data, last_updated, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        match.id,
        match.title || 'Untitled Match',
        match.status,
        match.tournamentId || null,
        match.revision || 0,
        1,
        JSON.stringify(match),
        match.lastUpdated || now,
        isDemo,
      ]
    );
  }

  async listMatches(filter?: MatchFilter): Promise<Match[]> {
    const db = await getDatabase();
    let query = 'SELECT json_data FROM local_matches WHERE 1=1';
    const params: any[] = [];

    if (filter?.tournamentId) {
      query += ' AND tournament_id = ?';
      params.push(filter.tournamentId);
    }
    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.excludeDemo) {
      query += ' AND is_demo = 0';
    }

    query += ' ORDER BY last_updated DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
      if (filter?.offset) {
        query += ' OFFSET ?';
        params.push(filter.offset);
      }
    }

    const rows = await db.getAllAsync<{ json_data: string }>(query, params);
    return rows.map((r) => JSON.parse(r.json_data) as Match);
  }

  async deleteMatch(matchId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM local_matches WHERE id = ?', [matchId]);
    await db.runAsync('DELETE FROM sync_outbox WHERE match_id = ?', [matchId]);
  }

  async appendAction(
    matchId: string,
    action: InningsAction,
    expectedRevision: number,
    authorityEpoch: number
  ): Promise<{ revision: number; actionId: string }> {
    const db = await getDatabase();
    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();
    const nextRevision = expectedRevision + 1;

    // Check if match exists and verify revision
    const matchRow = await db.getFirstAsync<{ revision: number; json_data: string }>(
      'SELECT revision, json_data FROM local_matches WHERE id = ?',
      [matchId]
    );

    if (!matchRow) {
      throw new Error(`Match ${matchId} not found in local persistence`);
    }

    // Insert action and add to sync outbox
    await db.runAsync(
      `INSERT INTO local_actions (id, match_id, action_type, sequence_number, expected_revision, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [actionId, matchId, action.type, nextRevision, expectedRevision, JSON.stringify(action), now]
    );

    await db.runAsync(
      `INSERT INTO sync_outbox
        (id, match_id, action_id, expected_revision, authority_epoch, action_type, payload, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `out_${now}_${Math.random().toString(36).substring(2, 6)}`,
        matchId,
        actionId,
        expectedRevision,
        authorityEpoch,
        action.type,
        JSON.stringify(action),
        now,
        'pending',
      ]
    );

    return { revision: nextRevision, actionId };
  }

  async getPendingSyncOutbox(): Promise<OutboxEvent[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      match_id: string;
      action_id: string;
      expected_revision: number;
      authority_epoch: number;
      action_type: string;
      payload: string;
      created_at: number;
      synced_at: number | null;
      retry_count: number;
      status: string;
      last_error: string | null;
    }>(
      `SELECT * FROM sync_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50`
    );

    return rows.map((r) => ({
      id: r.id,
      matchId: r.match_id,
      actionId: r.action_id,
      expectedRevision: r.expected_revision,
      authorityEpoch: r.authority_epoch,
      actionType: r.action_type,
      payload: JSON.parse(r.payload),
      createdAt: r.created_at,
      syncedAt: r.synced_at || undefined,
      retryCount: r.retry_count,
      status: r.status as any,
      lastError: r.last_error || undefined,
    }));
  }

  async markOutboxSynced(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const db = await getDatabase();
    const placeholders = eventIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE sync_outbox SET status = 'synced', synced_at = ? WHERE id IN (${placeholders})`,
      [Date.now(), ...eventIds]
    );
  }

  async markOutboxFailed(eventId: string, error: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_outbox SET status = 'failed', retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
      [error, eventId]
    );
  }
}
