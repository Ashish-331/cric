import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Match,
  MatchStatus,
  Team,
  Player,
  Delivery,
  DismissalType,
  ExtraType,
  Innings,
  MatchRules,
  TossDecision,
  MatchFormat,
  BallType,
  JoinRequest,
  Tournament,
  PlayingRole,
} from '../types/cricket';
import {
  CricketEngine,
  BallInput,
  createInitialInnings,
} from '../engine/cricketEngine';
import { StatsRollupEngine } from '../engine/statsRollupEngine';
import { StorageService, UserProfile, PRESET_USERS } from '../storage/storageService';

interface CreateMatchParams {
  title: string;
  format: MatchFormat;
  venue: string;
  team1: Team;
  team2: Team;
  tossWinnerId: string;
  tossDecision: TossDecision;
  totalOvers: number;
  strikerId: string;
  nonStrikerId: string;
  openingBowlerId: string;
  ballType?: BallType;
  scorerName?: string;
  organizerName?: string;
  tournamentId?: string;
}

interface CricketContextType {
  matches: Match[];
  teams: Team[];
  tournaments: Tournament[];
  userProfile: UserProfile | null;
  presetUsers: UserProfile[];
  joinRequests: JoinRequest[];
  activeMatch: Match | null;
  loading: boolean;
  isOffline: boolean;
  // Account & User Switching
  switchUser: (user: UserProfile) => Promise<void>;
  updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
  getPlayerById: (playerId: string) => Player | undefined;
  updatePlayer: (player: Player) => Promise<void>;
  // Join Requests
  sendJoinRequest: (teamId: string) => Promise<void>;
  approveJoinRequest: (requestId: string) => Promise<void>;
  declineJoinRequest: (requestId: string) => Promise<void>;
  // Team Management
  saveTeam: (team: Team) => Promise<void>;
  createNewTeam: (name: string, shortName: string, primaryColor: string) => Promise<Team>;
  // Ghost Accounts
  addGhostPlayerToTeam: (teamId: string, name: string, phone: string, role?: PlayingRole) => Promise<Player>;
  claimGhostProfile: (phone: string) => Promise<{ claimedCount: number; firstClaimedPlayerId?: string }>;
  // Match Management & Scoring
  loadMatchById: (id: string) => Promise<Match | undefined>;
  setActiveMatch: (match: Match | null) => void;
  recordDelivery: (input: BallInput) => Promise<void>;
  undoDelivery: () => Promise<void>;
  retireBatter: (playerId: string, dismissalType: 'retired_hurt' | 'retired_out') => Promise<void>;
  returnBatter: (playerId: string, slot: 'striker' | 'nonStriker') => Promise<void>;
  selectBowler: (bowlerId: string) => Promise<void>;
  selectStriker: (strikerId: string) => Promise<void>;
  selectNonStriker: (nonStrikerId: string) => Promise<void>;
  swapStrikerNonStriker: () => Promise<void>;
  startSecondInnings: (strikerId: string, nonStrikerId: string, bowlerId: string) => Promise<void>;
  completeMatchManually: (matchId: string, customResult?: string) => Promise<void>;
  updateMatchStatus: (matchId: string, status: MatchStatus, resultOrNotes?: string) => Promise<void>;
  createNewMatch: (params: CreateMatchParams) => Promise<Match>;
  exportMatch: (matchId: string) => Promise<string>;
  importMatch: (jsonString: string) => Promise<Match>;
  deleteMatch: (matchId: string) => Promise<void>;
  refreshMatches: () => Promise<void>;
  // Tournaments
  createTournament: (params: {
    name: string;
    format: MatchFormat;
    totalOvers: number;
    ballType: BallType;
    teams?: Team[];
  }) => Promise<Tournament>;
  addTeamToTournament: (tournamentId: string, team: Team) => Promise<void>;
  addMatchToTournament: (tournamentId: string, match: Match) => Promise<void>;
  getTournamentById: (tournamentId: string) => Tournament | undefined;
  deleteTournament: (tournamentId: string) => Promise<void>;
  refreshTournaments: () => Promise<void>;
}

const CricketContext = createContext<CricketContextType | undefined>(undefined);

