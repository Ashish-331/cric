import { Platform } from 'react-native';
import { SQLiteMatchRepository } from './sqlite/sqliteMatchRepository';
import { SQLitePlayerRepository } from './sqlite/sqlitePlayerRepository';
import { SQLiteTeamRepository } from './sqlite/sqliteTeamRepository';
import { SQLiteTournamentRepository } from './sqlite/sqliteTournamentRepository';
import type {
  IMatchRepository,
  IPlayerRepository,
  ITeamRepository,
  ITournamentRepository,
} from './types';

// Concrete repository singletons
export const sqliteMatchRepository = new SQLiteMatchRepository();
export const sqlitePlayerRepository = new SQLitePlayerRepository();
export const sqliteTeamRepository = new SQLiteTeamRepository();
export const sqliteTournamentRepository = new SQLiteTournamentRepository();

export const matchRepository: IMatchRepository = sqliteMatchRepository;
export const playerRepository: IPlayerRepository = sqlitePlayerRepository;
export const teamRepository: ITeamRepository = sqliteTeamRepository;
export const tournamentRepository: ITournamentRepository = sqliteTournamentRepository;

export * from './types';
