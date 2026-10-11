import type {
  Match,
  InningsAction,
  Player,
  Team,
  Tournament,
  TournamentEntry,
  TournamentEntryStatus,
  MatchStatus,
  CareerStats,
} from '../types/cricket';

export interface OutboxEvent {
  id: string;
  matchId: string;
  actionId: string;
  expectedRevision: number;
  authorityEpoch: number;
  actionType: string;
  payload: any;
  createdAt: number;
  syncedAt?: number;
  retryCount: number;
  status: 'pending' | 'in_flight' | 'synced' | 'failed' | 'conflict';
  lastError?: string;
}

export interface MatchFilter {
  tournamentId?: string;
  status?: MatchStatus;
  limit?: number;
  offset?: number;
  excludeDemo?: boolean;
}

export interface IMatchRepository {
  getById(matchId: string): Promise<Match | null>;
  saveMatch(match: Match): Promise<void>;
  listMatches(filter?: MatchFilter): Promise<Match[]>;
  deleteMatch(matchId: string): Promise<void>;
  appendAction(
    matchId: string,
    action: InningsAction,
    expectedRevision: number,
    authorityEpoch: number,
    nextMatchState?: Match,
    actionId?: string
  ): Promise<{ revision: number; actionId: string }>;
  getPendingSyncOutbox(): Promise<OutboxEvent[]>;
  markOutboxSynced(eventIds: string[]): Promise<void>;
  markOutboxFailed(eventId: string, error: string, isPermanentConflict?: boolean): Promise<void>;
}

export interface IPlayerRepository {
  getById(playerId: string): Promise<Player | null>;
  getByAccountId(accountId: string): Promise<Player | null>;
  getByPhoneNumber(phoneNumber: string): Promise<Player | null>;
  savePlayer(player: Player): Promise<void>;
  listPlayers(): Promise<Player[]>;
  getCareerTotals(playerId: string): Promise<CareerStats | null>;
}

export interface ITeamRepository {
  getById(teamId: string): Promise<Team | null>;
  saveTeam(team: Team): Promise<void>;
  listTeams(): Promise<Team[]>;
  deleteTeam(teamId: string): Promise<void>;
}

export interface ITournamentRepository {
  getById(tournamentId: string): Promise<Tournament | null>;
  saveTournament(tournament: Tournament): Promise<void>;
  listTournaments(): Promise<Tournament[]>;
  getEntries(tournamentId: string): Promise<TournamentEntry[]>;
  saveEntry(entry: TournamentEntry): Promise<void>;
  updateEntryStatus(entryId: string, status: TournamentEntryStatus, reason?: string): Promise<void>;
}
