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
  try {
    const metaRow = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM migration_meta WHERE key = ?',
      ['async_storage_v2_to_sqlite']
    );

    if (metaRow) {
      return; // Already migrated
    }

    // 1. Snapshot legacy matches
    const v2IndexRaw = await AsyncStorage.getItem('@cric_match_ids_v2');
    const legacyMatchesRaw = await AsyncStorage.getItem('@cric_matches_v1');

    if (legacyMatchesRaw) {
      await AsyncStorage.setItem('@cric_matches_v1_backup', legacyMatchesRaw);
    }

    const matchesToMigrate: Match[] = [];

    if (v2IndexRaw) {
      try {
        const matchIds: string[] = JSON.parse(v2IndexRaw);
        for (const mId of matchIds) {
          const raw = await AsyncStorage.getItem(`@cric_match_${mId}`);
          if (raw) {
            matchesToMigrate.push(JSON.parse(raw));
          }
        }
      } catch (e) {
        console.warn('Error reading v2 match index during migration:', e);
      }
    } else if (legacyMatchesRaw) {
      try {
        const parsed: Match[] = JSON.parse(legacyMatchesRaw);
        matchesToMigrate.push(...parsed);
      } catch (e) {
        console.warn('Error reading v1 matches during migration:', e);
      }
    }

    // Insert migrated matches into SQLite
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

    // 2. Migrate teams
    const teamsRaw = await AsyncStorage.getItem('@cric_teams_v1');
    if (teamsRaw) {
      try {
        const teams: Team[] = JSON.parse(teamsRaw);
        for (const team of teams) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_teams (id, name, short_name, captain_player_id, json_data, last_updated)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              team.id,
              team.name,
              team.shortName,
              team.captainPlayerId || null,
              JSON.stringify(team),
              Date.now(),
            ]
          );

          // Populate local_players from team players
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
      } catch (e) {
        console.warn('Error migrating teams to SQLite:', e);
      }
    }

    // 3. Migrate tournaments & entries
    const tourneysRaw = await AsyncStorage.getItem('@cric_tournaments_v1');
    if (tourneysRaw) {
      try {
        const tourneys: Tournament[] = JSON.parse(tourneysRaw);
        for (const t of tourneys) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_tournaments (id, name, format, status, organizer_id, json_data, last_updated)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [t.id, t.name, t.format, t.status, t.creatorUserId || null, JSON.stringify(t), Date.now()]
          );
        }
      } catch (e) {
        console.warn('Error migrating tournaments to SQLite:', e);
      }
    }

    const entriesRaw = await AsyncStorage.getItem('@cric_tournament_entries_v1');
    if (entriesRaw) {
      try {
        const entries: TournamentEntry[] = JSON.parse(entriesRaw);
        for (const entry of entries) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_tournament_entries (id, tournament_id, team_id, status, json_data, last_updated)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [entry.id, entry.tournamentId, entry.teamId, entry.status, JSON.stringify(entry), Date.now()]
          );
        }
      } catch (e) {
        console.warn('Error migrating entries to SQLite:', e);
      }
    }

    // Mark migration complete
    await db.runAsync(
      'INSERT INTO migration_meta (key, value, applied_at) VALUES (?, ?, ?)',
      ['async_storage_v2_to_sqlite', 'completed', Date.now()]
    );
  } catch (err) {
    console.error('Migration from AsyncStorage to SQLite failed:', err);
  }
}
