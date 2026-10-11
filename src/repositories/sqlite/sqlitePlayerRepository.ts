import { getDatabase } from './database';
import type { IPlayerRepository } from '../types';
import type { Player, CareerStats } from '../../types/cricket';

export class SQLitePlayerRepository implements IPlayerRepository {
  async getById(playerId: string): Promise<Player | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ json_data: string }>(
      'SELECT json_data FROM local_players WHERE id = ?',
      [playerId]
    );
    if (!row) return null;
    return JSON.parse(row.json_data) as Player;
  }

  async getByAccountId(accountId: string): Promise<Player | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ json_data: string }>(
      'SELECT json_data FROM local_players WHERE account_id = ?',
      [accountId]
    );
    if (!row) return null;
    return JSON.parse(row.json_data) as Player;
  }

  async getByPhoneNumber(phoneNumber: string): Promise<Player | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ json_data: string }>(
      'SELECT json_data FROM local_players WHERE phone_number = ?',
      [phoneNumber]
    );
    if (!row) return null;
    return JSON.parse(row.json_data) as Player;
  }

  async savePlayer(player: Player): Promise<void> {
    if (!player || !player.id) {
      throw new Error('Cannot persist player without canonical ID');
    }
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_players
        (id, name, phone_number, account_id, is_verified, is_guest, json_data, last_updated)
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

  async listPlayers(): Promise<Player[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ json_data: string }>(
      'SELECT json_data FROM local_players ORDER BY name ASC'
    );
    return rows.map((r) => JSON.parse(r.json_data) as Player);
  }

  async getCareerTotals(playerId: string): Promise<CareerStats | null> {
    const player = await this.getById(playerId);
    return player?.careerStats || null;
  }
}
