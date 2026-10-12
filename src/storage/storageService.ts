import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Match,
  Team,
  Player,
  JoinRequest,
  PlayingRole,
  BattingHand,
  BowlingStyle,
  Tournament,
  TournamentEntry,
  TournamentEntryStatus,
  TournamentSquadMember,
} from '../types/cricket';
import { DEFAULT_TEAMS, DEFAULT_JOIN_REQUESTS, createSampleMatch } from './defaultData';

export type StorageErrorCode =
  | 'WRITE_FAILED'
  | 'READ_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'PAYLOAD_CORRUPT'
  | 'NOT_FOUND'
  | 'MIGRATION_FAILED';

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly key?: string;
  public readonly causeError?: unknown;

  constructor(
    message: string,
    code: StorageErrorCode,
    key?: string,
    causeError?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.key = key;
    this.causeError = causeError;
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

const MATCH_KEY_PREFIX = '@cric_match_';
const MATCH_INDEX_KEY_V2 = '@cric_match_ids_v2';
const LEGACY_MATCHES_KEY = '@cric_matches_v1';
const LEGACY_BACKUP_KEY = '@cric_matches_v1_backup';
const TEAMS_STORAGE_KEY = '@cric_teams_v1';
const USER_PROFILE_KEY = '@cric_user_profile_v1';
const JOIN_REQUESTS_KEY = '@cric_join_requests_v1';
const TOURNAMENTS_STORAGE_KEY = '@cric_tournaments_v1';
const TOURNAMENT_ENTRIES_STORAGE_KEY = '@cric_tournament_entries_v1';

export interface UserProfile {
  id: string;
  email?: string;
  phoneNumber?: string;
  name: string;
  isGuest: boolean;
  isVerified: boolean;
  role: 'captain' | 'player' | 'organizer' | 'scorer';
  playingRole?: PlayingRole;
  battingHand?: BattingHand;
  bowlingStyle?: BowlingStyle;
  claimedPlayerId?: string;
  teamId?: string;
}

export const DEFAULT_GUEST_USER: UserProfile = {
  id: 'user_guest',
  name: 'Guest Scorer',
  phoneNumber: '',
  isGuest: true,
  isVerified: false,
  role: 'scorer',
  playingRole: 'all-rounder',
  battingHand: 'right',
  bowlingStyle: 'fast-medium',
};

export const PRESET_USERS: UserProfile[] = [
  DEFAULT_GUEST_USER,
  {
    id: 'user_scorer',
    name: 'Official Scorer',
    phoneNumber: '+91 98765 43212',
    isGuest: false,
    isVerified: true,
    role: 'scorer',
    playingRole: 'all-rounder',
    battingHand: 'right',
  },
  {
    id: 'user_rohit',
    name: 'Rohit Sharma (Captain)',
    phoneNumber: '+91 98765 43210',
    isGuest: false,
    isVerified: true,
    role: 'captain',
    playingRole: 'batter',
    battingHand: 'right',
    bowlingStyle: 'spin-off',
    claimedPlayerId: 'p1_1',
    teamId: 'team_mumbai',
  },
  {
    id: 'user_virat',
    name: 'Virat Kohli (Player)',
    phoneNumber: '+91 98112 23344',
    isGuest: false,
    isVerified: true,
    role: 'player',
    playingRole: 'batter',
    battingHand: 'right',
    bowlingStyle: 'medium',
    claimedPlayerId: 'p2_1',
    teamId: 'team_bangalore',
  },
  {
    id: 'user_organizer',
    name: 'Ashish Nehra (Organizer)',
    phoneNumber: '+91 99001 12233',
    isGuest: false,
    isVerified: true,
    role: 'organizer',
    playingRole: 'all-rounder',
    battingHand: 'left',
    bowlingStyle: 'fast-medium',
  },
  {
    id: 'user_dk',
    name: 'Dinesh Karthik (WK / Batter)',
    phoneNumber: '+91 98112 23346',
    isGuest: false,
    isVerified: true,
    role: 'player',
    playingRole: 'wicketkeeper',
    battingHand: 'right',
    claimedPlayerId: 'p2_6',
    teamId: 'team_bangalore',
  },
];

export class StorageService {
  private static matchWriteQueues: Map<string, Promise<void>> = new Map();

  static validateMatchPayload(match: unknown): Match {
    if (!match || typeof match !== 'object') {
      throw new StorageError('Match payload is null or not an object', 'PAYLOAD_CORRUPT');
    }
    const m = match as Match;
    if (!m.id || typeof m.id !== 'string') {
      throw new StorageError('Match missing required valid id', 'PAYLOAD_CORRUPT');
    }
    if (!m.innings || !Array.isArray(m.innings) || !m.innings[0]) {
      throw new StorageError('Match missing required innings array', 'PAYLOAD_CORRUPT');
    }
    return m;
  }

  static async migrateLegacyMatchesIfNeeded(): Promise<void> {
    try {
      const v2IndexRaw = await AsyncStorage.getItem(MATCH_INDEX_KEY_V2);
      if (v2IndexRaw !== null) {
        return;
      }

      const legacyRaw = await AsyncStorage.getItem(LEGACY_MATCHES_KEY);
      if (!legacyRaw) {
        await AsyncStorage.setItem(MATCH_INDEX_KEY_V2, JSON.stringify([]));
        return;
      }

      const legacyMatches = JSON.parse(legacyRaw) as Match[];
      if (Array.isArray(legacyMatches) && legacyMatches.length > 0) {
        const pairs: [string, string][] = [];
        const index: string[] = [];

        for (const m of legacyMatches) {
          if (m && m.id) {
            pairs.push([`${MATCH_KEY_PREFIX}${m.id}`, JSON.stringify(m)]);
            index.push(m.id);
          }
        }

        await AsyncStorage.multiSet(pairs);
        await AsyncStorage.setItem(MATCH_INDEX_KEY_V2, JSON.stringify(index));

        const verifyPairs = await AsyncStorage.multiGet(pairs.map(([k]) => k));
        const allVerified = verifyPairs.every(([_, v]) => v !== null);
        if (!allVerified) {
          throw new StorageError('Verification failed during legacy match migration', 'MIGRATION_FAILED');
        }

        await AsyncStorage.setItem(LEGACY_BACKUP_KEY, legacyRaw);
        await AsyncStorage.removeItem(LEGACY_MATCHES_KEY);
      } else {
        await AsyncStorage.setItem(MATCH_INDEX_KEY_V2, JSON.stringify([]));
      }
    } catch (err: any) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`Migration failed: ${err.message}`, 'MIGRATION_FAILED', LEGACY_MATCHES_KEY, err);
    }
  }

  // Matches
  static async getMatches(): Promise<Match[]> {
    await StorageService.migrateLegacyMatchesIfNeeded();
    try {
      const indexRaw = await AsyncStorage.getItem(MATCH_INDEX_KEY_V2);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      if (index.length === 0) {
        const sample = createSampleMatch();
        await StorageService.saveMatch(sample);
        return [sample];
      }

      const keys = index.map((id) => `${MATCH_KEY_PREFIX}${id}`);
      const pairs = await AsyncStorage.multiGet(keys);
      const matches: Match[] = [];
      for (const [_, val] of pairs) {
        if (val) {
          try {
            matches.push(JSON.parse(val));
          } catch {
            // Heal/skip corrupted single match entry without failing full suite
          }
        }
      }
      return matches;
    } catch (err: any) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`Failed to load matches: ${err.message}`, 'READ_FAILED', MATCH_INDEX_KEY_V2, err);
    }
  }

  static async saveMatches(matches: Match[]): Promise<void> {
    for (const match of matches) {
      await StorageService.saveMatch(match);
    }
  }

  static async getMatchById(id: string): Promise<Match | undefined> {
    await StorageService.migrateLegacyMatchesIfNeeded();
    const matchKey = `${MATCH_KEY_PREFIX}${id}`;
    try {
      const raw = await AsyncStorage.getItem(matchKey);
      if (!raw) return undefined;
      return JSON.parse(raw) as Match;
    } catch (err: any) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`Failed to read match ${id}: ${err.message}`, 'READ_FAILED', matchKey, err);
    }
  }

  static async saveMatch(match: Match): Promise<void> {
    StorageService.validateMatchPayload(match);
    await StorageService.migrateLegacyMatchesIfNeeded();

    const matchKey = `${MATCH_KEY_PREFIX}${match.id}`;
    const serialized = JSON.stringify({
      ...match,
      lastUpdated: Date.now(),
    });

    const prevQueue = StorageService.matchWriteQueues.get(match.id) || Promise.resolve();
    const writeOp = prevQueue.then(async () => {
      try {
        await AsyncStorage.setItem(matchKey, serialized);
        const indexRaw = await AsyncStorage.getItem(MATCH_INDEX_KEY_V2);
        const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
        if (!index.includes(match.id)) {
          index.unshift(match.id);
          await AsyncStorage.setItem(MATCH_INDEX_KEY_V2, JSON.stringify(index));
        }
      } catch (err: any) {
        throw new StorageError(
          `Failed to persist match ${match.id}: ${err.message}`,
          'WRITE_FAILED',
          matchKey,
          err
        );
      }
    });

    StorageService.matchWriteQueues.set(
      match.id,
      writeOp.catch(() => {})
    );

    await writeOp;
  }

  static async deleteMatch(id: string): Promise<void> {
    await StorageService.migrateLegacyMatchesIfNeeded();
    const matchKey = `${MATCH_KEY_PREFIX}${id}`;
    try {
      await AsyncStorage.removeItem(matchKey);
      const indexRaw = await AsyncStorage.getItem(MATCH_INDEX_KEY_V2);
      if (indexRaw) {
        const index: string[] = JSON.parse(indexRaw);
        const filtered = index.filter((item) => item !== id);
        await AsyncStorage.setItem(MATCH_INDEX_KEY_V2, JSON.stringify(filtered));
      }
    } catch (err: any) {
      throw new StorageError(
        `Failed to delete match ${id}: ${err.message}`,
        'WRITE_FAILED',
        matchKey,
        err
      );
    }
  }

  // Teams
  static async getTeams(): Promise<Team[]> {
    try {
      const data = await AsyncStorage.getItem(TEAMS_STORAGE_KEY);
      if (!data) {
        await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(DEFAULT_TEAMS));
        return DEFAULT_TEAMS;
      }
      return JSON.parse(data);
    } catch (err: any) {
      throw new StorageError(`Failed to load teams: ${err.message}`, 'READ_FAILED', TEAMS_STORAGE_KEY, err);
    }
  }

  static async saveTeams(teams: Team[]): Promise<void> {
    try {
      await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
    } catch (err: any) {
      throw new StorageError(`Failed to persist teams: ${err.message}`, 'WRITE_FAILED', TEAMS_STORAGE_KEY, err);
    }
  }

  static async saveTeam(team: Team): Promise<void> {
    const teams = await StorageService.getTeams();
    const index = teams.findIndex((t) => t.id === team.id);
    const updated = [...teams];
    if (index >= 0) {
      updated[index] = team;
    } else {
      updated.push(team);
    }
    await StorageService.saveTeams(updated);
  }

  static async getTeamById(id: string): Promise<Team | undefined> {
    const teams = await StorageService.getTeams();
    return teams.find((t) => t.id === id);
  }

  // Join Requests
  static async getJoinRequests(): Promise<JoinRequest[]> {
    try {
      const data = await AsyncStorage.getItem(JOIN_REQUESTS_KEY);
      if (!data) {
        await AsyncStorage.setItem(JOIN_REQUESTS_KEY, JSON.stringify(DEFAULT_JOIN_REQUESTS));
        return DEFAULT_JOIN_REQUESTS;
      }
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to load join requests from AsyncStorage', err);
      return DEFAULT_JOIN_REQUESTS;
    }
  }

  static async saveJoinRequests(requests: JoinRequest[]): Promise<void> {
    try {
      await AsyncStorage.setItem(JOIN_REQUESTS_KEY, JSON.stringify(requests));
    } catch (err) {
      console.error('Failed to persist join requests', err);
    }
  }

  static async addJoinRequest(req: JoinRequest): Promise<void> {
    const list = await StorageService.getJoinRequests();
    // Prevent duplicate pending requests
    const exists = list.some(
      (r) => r.teamId === req.teamId && r.playerId === req.playerId && r.status === 'pending'
    );
    if (!exists) {
      const updated = [req, ...list];
      await StorageService.saveJoinRequests(updated);
    }
  }

  static async updateJoinRequestStatus(
    requestId: string,
    status: 'approved' | 'declined'
  ): Promise<JoinRequest | undefined> {
    const list = await StorageService.getJoinRequests();
    const target = list.find((r) => r.id === requestId);
    if (target) {
      target.status = status;
      await StorageService.saveJoinRequests(list);
      return target;
    }
    return undefined;
  }

  /**
   * Atomically approves a join request and adds the player to the team roster
   * using AsyncStorage.multiSet to eliminate any concurrency or race condition.
   */
  static async approveJoinRequestAtomic(requestId: string): Promise<{
    updatedRequest?: JoinRequest;
    updatedTeam?: Team;
    allTeams: Team[];
    allRequests: JoinRequest[];
  }> {
    const requests = await StorageService.getJoinRequests();
    const teams = await StorageService.getTeams();
    const targetReq = requests.find((r) => r.id === requestId);

    let updatedTeam: Team | undefined;

    if (targetReq) {
      targetReq.status = 'approved';

      const teamIndex = teams.findIndex((t) => t.id === targetReq.teamId);
      if (teamIndex >= 0) {
        const team = teams[teamIndex];
        const alreadyInSquad = team.players.some((p) => p.id === targetReq.playerId);
        if (!alreadyInSquad) {
          const newPlayer: Player = {
            id: targetReq.playerId,
            name: targetReq.playerName,
            role: targetReq.playerRole,
            battingHand: 'right',
            phoneNumber: targetReq.playerPhone,
            isVerified: true,
            careerStats: {
              matches: 0,
              inningsBatted: 0,
              runs: 0,
              highestScore: 0,
              highestScoreNotOut: false,
              average: 0,
              strikeRate: 0,
              fifties: 0,
              hundreds: 0,
              fours: 0,
              sixes: 0,
              wickets: 0,
              oversBowled: 0,
              maidens: 0,
              runsConceded: 0,
              bowlingAverage: 0,
              bowlingEconomy: 0,
              bestBowling: '0/0',
              catches: 0,
              stumpings: 0,
              runOuts: 0,
            },
            recentScores: [],
          };
          updatedTeam = {
            ...team,
            players: [...team.players, newPlayer],
          };
          teams[teamIndex] = updatedTeam;
        } else {
          updatedTeam = team;
        }
      }

      // Atomic commit to persistent AsyncStorage
      await AsyncStorage.multiSet([
        [TEAMS_STORAGE_KEY, JSON.stringify(teams)],
        [JOIN_REQUESTS_KEY, JSON.stringify(requests)],
      ]);
    }

    return {
      updatedRequest: targetReq,
      updatedTeam,
      allTeams: teams,
      allRequests: requests,
    };
  }

  /**
   * Atomically declines a join request.
   */
  static async declineJoinRequestAtomic(requestId: string): Promise<{
    updatedRequest?: JoinRequest;
    allRequests: JoinRequest[];
  }> {
    const requests = await StorageService.getJoinRequests();
    const targetReq = requests.find((r) => r.id === requestId);
    if (targetReq) {
      targetReq.status = 'declined';
      await AsyncStorage.setItem(JOIN_REQUESTS_KEY, JSON.stringify(requests));
    }
    return {
      updatedRequest: targetReq,
      allRequests: requests,
    };
  }

  // User Profile
  static async getUserProfile(): Promise<UserProfile> {
    try {
      const data = await AsyncStorage.getItem(USER_PROFILE_KEY);
      if (!data) {
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(DEFAULT_GUEST_USER));
        return DEFAULT_GUEST_USER;
      }
      const parsed = JSON.parse(data);
      if (!parsed || !parsed.role) {
        const healed: UserProfile = {
          ...DEFAULT_GUEST_USER,
          ...parsed,
          role: parsed?.role || DEFAULT_GUEST_USER.role,
        };
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(healed));
        return healed;
      }
      return parsed;
    } catch {
      return DEFAULT_GUEST_USER;
    }
  }

  static async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } catch (err: any) {
      throw new StorageError(
        `Failed to save profile: ${err.message}`,
        'WRITE_FAILED',
        USER_PROFILE_KEY,
        err
      );
    }
  }

  // JSON export & import
  static exportMatchJSON(match: Match): string {
    return JSON.stringify(match, null, 2);
  }

  static importMatchJSON(jsonString: string): Match {
    const parsed = JSON.parse(jsonString);
    if (!parsed.id || !parsed.team1 || !parsed.team2 || !parsed.innings) {
      throw new StorageError('Invalid match backup format', 'PAYLOAD_CORRUPT');
    }
    return parsed as Match;
  }

  // Tournaments
  static async getTournaments(): Promise<Tournament[]> {
    try {
      const data = await AsyncStorage.getItem(TOURNAMENTS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (err: any) {
      throw new StorageError(
        `Failed to load tournaments: ${err.message}`,
        'READ_FAILED',
        TOURNAMENTS_STORAGE_KEY,
        err
      );
    }
  }

  static async saveTournament(tournament: Tournament): Promise<void> {
    try {
      const all = await StorageService.getTournaments();
      const idx = all.findIndex((t) => t.id === tournament.id);
      if (idx >= 0) {
        all[idx] = tournament;
      } else {
        all.unshift(tournament);
      }
      await AsyncStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(all));
    } catch (err: any) {
      throw new StorageError(
        `Failed to save tournament: ${err.message}`,
        'WRITE_FAILED',
        TOURNAMENTS_STORAGE_KEY,
        err
      );
    }
  }

  static async getTournamentById(id: string): Promise<Tournament | undefined> {
    const all = await StorageService.getTournaments();
    return all.find((t) => t.id === id);
  }

  static async deleteTournament(id: string): Promise<void> {
    try {
      const all = await StorageService.getTournaments();
      const filtered = all.filter((t) => t.id !== id);
      await AsyncStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(filtered));
    } catch (err: any) {
      throw new StorageError(
        `Failed to delete tournament: ${err.message}`,
        'WRITE_FAILED',
        TOURNAMENTS_STORAGE_KEY,
        err
      );
    }
  }

  static async lockTournamentSquad(id: string): Promise<Tournament | undefined> {
    const tournament = await StorageService.getTournamentById(id);
    if (!tournament) return undefined;
    tournament.isSquadLocked = true;
    tournament.squadLockDeadline = new Date().toISOString();
    await StorageService.saveTournament(tournament);
    return tournament;
  }

  // Tournament Entries & Canonical Squad Freezing (Parts B, C, D)
  static async getTournamentEntries(tournamentId?: string): Promise<TournamentEntry[]> {
    try {
      const json = await AsyncStorage.getItem(TOURNAMENT_ENTRIES_STORAGE_KEY);
      if (!json) return [];
      const entries = JSON.parse(json) as TournamentEntry[];
      if (tournamentId) {
        return entries.filter((e) => e.tournamentId === tournamentId);
      }
      return entries;
    } catch (err: any) {
      throw new StorageError(
        `Failed to read tournament entries: ${err.message}`,
        'READ_FAILED',
        TOURNAMENT_ENTRIES_STORAGE_KEY,
        err
      );
    }
  }

  static async saveTournamentEntry(entry: TournamentEntry): Promise<void> {
    try {
      const all = await StorageService.getTournamentEntries();
      const idx = all.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        all[idx] = entry;
      } else {
        all.unshift(entry);
      }
      await AsyncStorage.setItem(TOURNAMENT_ENTRIES_STORAGE_KEY, JSON.stringify(all));
    } catch (err: any) {
      throw new StorageError(
        `Failed to save tournament entry: ${err.message}`,
        'WRITE_FAILED',
        TOURNAMENT_ENTRIES_STORAGE_KEY,
        err
      );
    }
  }

  static async getTournamentEntryById(id: string): Promise<TournamentEntry | undefined> {
    const all = await StorageService.getTournamentEntries();
    return all.find((e) => e.id === id);
  }

  static async deleteTournamentEntry(id: string): Promise<void> {
    try {
      const all = await StorageService.getTournamentEntries();
      const filtered = all.filter((e) => e.id !== id);
      await AsyncStorage.setItem(TOURNAMENT_ENTRIES_STORAGE_KEY, JSON.stringify(filtered));
    } catch (err: any) {
      throw new StorageError(
        `Failed to delete tournament entry: ${err.message}`,
        'WRITE_FAILED',
        TOURNAMENT_ENTRIES_STORAGE_KEY,
        err
      );
    }
  }

  static async submitTournamentEntry(
    tournamentId: string,
    team: Team,
    captainProfile?: UserProfile,
    customSquad?: TournamentSquadMember[]
  ): Promise<TournamentEntry> {
    const squad: TournamentSquadMember[] =
      customSquad && customSquad.length > 0
        ? customSquad
        : team.players.map((p, idx) => ({
            playerId: p.id,
            playerName: p.name,
            role: p.role,
            battingHand: p.battingHand || 'right',
            isCaptain: idx === 0,
            isWicketkeeper: p.role === 'wicketkeeper',
            jerseyNumber: p.jerseyNumber,
            phoneNumber: p.phoneNumber,
            status: 'eligible' as const,
            addedAt: Date.now(),
          }));

    const entry: TournamentEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tournamentId,
      teamId: team.id,
      teamName: team.name,
      shortName: team.shortName,
      primaryColor: team.primaryColor,
      captainUserId: captainProfile?.id,
      captainName: captainProfile?.name || team.players[0]?.name,
      captainPhone: captainProfile?.phoneNumber,
      status: 'submitted',
      submittedAt: Date.now(),
      squad,
    };

    await StorageService.saveTournamentEntry(entry);
    return entry;
  }

  static async reviewTournamentEntry(
    entryId: string,
    status: TournamentEntryStatus,
    reviewerUserId: string,
    reason?: string
  ): Promise<TournamentEntry> {
    const entry = await StorageService.getTournamentEntryById(entryId);
    if (!entry) {
      throw new StorageError(`Tournament entry not found: ${entryId}`, 'NOT_FOUND', entryId);
    }

    entry.status = status;
    entry.reviewedAt = Date.now();
    entry.reviewedByUserId = reviewerUserId;
    if (status === 'rejected') {
      entry.rejectionReason = reason;
    } else if (status === 'changes_requested') {
      entry.changesRequestedReason = reason;
    }

    await StorageService.saveTournamentEntry(entry);

    if (status === 'approved') {
      const tournament = await StorageService.getTournamentById(entry.tournamentId);
      if (tournament) {
        // Build frozen team snapshot from approved tournament squad members
        const frozenPlayers: Player[] = entry.squad.map((sm) => ({
          id: sm.playerId,
          name: sm.playerName,
          role: sm.role,
          battingHand: sm.battingHand,
          jerseyNumber: sm.jerseyNumber,
          phoneNumber: sm.phoneNumber,
          careerStats: {
            matches: 0,
            inningsBatted: 0,
            runs: 0,
            highestScore: 0,
            average: 0,
            strikeRate: 0,
            fifties: 0,
            hundreds: 0,
            fours: 0,
            sixes: 0,
            wickets: 0,
            oversBowled: 0,
            maidens: 0,
            runsConceded: 0,
            bowlingAverage: 0,
            bowlingEconomy: 0,
            bestBowling: '0/0',
            catches: 0,
            stumpings: 0,
            runOuts: 0,
          },
        }));

        const frozenTeam: Team = {
          id: entry.teamId,
          name: entry.teamName,
          shortName: entry.shortName,
          primaryColor: entry.primaryColor,
          players: frozenPlayers,
        };

        const existingTeamIdx = tournament.teams.findIndex((t) => t.id === entry.teamId);
        if (existingTeamIdx >= 0) {
          tournament.teams[existingTeamIdx] = frozenTeam;
        } else {
          tournament.teams.push(frozenTeam);
        }

        await StorageService.saveTournament(tournament);
      }
    }

    return entry;
  }

  // Ghost Player Claiming & Phone Normalization
  /**
   * Normalizes a phone number to standard E.164 representation.
   * Preserves explicit country codes (+91, +1, +44, etc.).
   * Prevents unsafe suffix collisions across country codes (AUTH-002).
   */
  static normalizePhone(phone?: string, defaultCountryCode: string = '+91'): string {
    if (!phone) return '';
    const trimmed = phone.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('+')) {
      const digits = trimmed.replace(/\D/g, '');
      return `+${digits}`;
    }

    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      const cc = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
      return `${cc}${digitsOnly}`;
    }

    if (digitsOnly.length > 10) {
      return `+${digitsOnly}`;
    }

    return digitsOnly;
  }

  static async findGhostPlayersByPhone(phone: string): Promise<Player[]> {
    const normalized = StorageService.normalizePhone(phone);
    if (!normalized || normalized.length < 5) return [];

    const teams = await StorageService.getTeams();
    const ghosts: Player[] = [];
    teams.forEach((team) => {
      team.players.forEach((player) => {
        if (
          player.phoneNumber &&
          StorageService.normalizePhone(player.phoneNumber) === normalized &&
          (player.isGuest || !player.isVerified)
        ) {
          ghosts.push(player);
        }
      });
    });
    return ghosts;
  }

  static async claimGhostPlayersByPhone(
    phone: string,
    verifiedUserId: string,
    verifiedName: string
  ): Promise<{ claimedCount: number; updatedTeams: Team[]; firstClaimedPlayerId?: string }> {
    const normalized = StorageService.normalizePhone(phone);
    if (!normalized || normalized.length < 5) return { claimedCount: 0, updatedTeams: [] };

    const teams = await StorageService.getTeams();
    let claimedCount = 0;
    let firstClaimedPlayerId: string | undefined;

    const updatedTeams = teams.map((team) => {
      let teamModified = false;
      const updatedPlayers = team.players.map((player) => {
        if (
          player.phoneNumber &&
          StorageService.normalizePhone(player.phoneNumber) === normalized &&
          (player.isGuest || !player.isVerified)
        ) {
          claimedCount += 1;
          if (!firstClaimedPlayerId) {
            firstClaimedPlayerId = player.id;
          }
          teamModified = true;
          return {
            ...player,
            isGuest: false,
            isVerified: true,
            claimedByUserId: verifiedUserId,
            name: verifiedName.trim() || player.name,
          };
        }
        return player;
      });

      return teamModified ? { ...team, players: updatedPlayers } : team;
    });

    if (claimedCount > 0) {
      // Sync across tournaments containing these teams for atomic consistency
      const tournaments = await StorageService.getTournaments();
      let tournamentsModified = false;
      const updatedTournaments = tournaments.map((tourn) => {
        let tourTeamMod = false;
        const tourTeams = tourn.teams.map((t) => {
          const matchingUpdatedTeam = updatedTeams.find((ut) => ut.id === t.id);
          if (matchingUpdatedTeam) {
            tourTeamMod = true;
            return matchingUpdatedTeam;
          }
          return t;
        });
        if (tourTeamMod) {
          tournamentsModified = true;
          return { ...tourn, teams: tourTeams };
        }
        return tourn;
      });

      const multiSetPairs: [string, string][] = [
        [TEAMS_STORAGE_KEY, JSON.stringify(updatedTeams)],
      ];
      if (tournamentsModified) {
        multiSetPairs.push([TOURNAMENTS_STORAGE_KEY, JSON.stringify(updatedTournaments)]);
      }

      await AsyncStorage.multiSet(multiSetPairs);
    }

    return { claimedCount, updatedTeams, firstClaimedPlayerId };
  }
}

