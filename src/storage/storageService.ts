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
} from '../types/cricket';
import { DEFAULT_TEAMS, DEFAULT_JOIN_REQUESTS, createSampleMatch } from './defaultData';

const MATCHES_STORAGE_KEY = '@cric_matches_v1';
const TEAMS_STORAGE_KEY = '@cric_teams_v1';
const USER_PROFILE_KEY = '@cric_user_profile_v1';
const JOIN_REQUESTS_KEY = '@cric_join_requests_v1';
const TOURNAMENTS_STORAGE_KEY = '@cric_tournaments_v1';

export interface UserProfile {
  id: string;
  phoneNumber?: string;
  name: string;
  isGuest: boolean;
  isVerified: boolean;
  role: 'captain' | 'player' | 'organizer';
  playingRole?: PlayingRole;
  battingHand?: BattingHand;
  bowlingStyle?: BowlingStyle;
  claimedPlayerId?: string;
  teamId?: string;
}

export const PRESET_USERS: UserProfile[] = [
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
  {
    id: 'user_guest',
    name: 'Guest Player / Recruit',
    phoneNumber: '+91 90000 00000',
    isGuest: true,
    isVerified: false,
    role: 'player',
    playingRole: 'all-rounder',
    battingHand: 'right',
    bowlingStyle: 'fast-medium',
  },
];

export class StorageService {
  // Matches
  static async getMatches(): Promise<Match[]> {
    try {
      const data = await AsyncStorage.getItem(MATCHES_STORAGE_KEY);
      if (!data) {
        const initial = [createSampleMatch()];
        await AsyncStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to load matches from AsyncStorage', err);
      return [createSampleMatch()];
    }
  }

  static async saveMatches(matches: Match[]): Promise<void> {
    try {
      await AsyncStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(matches));
    } catch (err) {
      console.error('Failed to persist matches to AsyncStorage', err);
    }
  }

  static async getMatchById(id: string): Promise<Match | undefined> {
    const matches = await StorageService.getMatches();
    return matches.find((m) => m.id === id);
  }

  static async saveMatch(match: Match): Promise<void> {
    const matches = await StorageService.getMatches();
    const index = matches.findIndex((m) => m.id === match.id);
    const updated = [...matches];
    const withTimestamp: Match = {
      ...match,
      lastUpdated: Date.now(),
    };

    if (index >= 0) {
      updated[index] = withTimestamp;
    } else {
      updated.unshift(withTimestamp);
    }
    await StorageService.saveMatches(updated);
  }

  static async deleteMatch(id: string): Promise<void> {
    const matches = await StorageService.getMatches();
    const filtered = matches.filter((m) => m.id !== id);
    await StorageService.saveMatches(filtered);
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
    } catch (err) {
      console.error('Failed to load teams from AsyncStorage', err);
      return DEFAULT_TEAMS;
    }
  }

  static async saveTeams(teams: Team[]): Promise<void> {
    try {
      await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
    } catch (err) {
      console.error('Failed to persist teams to AsyncStorage', err);
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
        const defaultUser = PRESET_USERS[0]; // Rohit Sharma by default
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(defaultUser));
        return defaultUser;
      }
      const parsed = JSON.parse(data);
      if (!parsed || !parsed.role) {
        const defaultUser = PRESET_USERS[0];
        const healed: UserProfile = {
          ...defaultUser,
          ...parsed,
          role: parsed?.role || defaultUser.role,
        };
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(healed));
        return healed;
      }
      return parsed;
    } catch {
      return PRESET_USERS[0];
    }
  }

  static async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.error('Failed to save profile', err);
    }
  }

  // JSON export & import
  static exportMatchJSON(match: Match): string {
    return JSON.stringify(match, null, 2);
  }

  static importMatchJSON(jsonString: string): Match {
    const parsed = JSON.parse(jsonString);
    if (!parsed.id || !parsed.team1 || !parsed.team2 || !parsed.innings) {
      throw new Error('Invalid match backup format');
    }
    return parsed as Match;
  }

  // Tournaments
  static async getTournaments(): Promise<Tournament[]> {
    try {
      const data = await AsyncStorage.getItem(TOURNAMENTS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
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
    } catch (err) {
      console.error('Failed to save tournament', err);
    }
  }

  static async getTournamentById(id: string): Promise<Tournament | undefined> {
    const all = await StorageService.getTournaments();
    return all.find((t) => t.id === id);
  }

  static async deleteTournament(id: string): Promise<void> {
    const all = await StorageService.getTournaments();
    const filtered = all.filter((t) => t.id !== id);
    await AsyncStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(filtered));
  }

  // Ghost Player Claiming
  static normalizePhone(phone?: string): string {
    if (!phone) return '';
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      return digitsOnly.slice(-10);
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

