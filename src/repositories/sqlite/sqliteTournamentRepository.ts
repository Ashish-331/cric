import { getDatabase } from './database';
import type { ITournamentRepository } from '../types';
import type { Tournament, TournamentEntry, TournamentEntryStatus } from '../../types/cricket';

export class SQLiteTournamentRepository implements ITournamentRepository {
  async getById(tournamentId: string): Promise<Tournament | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ json_data: string }>(
      'SELECT json_data FROM local_tournaments WHERE id = ?',
      [tournamentId]
    );
    if (!row) return null;
    return JSON.parse(row.json_data) as Tournament;
  }

  async saveTournament(tournament: Tournament): Promise<void> {
    if (!tournament || !tournament.id) {
      throw new Error('Cannot persist tournament without ID');
    }
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_tournaments
        (id, name, format, status, organizer_id, json_data, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tournament.id,
        tournament.name,
        tournament.format,
        tournament.status,
        tournament.creatorUserId || null,
        JSON.stringify(tournament),
        Date.now(),
      ]
    );
  }

  async listTournaments(): Promise<Tournament[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ json_data: string }>(
      'SELECT json_data FROM local_tournaments ORDER BY last_updated DESC'
    );
    return rows.map((r) => JSON.parse(r.json_data) as Tournament);
  }

  async getEntries(tournamentId: string): Promise<TournamentEntry[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ json_data: string }>(
      'SELECT json_data FROM local_tournament_entries WHERE tournament_id = ? ORDER BY last_updated DESC',
      [tournamentId]
    );
    return rows.map((r) => JSON.parse(r.json_data) as TournamentEntry);
  }

  async saveEntry(entry: TournamentEntry): Promise<void> {
    if (!entry || !entry.id) {
      throw new Error('Cannot persist tournament entry without ID');
    }
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_tournament_entries
        (id, tournament_id, team_id, status, json_data, last_updated)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.tournamentId, entry.teamId, entry.status, JSON.stringify(entry), Date.now()]
    );
  }

  async updateEntryStatus(
    entryId: string,
    status: TournamentEntryStatus,
    reason?: string
  ): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ json_data: string }>(
      'SELECT json_data FROM local_tournament_entries WHERE id = ?',
      [entryId]
    );
    if (!row) {
      throw new Error(`Tournament entry ${entryId} not found`);
    }

    const entry: TournamentEntry = JSON.parse(row.json_data);
    entry.status = status;
    if (reason) {
      entry.rejectionReason = reason;
    }
    entry.reviewedAt = Date.now();

    await this.saveEntry(entry);
  }
}
