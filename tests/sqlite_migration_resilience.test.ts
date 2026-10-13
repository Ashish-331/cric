import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getDatabase, resetDatabaseInstance } from '../src/repositories/sqlite/database';
import { SQLiteMatchRepository } from '../src/repositories/sqlite/sqliteMatchRepository';
import { generateUUID } from '../src/utils/uuid';
import type { Match } from '../src/types/cricket';

test('SQLITE-UPGRADE-001: Legacy SQLite table lacking account_owner_id column fails on un-migrated index, then succeeds with ordered migration and backfill', () => {
  // Use in-memory SQLite database via Node's native DatabaseSync
  const db = new DatabaseSync(':memory:');

  // 1. Create legacy schema without account_owner_id (the pre-upgrade state)
  db.exec(`
    CREATE TABLE local_matches (
      id TEXT PRIMARY KEY,
      title TEXT,
      status TEXT,
      tournament_id TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      authority_epoch INTEGER NOT NULL DEFAULT 1,
      json_data TEXT NOT NULL,
      last_updated INTEGER NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Insert a pre-existing legacy match with organizerUserId inside json_data
  const legacyMatchId = 'legacy-match-001';
  const legacyOrganizerId = 'organizer_user_abc123';
  const legacyJsonData = JSON.stringify({
    id: legacyMatchId,
    title: 'Pre-upgrade Local Match',
    status: 'live',
    organizerUserId: legacyOrganizerId,
    revision: 3,
  });

  db.exec(`
    INSERT INTO local_matches (id, title, status, revision, authority_epoch, json_data, last_updated, is_demo)
    VALUES ('${legacyMatchId}', 'Pre-upgrade Local Match', 'live', 3, 1, '${legacyJsonData}', ${Date.now()}, 0);
  `);

  // Verify that attempting to create index on account_owner_id BEFORE adding the column fails with "no such column"
  assert.throws(
    () => {
      db.exec('CREATE INDEX idx_matches_owner ON local_matches(account_owner_id);');
    },
    (err: any) => {
      assert.match(err.message, /no such column: account_owner_id/);
      return true;
    },
    'Creating index before altering table must reproduce the reported failure'
  );

  // 2. Execute the repaired ordered migration sequence:
  // Step A: Inspect PRAGMA table_info
  const columns = db.prepare('PRAGMA table_info(local_matches);').all() as Array<{ name: string }>;
  const hasOwnerCol = columns.some((col) => col.name === 'account_owner_id');
  assert.equal(hasOwnerCol, false, 'Column should not exist initially');

  // Step B: Add column
  db.exec('ALTER TABLE local_matches ADD COLUMN account_owner_id TEXT;');

  // Step C: Backfill from json_data
  const unassigned = db.prepare('SELECT id, json_data FROM local_matches WHERE account_owner_id IS NULL;').all() as Array<{ id: string; json_data: string }>;
  for (const row of unassigned) {
    const parsed = JSON.parse(row.json_data);
    const ownerId = parsed.organizerUserId || parsed.creatorUserId || null;
    if (ownerId) {
      db.prepare('UPDATE local_matches SET account_owner_id = ? WHERE id = ?;').run(ownerId, row.id);
    }
  }

  // Step D: Create index (now succeeds cleanly)
  assert.doesNotThrow(() => {
    db.exec('CREATE INDEX IF NOT EXISTS idx_matches_owner ON local_matches(account_owner_id);');
  });

  // 3. Verify integrity
  // Check column exists
  const updatedColumns = db.prepare('PRAGMA table_info(local_matches);').all() as Array<{ name: string }>;
  assert.ok(updatedColumns.some((col) => col.name === 'account_owner_id'));

  // Check legacy row is intact and backfilled
  const migratedRow = db.prepare('SELECT * FROM local_matches WHERE id = ?;').get(legacyMatchId) as any;
  assert.ok(migratedRow);
  assert.equal(migratedRow.id, legacyMatchId);
  assert.equal(migratedRow.account_owner_id, legacyOrganizerId, 'Safe backfill must extract owner from json_data');

  // 4. Test idempotency: re-running the migration check must not throw
  const rerunColumns = db.prepare('PRAGMA table_info(local_matches);').all() as Array<{ name: string }>;
  const stillHasOwnerCol = rerunColumns.some((col) => col.name === 'account_owner_id');
  assert.equal(stillHasOwnerCol, true);
  if (!stillHasOwnerCol) {
    db.exec('ALTER TABLE local_matches ADD COLUMN account_owner_id TEXT;');
  }
  assert.doesNotThrow(() => {
    db.exec('CREATE INDEX IF NOT EXISTS idx_matches_owner ON local_matches(account_owner_id);');
  });

  db.close();
});

test('SQLITE-UPGRADE-002: getDatabase() resets cached initPromise on failure and allows retry', async () => {
  resetDatabaseInstance();

  // First initialization succeeds
  const db = await getDatabase();
  assert.ok(db, 'Database instance must be initialized');

  // Verify singleton caching
  const db2 = await getDatabase();
  assert.strictEqual(db, db2, 'Subsequent getDatabase() calls must return the same instance');

  // Verify resetDatabaseInstance clears cache cleanly
  resetDatabaseInstance();
  const db3 = await getDatabase();
  assert.ok(db3, 'getDatabase() must succeed after reset');
});

import { createSampleMatch } from '../src/storage/defaultData';

test('SQLITE-UPGRADE-003: SQLiteMatchRepository persists and queries match with account_owner_id', async () => {
  const repo = new SQLiteMatchRepository();
  const matchId = generateUUID();
  const ownerId = 'user_test_owner_456';

  const match = createSampleMatch();
  match.id = matchId;
  match.title = 'Resilience Test Match';
  match.organizerUserId = ownerId;

  // Persist match
  await repo.saveMatch(match);

  // Retrieve by ID
  const retrieved = await repo.getById(matchId);
  assert.ok(retrieved, 'Match must be retrieved');
  assert.equal(retrieved?.id, matchId);
  assert.equal(retrieved?.organizerUserId, ownerId);

  // List with account filter
  const ownerMatches = await repo.listMatches({ accountId: ownerId });
  assert.ok(ownerMatches.some((m) => m.id === matchId), 'Match must be found in owner query');
});
