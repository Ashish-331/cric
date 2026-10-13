class MockSQLiteDatabase {
  constructor() {
    this.tables = new Map();
    this.transactionSnapshot = null;
  }

  cloneTables() {
    const clone = new Map();
    for (const [table, map] of this.tables.entries()) {
      const mapClone = new Map();
      for (const [k, v] of map.entries()) {
        mapClone.set(k, { ...v });
      }
      clone.set(table, mapClone);
    }
    return clone;
  }

  async withTransactionAsync(fn) {
    const snapshot = this.cloneTables();
    try {
      const res = await fn();
      return res;
    } catch (err) {
      this.tables = snapshot;
      throw err;
    }
  }

  async execAsync(sql) {
    if (sql.includes('BEGIN')) {
      this.transactionSnapshot = this.cloneTables();
    } else if (sql.includes('COMMIT')) {
      this.transactionSnapshot = null;
    } else if (sql.includes('ROLLBACK')) {
      if (this.transactionSnapshot) {
        this.tables = this.transactionSnapshot;
        this.transactionSnapshot = null;
      }
    }
    return Promise.resolve();
  }

  async runAsync(sql, params = []) {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    if (cleanSql.includes('INSERT OR REPLACE INTO local_matches')) {
      const [id, title, status, tourneyId, rev, epoch, json, updated, isDemo] = params;
      // SQLite INSERT OR REPLACE deletes the existing row first, triggering ON DELETE CASCADE
      const actions = this.tables.get('local_actions');
      if (actions) {
        for (const [actId, act] of actions.entries()) {
          if (act.match_id === id) actions.delete(actId);
        }
      }
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
    } else if (cleanSql.includes('INSERT INTO local_matches')) {
      const [id, title, status, tourneyId, rev, epoch, json, updated, isDemo, accountOwnerId] = params;
      // ON CONFLICT DO UPDATE does NOT delete the parent row, preserving local_actions
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
        account_owner_id: accountOwnerId || null,
      });
    } else if (cleanSql.includes('UPDATE local_matches SET revision = ?')) {
      const [nextRev, json, updated, id, expectedRev] = params;
      const match = this.tables.get('local_matches')?.get(id);
      if (match) {
        if (expectedRev !== undefined && match.revision !== expectedRev) {
          return { changes: 0, lastInsertRowId: 0 };
        }
        match.revision = nextRev;
        match.json_data = json;
        match.last_updated = updated;
      }
    } else if (cleanSql.includes('INSERT INTO local_actions')) {
      const [id, matchId, type, seq, expRev, payload, created] = params;
      if (!this.tables.has('local_actions')) this.tables.set('local_actions', new Map());
      this.tables.get('local_actions').set(id, {
        id,
        match_id: matchId,
        action_type: type,
        sequence_number: seq,
        expected_revision: expRev,
        payload,
        created_at: created,
      });
    } else if (cleanSql.includes('INSERT INTO sync_outbox')) {
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
    } else if (cleanSql.includes("UPDATE sync_outbox SET status = 'synced'")) {
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
    } else if (cleanSql.includes('UPDATE sync_outbox SET status = ?')) {
      const [status, error, eventId] = params;
      const outbox = this.tables.get('sync_outbox') || new Map();
      if (outbox.has(eventId)) {
        const entry = outbox.get(eventId);
        entry.status = status;
        entry.retry_count = (entry.retry_count || 0) + 1;
        entry.last_error = error;
      }
    } else if (cleanSql.includes('DELETE FROM local_matches')) {
      const id = params[0];
      this.tables.get('local_matches')?.delete(id);
    } else if (cleanSql.includes('DELETE FROM sync_outbox')) {
      const matchId = params[0];
      const outbox = this.tables.get('sync_outbox');
      if (outbox) {
        for (const [id, entry] of outbox.entries()) {
          if (entry.match_id === matchId) outbox.delete(id);
        }
      }
    }
    return { changes: 1, lastInsertRowId: 1 };
  }

  async getFirstAsync(sql, params = []) {
    if (sql.includes('FROM local_matches WHERE id = ?')) {
      const id = params[0];
      return this.tables.get('local_matches')?.get(id) || null;
    }
    if (sql.includes('SELECT count(*) as count FROM local_matches')) {
      const count = this.tables.get('local_matches')?.size || 0;
      return { count };
    }
    if (sql.includes('FROM migration_meta')) {
      return null;
    }
    return null;
  }

  async getAllAsync(sql, params = []) {
    if (sql.includes('FROM local_matches')) {
      let matches = Array.from(this.tables.get('local_matches')?.values() || []);
      if (sql.includes('account_owner_id = ?')) {
        const ownerParam = params[0];
        matches = matches.filter((m) => m.account_owner_id === ownerParam);
      }
      if (sql.includes('is_demo = 0')) {
        matches = matches.filter((m) => m.is_demo === 0);
      }
      return matches;
    }
    if (sql.includes('FROM local_actions')) {
      const actions = Array.from(this.tables.get('local_actions')?.values() || []);
      if (sql.includes('WHERE match_id = ?')) {
        const matchId = params[0];
        return actions.filter((a) => a.match_id === matchId);
      }
      return actions;
    }
    if (sql.includes('FROM sync_outbox')) {
      const outbox = Array.from(this.tables.get('sync_outbox')?.values() || []);
      if (sql.includes('status = ?') || sql.includes("status = 'pending'")) {
        return outbox.filter(
          (e) => e.status === 'pending' || (e.status === 'failed' && (e.retry_count || 0) < 10)
        );
      }
      return outbox;
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
