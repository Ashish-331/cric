class MockSQLiteDatabase {
  constructor() {
    this.tables = new Map();
  }

  async execAsync(sql) {
    return Promise.resolve();
  }

  async runAsync(sql, params = []) {
    if (sql.includes('INSERT OR REPLACE INTO local_matches') || sql.includes('INSERT INTO local_matches')) {
      const [id, title, status, tourneyId, rev, epoch, json, updated, isDemo] = params;
      if (!this.tables.has('local_matches')) this.tables.set('local_matches', new Map());
      this.tables.get('local_matches').set(id, {
        id,
        title,
        status,
        tournament_id: tourneyId,
        revision: rev,
        authority_epoch: epoch,
        json_data: json,
        last_updated: updated,
        is_demo: isDemo,
      });
    } else if (sql.includes('INSERT INTO local_actions')) {
      const [id, matchId, type, seq, expRev, payload, created] = params;
      if (!this.tables.has('local_actions')) this.tables.set('local_actions', new Map());
      this.tables.get('local_actions').set(id, {
        id,
        match_id: matchId,
        action_type: type,
        sequence_number: seq,
        payload,
        created_at: created,
      });
    } else if (sql.includes('INSERT INTO sync_outbox')) {
      const [id, matchId, actionId, expRev, epoch, type, payload, created, status] = params;
      if (!this.tables.has('sync_outbox')) this.tables.set('sync_outbox', new Map());
      this.tables.get('sync_outbox').set(id, {
        id,
        match_id: matchId,
        action_id: actionId,
        expected_revision: expRev,
        authority_epoch: epoch,
        action_type: type,
        payload,
        created_at: created,
        status,
        retry_count: 0,
        last_error: null,
        synced_at: null,
      });
    } else if (sql.includes("UPDATE sync_outbox SET status = 'synced'")) {
      const syncedAt = params[0];
      const ids = params.slice(1);
      const outbox = this.tables.get('sync_outbox') || new Map();
      for (const id of ids) {
        if (outbox.has(id)) {
          const entry = outbox.get(id);
          entry.status = 'synced';
          entry.synced_at = syncedAt;
        }
      }
    } else if (sql.includes('DELETE FROM local_matches')) {
      const id = params[0];
      this.tables.get('local_matches')?.delete(id);
    }
    return { changes: 1, lastInsertRowId: 1 };
  }

  async getFirstAsync(sql, params = []) {
    if (sql.includes('FROM local_matches WHERE id = ?')) {
      const id = params[0];
      return this.tables.get('local_matches')?.get(id) || null;
    }
    if (sql.includes('FROM migration_meta')) {
      return null;
    }
    return null;
  }

  async getAllAsync(sql, params = []) {
    if (sql.includes('FROM local_matches')) {
      const matches = Array.from(this.tables.get('local_matches')?.values() || []);
      if (sql.includes('is_demo = 0')) {
        return matches.filter((m) => m.is_demo === 0);
      }
      return matches;
    }
    if (sql.includes("FROM sync_outbox WHERE status = 'pending'")) {
      const outbox = Array.from(this.tables.get('sync_outbox')?.values() || []);
      return outbox.filter((e) => e.status === 'pending');
    }
    return [];
  }
}

let mockDb = new MockSQLiteDatabase();

export async function openDatabaseAsync() {
  return mockDb;
}

export function resetMockDatabase() {
  mockDb = new MockSQLiteDatabase();
}

export default {
  openDatabaseAsync,
  resetMockDatabase,
};