export const CricketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Helper to collect all players across teams
  const getAllPlayers = useCallback((teamList: Team[]): Player[] => {
    const map = new Map<string, Player>();
    teamList.forEach((t) => {
      t.players.forEach((p) => map.set(p.id, p));
    });
    return Array.from(map.values());
  }, []);

  // Perform Career Stats Rollup
  const applyCareerStatsRollup = useCallback(
    async (currentMatches: Match[], currentTeams: Team[]): Promise<Team[]> => {
      const allPlayers = getAllPlayers(currentTeams);
      const rollupResults = StatsRollupEngine.rollupAllCareerStats(allPlayers, currentMatches);

      const updatedTeams = currentTeams.map((team) => ({
        ...team,
        players: team.players.map((player) => {
          const stats = rollupResults.get(player.id);
          if (stats) {
            return {
              ...player,
              careerStats: stats.careerStats,
              baselineStats: stats.baselineStats,
              recentScores: stats.recentScores,
              baselineRecentScores: stats.baselineRecentScores,
            };
          }
          return player;
        }),
      }));

      await StorageService.saveTeams(updatedTeams);
      return updatedTeams;
    },
    [getAllPlayers]
  );

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        const [loadedMatches, loadedTeams, profile, requests, loadedTournaments] = await Promise.all([
          StorageService.getMatches(),
          StorageService.getTeams(),
          StorageService.getUserProfile(),
          StorageService.getJoinRequests(),
          StorageService.getTournaments(),
        ]);

        // Rollup stats initially from completed matches
        const rolledTeams = await applyCareerStatsRollup(loadedMatches, loadedTeams);

        setMatches(loadedMatches);
        setTeams(rolledTeams);
        setUserProfile(profile);
        setJoinRequests(requests);
        setTournaments(loadedTournaments);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    };
    initializeData();
  }, [applyCareerStatsRollup]);

  const refreshMatches = useCallback(async () => {
    const loadedMatches = await StorageService.getMatches();
    setMatches(loadedMatches);
  }, []);

  const loadMatchById = useCallback(async (id: string): Promise<Match | undefined> => {
    const match = await StorageService.getMatchById(id);
    if (match) {
      setActiveMatch(match);
    }
    return match;
  }, []);

  // Switch User Profile (e.g. Captain, Player, Organizer)
  const switchUser = useCallback(async (newUser: UserProfile) => {
    await StorageService.saveUserProfile(newUser);
    setUserProfile(newUser);
  }, []);

  const updateUserProfile = useCallback(
    async (partial: Partial<UserProfile>) => {
      if (!userProfile) return;
      const updated = { ...userProfile, ...partial };
      await StorageService.saveUserProfile(updated);
      setUserProfile(updated);
    },
    [userProfile]
  );

  // Get player by ID
  const getPlayerById = useCallback(
    (playerId: string): Player | undefined => {
      for (const t of teams) {
        const found = t.players.find((p) => p.id === playerId);
        if (found) return found;
      }
      return undefined;
    },
    [teams]
  );

  // Update a player's profile info
  const updatePlayer = useCallback(
    async (updatedPlayer: Player) => {
      const updatedTeams = teams.map((team) => ({
        ...team,
        players: team.players.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p)),
      }));
      setTeams(updatedTeams);
      await StorageService.saveTeams(updatedTeams);
    },
    [teams]
  );

  // Send Join Request
  const sendJoinRequest = useCallback(
    async (teamId: string) => {
      if (!userProfile) return;
      const targetTeam = teams.find((t) => t.id === teamId);
      if (!targetTeam) throw new Error('Team not found');

      const newReq: JoinRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        teamId,
        playerId: userProfile.claimedPlayerId || `p_user_${userProfile.id}`,
        playerName: userProfile.name,
        playerRole: userProfile.playingRole || 'all-rounder',
        playerPhone: userProfile.phoneNumber,
        status: 'pending',
        requestedAt: Date.now(),
      };

      await StorageService.addJoinRequest(newReq);
      const updatedReqs = await StorageService.getJoinRequests();
      setJoinRequests(updatedReqs);
    },
    [userProfile, teams]
  );

  // Captain Approves Join Request (Atomically synchronizes squad roster & join requests)
  const approveJoinRequest = useCallback(async (requestId: string) => {
    const result = await StorageService.approveJoinRequestAtomic(requestId);
    setJoinRequests(result.allRequests);
    setTeams(result.allTeams);
  }, []);

  // Captain Declines Join Request
  const declineJoinRequest = useCallback(async (requestId: string) => {
    const result = await StorageService.declineJoinRequestAtomic(requestId);
    setJoinRequests(result.allRequests);
  }, []);

  // Create new team by user (user becomes Captain)
  const createNewTeam = useCallback(
    async (name: string, shortName: string, primaryColor: string): Promise<Team> => {
      const captainPlayer: Player = {
        id: userProfile?.claimedPlayerId || `p_${Date.now()}_c`,
        name: userProfile?.name || 'Captain',
        role: userProfile?.playingRole || 'all-rounder',
        battingHand: userProfile?.battingHand || 'right',
        bowlingStyle: userProfile?.bowlingStyle || 'fast-medium',
        phoneNumber: userProfile?.phoneNumber,
        isCaptain: true,
        isVerified: userProfile?.isVerified ?? true,
        careerStats: StatsRollupEngine.createEmptyCareerStats(),
        recentScores: [],
      };

      const newTeam: Team = {
        id: `team_${Date.now()}`,
        name,
        shortName: shortName.toUpperCase(),
        primaryColor,
        captainPlayerId: captainPlayer.id,
        createdByUserId: userProfile?.id,
        players: [captainPlayer],
      };

      await StorageService.saveTeam(newTeam);
      const updated = await StorageService.getTeams();
      setTeams(updated);

      // Link user to this team
      if (userProfile) {
        await updateUserProfile({ teamId: newTeam.id, role: 'captain', claimedPlayerId: captainPlayer.id });
      }

      return newTeam;
    },
    [userProfile, updateUserProfile]
  );

  const saveTeam = useCallback(async (team: Team) => {
    await StorageService.saveTeam(team);
    const updated = await StorageService.getTeams();
    setTeams(updated);
  }, []);

  // Complete Match Manually or Automatically
  const completeMatchManually = useCallback(
    async (matchId: string, customResult?: string) => {
      const match = await StorageService.getMatchById(matchId);
      if (!match) return;

      const evalResult = customResult || CricketEngine.evaluateMatchResult(match) || 'Match Concluded';
      const updatedMatch: Match = {
        ...match,
        status: 'completed',
        result: evalResult,
        lastUpdated: Date.now(),
      };

      await StorageService.saveMatch(updatedMatch);
      const allMatches = await StorageService.getMatches();
      setMatches(allMatches);
      if (activeMatch?.id === matchId) {
        setActiveMatch(updatedMatch);
      }

      // Automatically trigger career stats rollup!
      const updatedTeams = await applyCareerStatsRollup(allMatches, teams);
      setTeams(updatedTeams);
    },
    [activeMatch, applyCareerStatsRollup, teams]
  );

  // Update Match Status (e.g. delayed, abandoned, tied, live)
  const updateMatchStatus = useCallback(
    async (matchId: string, status: MatchStatus, resultOrNotes?: string) => {
      const match = await StorageService.getMatchById(matchId);
      if (!match) return;

      const updatedMatch: Match = {
        ...match,
        status,
        result: resultOrNotes !== undefined ? resultOrNotes : match.result,
        lastUpdated: Date.now(),
      };

      await StorageService.saveMatch(updatedMatch);
      const allMatches = await StorageService.getMatches();
      setMatches(allMatches);
      if (activeMatch?.id === matchId) {
        setActiveMatch(updatedMatch);
      }

      if (status === 'completed' || status === 'tied' || status === 'abandoned') {
        const updatedTeams = await applyCareerStatsRollup(allMatches, teams);
        setTeams(updatedTeams);
      }
    },
    [activeMatch, applyCareerStatsRollup, teams]
  );

  // Ball-by-ball scoring with automatic result & rollup trigger
  const recordDelivery = useCallback(
    async (input: BallInput) => {
      if (!activeMatch) return;

      const inningsIndex = activeMatch.currentInningsIndex;
      const currentInnings = activeMatch.innings[inningsIndex];
      if (!currentInnings || currentInnings.isCompleted) return;

      const strikerId = currentInnings.currentStrikerId;
      const nonStrikerId = currentInnings.currentNonStrikerId;
      const bowlerId = currentInnings.currentBowlerId;

      if (!strikerId || !nonStrikerId || !bowlerId) {
        throw new Error('Please select both batters and a bowler before scoring.');
      }

      const isLegalDelivery = input.extraType !== 'wide' && input.extraType !== 'noBall';
      const deliveryIndexInMatch = (currentInnings.deliveries?.length || 0) + 1;
      const overIndex = Math.floor(currentInnings.legalBallsBowled / 6);
      const ballInOver = (currentInnings.legalBallsBowled % 6) + (isLegalDelivery ? 1 : 0);

      const newDelivery: Delivery = {
        id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ballNumberInMatch: deliveryIndexInMatch,
        overIndex,
        ballInOver,
        isLegalDelivery,
        strikerId,
        nonStrikerId,
        bowlerId,
        runsBat: input.runsBat,
        runsExtra: input.runsExtra,
        extraType: input.extraType,
        extrasDetail: input.extrasDetail,
        physicalRunsRan: input.physicalRunsRan,
        isBoundary: input.isBoundary,
        isSix: input.isSix,
        isWicket: input.isWicket,
        wicketDetails: input.isWicket
          ? {
              dismissalType: input.dismissalType || 'bowled',
              playerDismissedId: input.dismissedPlayerId || strikerId,
              bowlerId,
              fielderId: input.fielderId,
            }
          : undefined,
        commentary: input.commentary || '',
        shotArea: input.shotArea,
        pitchLength: input.pitchLength,
        pitchLine: input.pitchLine,
        pitchCoord: input.pitchCoord,
        pitchProvenance: input.pitchProvenance || (input.pitchCoord ? 'observed' : undefined),
        bowlingSide: input.bowlingSide,
        timestamp: Date.now(),
      };

      if (!newDelivery.commentary) {
        newDelivery.commentary = CricketEngine.generateDeliveryCommentary(newDelivery);
      }

      // Apply delivery
      const updatedInnings = CricketEngine.applyDelivery(
        currentInnings,
        newDelivery,
        activeMatch.rules,
        activeMatch.targetRuns
      );

      const updatedInningsArray: [Innings, Innings?] = [...activeMatch.innings];
      updatedInningsArray[inningsIndex] = updatedInnings;

      let matchStatus = activeMatch.status;
      let matchResult = activeMatch.result;

      // Check if this delivery ended the match or innings
      if (inningsIndex === 1 && updatedInnings.isCompleted) {
        matchStatus = 'completed';
        matchResult = CricketEngine.evaluateMatchResult({
          ...activeMatch,
          innings: updatedInningsArray,
        });
      } else if (inningsIndex === 0 && updatedInnings.isCompleted) {
        matchStatus = 'innings_break';
      }

      const updatedMatch: Match = {
        ...activeMatch,
        innings: updatedInningsArray,
        status: matchStatus,
        result: matchResult,
        lastUpdated: Date.now(),
      };

      setActiveMatch(updatedMatch);
      await StorageService.saveMatch(updatedMatch);
      await refreshMatches();

      // If match completed, automatically roll up career statistics!
      if (matchStatus === 'completed') {
        const allMatches = await StorageService.getMatches();
        const rolledTeams = await applyCareerStatsRollup(allMatches, teams);
        setTeams(rolledTeams);
      }
    },
    [activeMatch, applyCareerStatsRollup, refreshMatches, teams]
  );

  // Explicit non-delivery batter retirement
  const retireBatter = useCallback(
    async (playerId: string, dismissalType: 'retired_hurt' | 'retired_out') => {
      if (!activeMatch) return;
      const innIndex = activeMatch.currentInningsIndex;
      const currentInnings = activeMatch.innings[innIndex];
      if (!currentInnings) return;

      const updatedInnings = CricketEngine.retireBatter(
        currentInnings,
        playerId,
        dismissalType,
        Date.now()
      );

      const updatedInningsArray: [Innings, Innings?] = [...activeMatch.innings];
      updatedInningsArray[innIndex] = updatedInnings;

      const updatedMatch: Match = {
        ...activeMatch,
        innings: updatedInningsArray,
        lastUpdated: Date.now(),
      };

      setActiveMatch(updatedMatch);
      await StorageService.saveMatch(updatedMatch);
      await refreshMatches();
    },
    [activeMatch, refreshMatches]
  );

  // Return batter to crease after retired hurt
  const returnBatter = useCallback(
    async (playerId: string, slot: 'striker' | 'nonStriker') => {
      if (!activeMatch) return;
      const innIndex = activeMatch.currentInningsIndex;
      const currentInnings = activeMatch.innings[innIndex];
      if (!currentInnings) return;

      const updatedInnings = CricketEngine.returnBatter(
        currentInnings,
        playerId,
        slot,
        Date.now()
      );

      const updatedInningsArray: [Innings, Innings?] = [...activeMatch.innings];
      updatedInningsArray[innIndex] = updatedInnings;

      const updatedMatch = { ...activeMatch, innings: updatedInningsArray, lastUpdated: Date.now() };
      setActiveMatch(updatedMatch);
      await StorageService.saveMatch(updatedMatch);
      await refreshMatches();
    },
    [activeMatch, refreshMatches]
  );

  // Undo delivery or last scoring action
  const undoDelivery = useCallback(async () => {
    if (!activeMatch) return;
    const innIndex = activeMatch.currentInningsIndex;
    const currentInnings = activeMatch.innings[innIndex];
    if (!currentInnings) return;

    let replayedInnings: Innings;
    if (currentInnings.actions && currentInnings.actions.length > 0) {
      const newActions = currentInnings.actions.slice(0, -1);
      replayedInnings = CricketEngine.replayInnings(
        activeMatch.innings[innIndex]!,
        newActions,
        activeMatch.rules,
        activeMatch.targetRuns
      );
    } else if (currentInnings.deliveries && currentInnings.deliveries.length > 0) {
      const newDeliveries = currentInnings.deliveries.slice(0, -1);
      replayedInnings = CricketEngine.replayInnings(
        activeMatch.innings[innIndex]!,
        newDeliveries,
        activeMatch.rules,
        activeMatch.targetRuns
      );
    } else {
      return;
    }

    const updatedInningsArray: [Innings, Innings?] = [...activeMatch.innings];
    updatedInningsArray[innIndex] = replayedInnings;

    const updatedMatch: Match = {
      ...activeMatch,
      status: 'live',
      result: undefined,
      innings: updatedInningsArray,
      lastUpdated: Date.now(),
    };

    setActiveMatch(updatedMatch);
    await StorageService.saveMatch(updatedMatch);
    await refreshMatches();
  }, [activeMatch, refreshMatches]);

  const selectBowler = useCallback(
    async (bowlerId: string) => {
      if (!activeMatch) return;
      const innIndex = activeMatch.currentInningsIndex;
      const currentInnings = activeMatch.innings[innIndex];
      if (!currentInnings) return;

      const actions = [...(currentInnings.actions || [])];
      actions.push({
        type: 'SELECT_BOWLER',
        bowlerId,
        timestamp: Date.now(),
      });

      const updatedInnings: Innings = {
        ...currentInnings,
        currentBowlerId: bowlerId,
        actions,
      };
      const updatedInningsArray: [Innings, Innings?] = [...activeMatch.innings];
      updatedInningsArray[innIndex] = updatedInnings;

      const updatedMatch = { ...activeMatch, innings: updatedInningsArray, lastUpdated: Date.now() };
      setActiveMatch(updatedMatch);
      await StorageService.saveMatch(updatedMatch);
    },
    [activeMatch]
  );

  const selectStriker = useCallback(
    async (strikerId: string) => {
      if (!activeMatch) return;
      const innIndex = activeMatch.currentInningsIndex;
      const currentInnings = activeMatch.innings[innIndex];
      if (!currentInnings) return;

      const updatedBatterStats = { ...currentInnings.batterStats };
      if (!updatedBatterStats[strikerId]) {
        updatedBatterStats[strikerId] = {
          playerId: strikerId,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          isOut: false,
          battingOrder: Object.keys(updatedBatterStats).length + 1,
        };
      } else {
        updatedBatterStats[strikerId] = {
          ...updatedBatterStats[strikerId],
          isOut: false,
          dismissalText: undefined,
        };
      }

      const actions = [...(currentInnings.actions || [])];
      actions.push({
        type: 'SELECT_BATTER',
        playerId: strikerId,
        slot: 'striker',
        timestamp: Date.now(),
      });

      const updatedInnings: Innings = {
        ...currentInnings,
        batterStats: updatedBatterStats,
        currentStrikerId: strikerId,
        // Prevent duplicate batsman occupying both crease ends
        currentNonStrikerId:
          currentInnings.currentNonStrikerId === strikerId
            ? undefined
            : currentInnings.currentNonStrikerId,
        actions,
      };
      const updatedInningsArray: [Innings, Innings?] = [...activeMatch.innings];
      updatedInningsArray[innIndex] = updatedInnings;

      const updatedMatch = { ...activeMatch, innings: updatedInningsArray, lastUpdated: Date.now() };
      setActiveMatch(updatedMatch);
      await StorageService.saveMatch(updatedMatch);
    },
    [activeMatch]
  );

  const selectNonStriker = useCallback(
    async (nonStrikerId: string) => {
      if (!activeMatch) return;
      const innIndex = activeMatch.currentInningsIndex;
      const currentInnings = activeMatch.innings[innIndex];
      if (!currentInnings) return;

      const updatedBatterStats = { ...currentInnings.batterStats };
      if (!updatedBatterStats[nonStrikerId]) {
        updatedBatterStats[nonStrikerId] = {
          playerId: nonStrikerId,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          isOut: false,
          battingOrder: Object.keys(updatedBatterStats).length + 1,
        };
      } else {
        updatedBatterStats[nonStrikerId] = {
          ...updatedBatterStats[nonStrikerId],
          isOut: false,
          dismissalText: undefined,
        };
      }

      const actions = [...(currentInnings.actions || [])];
      actions.push({
        type: 'SELECT_BATTER',
        playerId: nonStrikerId,
        slot: 'nonStriker',
        timestamp: Date.now(),
      });

      const updatedInnings: Innings = {
        ...currentInnings,
        batterStats: updatedBatterStats,
        currentNonStrikerId: nonStrikerId,
        // Prevent duplicate batsman occupying both crease ends
        currentStrikerId:
          currentInnings.currentStrikerId === nonStrikerId
            ? undefined
            : currentInnings.currentStrikerId,
        actions,
      };
      const updatedInningsArray: [Innings, Innings?] = [...activeMatch.innings];
      updatedInningsArray[innIndex] = updatedInnings;

      const updatedMatch = { ...activeMatch, innings: updatedInningsArray, lastUpdated: Date.now() };
      setActiveMatch(updatedMatch);
      await StorageService.saveMatch(updatedMatch);
    },
    [activeMatch]
  );

  // Manual swap strike button
  const swapStrikerNonStriker = useCallback(async () => {
    if (!activeMatch) return;
    const innIndex = activeMatch.currentInningsIndex;
    const currentInnings = activeMatch.innings[innIndex];
    if (!currentInnings) return;

    const actions = [...(currentInnings.actions || [])];
    actions.push({
      type: 'SWAP_ENDS',
      timestamp: Date.now(),
    });

    const temp = currentInnings.currentStrikerId;
    const updatedInnings: Innings = {
      ...currentInnings,
      currentStrikerId: currentInnings.currentNonStrikerId,
      currentNonStrikerId: temp,
      actions,
    };

    const updatedInningsArray: [Innings, Innings?] = [...activeMatch.innings];
    updatedInningsArray[innIndex] = updatedInnings;

    const updatedMatch = { ...activeMatch, innings: updatedInningsArray, lastUpdated: Date.now() };
    setActiveMatch(updatedMatch);
    await StorageService.saveMatch(updatedMatch);
  }, [activeMatch]);

  const startSecondInnings = useCallback(
    async (strikerId: string, nonStrikerId: string, bowlerId: string) => {
      if (!activeMatch) return;
      const inn1 = activeMatch.innings[0];
      if (!inn1) return;

      const targetRuns = inn1.totalRuns + 1;
      const battingTeamId = inn1.bowlingTeamId;
      const bowlingTeamId = inn1.battingTeamId;

      const inn2 = createInitialInnings(
        2,
        battingTeamId,
        bowlingTeamId,
        strikerId,
        nonStrikerId,
        bowlerId
      );

      const updatedMatch: Match = {
        ...activeMatch,
        innings: [inn1, inn2],
        currentInningsIndex: 1,
        targetRuns,
        status: 'live',
        lastUpdated: Date.now(),
      };

      setActiveMatch(updatedMatch);
      await StorageService.saveMatch(updatedMatch);
      await refreshMatches();
    },
    [activeMatch, refreshMatches]
  );

  // Create New Match organized by user
  const createNewMatch = useCallback(
    async (params: CreateMatchParams): Promise<Match> => {
      const {
        title,
        format,
        venue,
        team1,
        team2,
        tossWinnerId,
        tossDecision,
        totalOvers,
        strikerId,
        nonStrikerId,
        openingBowlerId,
        ballType = 'leather',
        scorerName,
        organizerName,
      } = params;

      if (userProfile && (!userProfile.isVerified || userProfile.isGuest)) {
        throw new Error('Please verify your phone number to organize tournaments and matches.');
      }

      const team1BattingFirst =
        (tossWinnerId === team1.id && tossDecision === 'bat') ||
        (tossWinnerId === team2.id && tossDecision === 'bowl');

      const battingTeamId = team1BattingFirst ? team1.id : team2.id;
      const bowlingTeamId = team1BattingFirst ? team2.id : team1.id;

      const inn1 = createInitialInnings(
        1,
        battingTeamId,
        bowlingTeamId,
        strikerId,
        nonStrikerId,
        openingBowlerId
      );

      const newMatch: Match = {
        id: `match_${Date.now()}`,
        title,
        format,
        venue,
        date: new Date().toISOString().split('T')[0],
        status: 'live',
        team1,
        team2,
        playingXITeam1: team1.players.map((p) => p.id),
        playingXITeam2: team2.players.map((p) => p.id),
        tossWinnerId,
        tossDecision,
        ballType,
        scorerName: scorerName || userProfile?.name || 'Assigned Scorer',
        organizerName: organizerName || userProfile?.name || 'Match Organizer',
        organizerUserId: userProfile?.id,
        tournamentId: params.tournamentId,
        rules: {
          totalOvers,
          playersPerTeam: Math.max(team1.players.length, team2.players.length, 11),
          wideValue: 1,
          noBallValue: 1,
          freeHitOnNoBall: true,
        },
        innings: [inn1],
        currentInningsIndex: 0,
        isSynced: false,
        lastUpdated: Date.now(),
      };

      await StorageService.saveMatch(newMatch);
      await refreshMatches();
      setActiveMatch(newMatch);

      // If tied to a tournament, update the tournament
      if (params.tournamentId) {
        const tourn = await StorageService.getTournamentById(params.tournamentId);
        if (tourn) {
          tourn.matches.push(newMatch);
          tourn.status = 'active';
          await StorageService.saveTournament(tourn);
          const allTourns = await StorageService.getTournaments();
          setTournaments(allTourns);
        }
      }

      return newMatch;
    },
    [refreshMatches, userProfile]
  );

  const exportMatch = useCallback(async (matchId: string): Promise<string> => {
    const match = await StorageService.getMatchById(matchId);
    if (!match) throw new Error('Match not found');
    return StorageService.exportMatchJSON(match);
  }, []);

  const importMatch = useCallback(
    async (jsonString: string): Promise<Match> => {
      const match = StorageService.importMatchJSON(jsonString);
      await StorageService.saveMatch(match);
      await refreshMatches();
      return match;
    },
    [refreshMatches]
  );

  const deleteMatch = useCallback(
    async (matchId: string) => {
      await StorageService.deleteMatch(matchId);
      if (activeMatch?.id === matchId) {
        setActiveMatch(null);
      }
      await refreshMatches();
    },
    [activeMatch, refreshMatches]
  );

  // Tournaments
  const refreshTournaments = useCallback(async () => {
    const loaded = await StorageService.getTournaments();
    setTournaments(loaded);
  }, []);

  const createTournament = useCallback(
    async (params: {
      name: string;
      format: MatchFormat;
      totalOvers: number;
      ballType: BallType;
      teams?: Team[];
    }): Promise<Tournament> => {
      if (userProfile && (!userProfile.isVerified || userProfile.isGuest)) {
        throw new Error('Please verify your phone number to organize tournaments and matches.');
      }

      const newTournament: Tournament = {
        id: `tourn_${Date.now()}`,
        name: params.name,
        format: params.format,
        totalOvers: params.totalOvers,
        ballType: params.ballType,
        creatorUserId: userProfile?.id || 'verified_user',
        creatorName: userProfile?.name || 'Tournament Organizer',
        teams: params.teams || [],
        matches: [],
        status: 'upcoming',
        createdAt: Date.now(),
      };

      await StorageService.saveTournament(newTournament);
      await refreshTournaments();
      return newTournament;
    },
    [refreshTournaments, userProfile]
  );

  const addTeamToTournament = useCallback(
    async (tournamentId: string, team: Team) => {
      const tourn = await StorageService.getTournamentById(tournamentId);
      if (!tourn) return;
      if (!tourn.teams.some((t) => t.id === team.id)) {
        tourn.teams.push(team);
        await StorageService.saveTournament(tourn);
        await refreshTournaments();
      }
    },
    [refreshTournaments]
  );

  const addMatchToTournament = useCallback(
    async (tournamentId: string, match: Match) => {
      const tourn = await StorageService.getTournamentById(tournamentId);
      if (!tourn) return;
      match.tournamentId = tournamentId;
      const idx = tourn.matches.findIndex((m) => m.id === match.id);
      if (idx >= 0) {
        tourn.matches[idx] = match;
      } else {
        tourn.matches.push(match);
      }
      tourn.status = 'active';
      await StorageService.saveTournament(tourn);
      await refreshTournaments();
    },
    [refreshTournaments]
  );

  const getTournamentById = useCallback(
    (tournamentId: string): Tournament | undefined => {
      return tournaments.find((t) => t.id === tournamentId);
    },
    [tournaments]
  );

  const deleteTournament = useCallback(
    async (tournamentId: string) => {
      await StorageService.deleteTournament(tournamentId);
      await refreshTournaments();
    },
    [refreshTournaments]
  );

  // Ghost Accounts
  const addGhostPlayerToTeam = useCallback(
    async (teamId: string, name: string, phone: string, role?: PlayingRole): Promise<Player> => {
      const teamsList = await StorageService.getTeams();
      const targetTeam = teamsList.find((t) => t.id === teamId);
      if (!targetTeam) throw new Error('Team not found');

      const ghostPlayer: Player = {
        id: `ghost_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        role: role || 'all-rounder',
        battingHand: 'right',
        phoneNumber: phone.trim(),
        isGuest: true,
        isVerified: false,
        teamId,
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
      };

      targetTeam.players.push(ghostPlayer);
      await StorageService.saveTeam(targetTeam);
      const updatedTeams = await StorageService.getTeams();
      setTeams(updatedTeams);
      return ghostPlayer;
    },
    []
  );

  const claimGhostProfile = useCallback(
    async (phone: string): Promise<{ claimedCount: number; firstClaimedPlayerId?: string }> => {
      if (!userProfile) return { claimedCount: 0 };
      const { claimedCount, updatedTeams, firstClaimedPlayerId } = await StorageService.claimGhostPlayersByPhone(
        phone,
        userProfile.id,
        userProfile.name
      );
      if (claimedCount > 0) {
        setTeams(updatedTeams);
        const matchesList = await StorageService.getMatches();
        const rolled = await applyCareerStatsRollup(matchesList, updatedTeams);
        setTeams(rolled);
        await refreshTournaments();
        if (firstClaimedPlayerId && (!userProfile.claimedPlayerId || userProfile.claimedPlayerId.startsWith('p_user_'))) {
          await updateUserProfile({ claimedPlayerId: firstClaimedPlayerId });
        }
      }
      return { claimedCount, firstClaimedPlayerId };
    },
    [applyCareerStatsRollup, refreshTournaments, updateUserProfile, userProfile]
  );

  return (
    <CricketContext.Provider
      value={{
        matches,
        teams,
        tournaments,
        userProfile,
        presetUsers: PRESET_USERS,
        joinRequests,
        activeMatch,
        loading,
        isOffline,
        switchUser,
        updateUserProfile,
        getPlayerById,
        updatePlayer,
        sendJoinRequest,
        approveJoinRequest,
        declineJoinRequest,
        saveTeam,
        createNewTeam,
        addGhostPlayerToTeam,
        claimGhostProfile,
        loadMatchById,
        setActiveMatch,
        recordDelivery,
        undoDelivery,
        retireBatter,
        returnBatter,
        selectBowler,
        selectStriker,
        selectNonStriker,
        swapStrikerNonStriker,
        startSecondInnings,
        completeMatchManually,
        updateMatchStatus,
        createNewMatch,
        exportMatch,
        importMatch,
        deleteMatch,
        refreshMatches,
        createTournament,
        addTeamToTournament,
        addMatchToTournament,
        getTournamentById,
        deleteTournament,
        refreshTournaments,
      }}
    >
      {children}
    </CricketContext.Provider>
  );
};

export const useCricket = (): CricketContextType => {
  const context = useContext(CricketContext);
  if (!context) {
    throw new Error('useCricket must be used within a CricketProvider');
  }
  return context;
};
