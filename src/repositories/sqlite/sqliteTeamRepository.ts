import { getDatabase } from './database';
import type { ITeamRepository } from '../types';
import type { Team } from '../../types/cricket';

export class SQLiteTeamRepository implements ITeamRepository {
  async getById(teamId: string): Promise<Team | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ json_data: string }>(
      'SELECT json_data FROM local_teams WHERE id = ?',
      [teamId]
    );
    if (!row) return null;
    return JSON.parse(row.json_data) as Team;
  }

  async saveTeam(team: Team): Promise<void> {
    if (!team || !team.id) {
      throw new Error('Cannot persist team without ID');
    }
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_teams
        (id, name, short_name, captain_player_id, json_data, last_updated)
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
  }

  async listTeams(): Promise<Team[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ json_data: string }>(
      'SELECT json_data FROM local_teams ORDER BY name ASC'
    );
    return rows.map((r) => JSON.parse(r.json_data) as Team);
  }

  async deleteTeam(teamId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM local_teams WHERE id = ?', [teamId]);
  }
}
