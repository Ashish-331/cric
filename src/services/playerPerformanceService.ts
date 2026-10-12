import type { Match, Player, Innings } from '../types/cricket';

export interface PlayerLiveFigure {
  matchId: string;
  matchTitle: string;
  venue: string;
  sportingStatus: string;
  battingTeamName: string;
  bowlingTeamName: string;
  totalTeamScore: string;
  lastUpdated: number;
  isCloudSynced: boolean;
  isProvisional: boolean;
  isDelayed: boolean;

  // Batting figures
  batting?: {
    runs: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    strikeRate: number;
    isOut: boolean;
    dismissalText?: string;
    isOnStrike: boolean;
    isNonStriker: boolean;
  };

  // Bowling figures
  bowling?: {
    oversFormatted: string;
    legalBalls: number;
    maidens: number;
    runsConceded: number;
    wickets: number;
    economy: number;
    isCurrentBowler: boolean;
  };
}

export class PlayerPerformanceService {
  /**
   * Resolves a player's live active figures across all ongoing matches.
   * Enables Player P to open their phone and see their exact real-time contribution.
   */
  static getLiveFiguresForPlayer(
    playerId: string,
    matches: Match[],
    currentTime: number = Date.now()
  ): PlayerLiveFigure | null {
    if (!playerId || !matches || matches.length === 0) return null;

    // Find active or recent live match where this player participates
    const liveMatches = matches.filter(
      (m) => m.status === 'live' || m.status === 'innings_break'
    );

    for (const match of liveMatches) {
      const innIndex = match.currentInningsIndex;
      const currentInnings: Innings | undefined = match.innings[innIndex];
      if (!currentInnings) continue;

      const team1BattingFirst =
        (match.tossWinnerId === match.team1.id && match.tossDecision === 'bat') ||
        (match.tossWinnerId === match.team2.id && match.tossDecision === 'bowl');

      const currentBattingTeam =
        innIndex === 0
          ? team1BattingFirst ? match.team1 : match.team2
          : team1BattingFirst ? match.team2 : match.team1;

      const currentBowlingTeam =
        innIndex === 0
          ? team1BattingFirst ? match.team2 : match.team1
          : team1BattingFirst ? match.team1 : match.team2;

      const isParticipant =
        match.team1.players.some((p) => p.id === playerId) ||
        match.team2.players.some((p) => p.id === playerId) ||
        Boolean(currentInnings.batterStats[playerId]) ||
        Boolean(currentInnings.bowlerStats[playerId]);

      if (!isParticipant) continue;

      const batterStats = currentInnings.batterStats[playerId];
      const bowlerStats = currentInnings.bowlerStats[playerId];

      const isOnStrike = currentInnings.currentStrikerId === playerId;
      const isNonStriker = currentInnings.currentNonStrikerId === playerId;
      const isCurrentBowler = currentInnings.currentBowlerId === playerId;

      // An offline delay is noted if match hasn't received cloud updates in over 120 seconds
      const isDelayed = currentTime - (match.lastUpdated || 0) > 120000;

      let battingDetails = undefined;
      if (batterStats || isOnStrike || isNonStriker) {
        battingDetails = {
          runs: batterStats?.runs || 0,
          ballsFaced: batterStats?.ballsFaced || 0,
          fours: batterStats?.fours || 0,
          sixes: batterStats?.sixes || 0,
          strikeRate: batterStats?.strikeRate || 0,
          isOut: Boolean(batterStats?.isOut),
          dismissalText: batterStats?.dismissalText,
          isOnStrike,
          isNonStriker,
        };
      }

      let bowlingDetails = undefined;
      if (bowlerStats || isCurrentBowler) {
        bowlingDetails = {
          oversFormatted: bowlerStats?.oversFormatted || '0.0',
          legalBalls: bowlerStats?.legalBalls || 0,
          maidens: bowlerStats?.maidens || 0,
          runsConceded: bowlerStats?.runsConceded || 0,
          wickets: bowlerStats?.wickets || 0,
          economy: bowlerStats?.economy || 0,
          isCurrentBowler,
        };
      }

      return {
        matchId: match.id,
        matchTitle: match.title,
        venue: match.venue,
        sportingStatus: match.status,
        battingTeamName: currentBattingTeam.name,
        bowlingTeamName: currentBowlingTeam.name,
        totalTeamScore: `${currentInnings.totalRuns}/${currentInnings.totalWickets} (${currentInnings.oversFormatted} ov)`,
        lastUpdated: match.lastUpdated || currentTime,
        isCloudSynced: match.isSynced,
        isProvisional: match.status !== 'completed',
        isDelayed,
        batting: battingDetails,
        bowling: bowlingDetails,
      };
    }

    return null;
  }

  /**
   * Filters matches based on canonical user relationship:
   * - 'your': owned/managed/created/scored by user
   * - 'played': user actively participated in lineups or figures
   * - 'network': matches belonging to registered teams, clubs, or tournaments user belongs to
   * - 'all': all accessible public matches
   */
  static getFilteredMatchesForUser(
    userId: string,
    filterType: 'your' | 'played' | 'network' | 'all',
    matches: Match[],
    teams: any[] = [],
    tournaments: any[] = []
  ): Match[] {
    if (!matches || matches.length === 0) return [];
    if (!userId && filterType !== 'all') return [];

    // User's associated team IDs
    const userTeamIds = new Set<string>();
    for (const t of teams) {
      if (
        t.captainPlayerId === userId ||
        t.createdByUserId === userId ||
        t.players?.some((p: any) => p.id === userId || p.claimedByUserId === userId)
      ) {
        userTeamIds.add(t.id);
      }
    }

    // User's associated tournament IDs
    const userTournamentIds = new Set<string>();
    for (const tr of tournaments) {
      if (
        tr.creatorUserId === userId ||
        tr.teams?.some((t: any) => userTeamIds.has(t.id))
      ) {
        userTournamentIds.add(tr.id);
      }
    }

    return matches.filter((m) => {
      if (filterType === 'all') {
        return true;
      }

      if (filterType === 'your') {
        const isOrganizer = m.organizerUserId === userId;
        const isScorer = m.scorerPlayerId === userId || m.scorerName?.toLowerCase().includes(userId.toLowerCase());
        const isTeamManager = userTeamIds.has(m.team1.id) || userTeamIds.has(m.team2.id);
        return isOrganizer || isScorer || isTeamManager;
      }

      if (filterType === 'played') {
        const inTeam1Lineup = m.team1.players?.some((p: any) => p.id === userId || p.claimedByUserId === userId);
        const inTeam2Lineup = m.team2.players?.some((p: any) => p.id === userId || p.claimedByUserId === userId);
        const battedOrBowled = m.innings?.some((inn) => {
          return Boolean(inn?.batterStats?.[userId]) || Boolean(inn?.bowlerStats?.[userId]);
        });
        return inTeam1Lineup || inTeam2Lineup || battedOrBowled;
      }

      if (filterType === 'network') {
        const inUserTeam = userTeamIds.has(m.team1.id) || userTeamIds.has(m.team2.id);
        const inUserTournament = m.tournamentId ? userTournamentIds.has(m.tournamentId) : false;
        return inUserTeam || inUserTournament;
      }

      return true;
    });
  }
}

