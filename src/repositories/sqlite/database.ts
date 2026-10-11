import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Match, Team, Tournament, TournamentEntry } from '../../types/cricket';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const DB_NAME = 'cric_local.db';

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    // Apply WAL mode and foreign keys (supported on native)
    if (Platform.OS !== 'web') {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }

    // Initialize Schema
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_matches (
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

      CREATE TABLE IF NOT EXISTS local_actions (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        expected_revision INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (match_id) REFERENCES local_matches(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        expected_revision INTEGER NOT NULL,
        authority_epoch INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        synced_at INTEGER,
        retry_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT
      );

      CREATE TABLE IF NOT EXISTS local_players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone_number TEXT,
        account_id TEXT,
        is_verified INTEGER NOT NULL DEFAULT 0,
        is_guest INTEGER NOT NULL DEFAULT 0,
        json_data TEXT NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        captain_player_id TEXT,
        json_data TEXT NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL,
        organizer_id TEXT,
        json_data TEXT NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_tournament_entries (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL,
        team_id TEXT NOT NULL,
        status TEXT NOT NULL,
        json_data TEXT NOT NULL,
        last_updated INTEGER NOT NULL,
        FOREIGN KEY (tournament_id) REFERENCES local_tournaments(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS migration_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        applied_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_matches_tourney ON local_matches(tournament_id);
      CREATE INDEX IF NOT EXISTS idx_actions_match_seq ON local_actions(match_id, sequence_number);
      CREATE INDEX IF NOT EXISTS idx_outbox_pending ON sync_outbox(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_players_phone ON local_players(phone_number);
      CREATE INDEX IF NOT EXISTS idx_entries_tourney ON local_tournament_entries(tournament_id);
    `);

    // Migrate from legacy AsyncStorage if needed
    await migrateFromAsyncStorage(db);

    dbInstance = db;
    return db;
  })();

  return initPromise;
}

/**
 * Safe, idempotent migration from AsyncStorage to SQLite.
 * Preserves legacy keys by creating a snapshot backup first.
 */
async function migrateFromAsyncStorage(db: SQLite.SQLiteDatabase): Promise<void> {
  const metaRow = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM migration_meta WHERE key = ?',
    ['async_storage_v2_to_sqlite']
  );

  if (metaRow) {
    return; // Already migrated successfully
  }

  // 1. Snapshot ALL legacy collections before reading
  const v2IndexRaw = await AsyncStorage.getItem('@cric_match_ids_v2');
  const legacyMatchesRaw = await AsyncStorage.getItem('@cric_matches_v1');
  const teamsRaw = await AsyncStorage.getItem('@cric_teams_v1');
  const tourneysRaw = await AsyncStorage.getItem('@cric_tournaments_v1');
  const entriesRaw = await AsyncStorage.getItem('@cric_tournament_entries_v1');

  if (v2IndexRaw) await AsyncStorage.setItem('@cric_match_ids_v2_backup', v2IndexRaw);
  if (legacyMatchesRaw) await AsyncStorage.setItem('@cric_matches_v1_backup', legacyMatchesRaw);
  if (teamsRaw) await AsyncStorage.setItem('@cric_teams_v1_backup', teamsRaw);
  if (tourneysRaw) await AsyncStorage.setItem('@cric_tournaments_v1_backup', tourneysRaw);
  if (entriesRaw) await AsyncStorage.setItem('@cric_tournament_entries_v1_backup', entriesRaw);

  const matchesToMigrate: Match[] = [];

  if (v2IndexRaw) {
    const matchIds: string[] = JSON.parse(v2IndexRaw);
    for (const mId of matchIds) {
      const raw = await AsyncStorage.getItem(`@cric_match_${mId}`);
      if (raw) {
        matchesToMigrate.push(JSON.parse(raw));
      }
    }
  } else if (legacyMatchesRaw) {
    const parsed: Match[] = JSON.parse(legacyMatchesRaw);
    matchesToMigrate.push(...parsed);
  }

  const teamsToMigrate: Team[] = teamsRaw ? JSON.parse(teamsRaw) : [];
  const tourneysToMigrate: Tournament[] = tourneysRaw ? JSON.parse(tourneysRaw) : [];
  const entriesToMigrate: TournamentEntry[] = entriesRaw ? JSON.parse(entriesRaw) : [];

  // 2. Execute migration inside an atomic SQLite transaction
  const runInTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (typeof (db as any).withTransactionAsync === 'function') {
      return (db as any).withTransactionAsync(fn);
    }
    await db.execAsync('BEGIN IMMEDIATE;');
    try {
      const res = await fn();
      await db.execAsync('COMMIT;');
      return res;
    } catch (err) {
      await db.execAsync('ROLLBACK;');
      throw err;
    }
  };

  await runInTransaction(async () => {
    // Insert matches
    for (const match of matchesToMigrate) {
      const isDemo = match.id.includes('demo') || match.title.includes('Demo') ? 1 : 0;
      await db.runAsync(
        `INSERT OR REPLACE INTO local_matches (id, title, status, tournament_id, revision, authority_epoch, json_data, last_updated, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          match.id,
          match.title,
          match.status,
          match.tournamentId || null,
          match.revision || 0,
          1,
          JSON.stringify(match),
          match.lastUpdated || Date.now(),
          isDemo,
        ]
      );
    }

    // Insert teams and players
    for (const team of teamsToMigrate) {
      await db.runAsync(
        `INSERT OR REPLACE INTO local_teams (id, name, short_name, captain_player_id, json_data, last_updated)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [team.id, team.name, team.shortName, team.captainPlayerId || null, JSON.stringify(team), Date.now()]
      );

      for (const player of team.players) {
        await db.runAsync(
          `INSERT OR REPLACE INTO local_players (id, name, phone_number, account_id, is_verified, is_guest, json_data, last_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            player.id,
            player.name,
            player.phoneNumber || null,
            player.claimedByUserId || null,
            player.isVerified ? 1 : 0,
            player.isGuest ? 1 : 0,
            JSON.stringify(player),
            Date.now(),
          ]
        );
      }
    }

    // Insert tournaments
    for (const t of tourneysToMigrate) {
      await db.runAsync(
        `INSERT OR REPLACE INTO local_tournaments (id, name, format, status, organizer_id, json_data, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.name, t.format, t.status, t.creatorUserId || null, JSON.stringify(t), Date.now()]
      );
    }

    // Insert entries
    for (const entry of entriesToMigrate) {
      await db.runAsync(
        `INSERT OR REPLACE INTO local_tournament_entries (id, tournament_id, team_id, status, json_data, last_updated)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entry.id, entry.tournamentId, entry.teamId, entry.status, JSON.stringify(entry), Date.now()]
      );
    }

    // 3. Verified Count Integrity Check
    const matchCountRow = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM local_matches');
    if ((matchCountRow?.count || 0) < matchesToMigrate.length) {
      throw new Error(
        `Migration verification failed: expected at least ${matchesToMigrate.length} matches, but found ${matchCountRow?.count}`
      );
    }

    // 4. Mark migration complete only upon verified success
    await db.runAsync(
      'INSERT INTO migration_meta (key, value, applied_at) VALUES (?, ?, ?)',
      [
        'async_storage_v2_to_sqlite',
        JSON.stringify({
          matches: matchesToMigrate.length,
          teams: teamsToMigrate.length,
          tournaments: tourneysToMigrate.length,
          entries: entriesToMigrate.length,
        }),
        Date.now(),
      ]
    );
  });
}
