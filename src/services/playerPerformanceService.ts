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
   * Checks whether an account has an approved, canonical relationship to a match:
   * 1. Match organizer/creator
   * 2. Assigned or active scorer (exact account ID match)
   * 3. Playing lineup participant or player in match statistics
   * 4. Manager, captain, or squad member of a participating team
   * 5. Tournament organizer or approved participant
   * 6. Match is explicitly flagged as public broadcast (and not an untouched demo)
   */
  static isAccountAuthorizedForMatch(
    userId: string,
    match: Match,
    teams: any[] = [],
    tournaments: any[] = [],
    linkedPlayerIds: string[] = []
  ): boolean {
    if (!match) return false;

    // Reject untouched demo fixtures (sample_match_1) unless user is explicitly the creator
    const isUntouchedDemoSeed =
      match.id === 'sample_match_1' && (match.title === 'Wankhede Derby 2026' || match.isDemo);

    if (isUntouchedDemoSeed && match.organizerUserId !== userId) {
      return false;
    }

    if (match.isPublicBroadcast && !isUntouchedDemoSeed) {
      return true;
    }

    if (!userId) return false;

    // 1. Organizer or Creator
    if (match.organizerUserId === userId || (match as any).createdByUserId === userId) {
      return true;
    }

    // 2. Assigned or Active Scorer (explicit ID match, never substring)
    if (
      match.assignedScorerAccountId === userId ||
      (match as any).activeScorerAccountId === userId ||
      match.scorerPlayerId === userId
    ) {
      return true;
    }

    const linkedSet = new Set<string>(linkedPlayerIds);
    linkedSet.add(userId);

    // 3. Lineup participant or batter/bowler figures
    const isLineupPlayer = (p: any) =>
      Boolean(p && (linkedSet.has(p.id) || (p.claimedByUserId && p.claimedByUserId === userId)));

    if (
      match.team1?.players?.some(isLineupPlayer) ||
      match.team2?.players?.some(isLineupPlayer)
    ) {
      return true;
    }

    const inInningsStats = match.innings?.some((inn) => {
      if (!inn) return false;
      for (const id of linkedSet) {
        if (inn.batterStats?.[id] || inn.bowlerStats?.[id]) {
          return true;
        }
      }
      return false;
    });
    if (inInningsStats) return true;

    // 4. Team relationship (Captain, Manager, Creator, or Member)
    const matchTeamIds = new Set<string>([match.team1?.id, match.team2?.id].filter(Boolean));
    const isUserAffiliatedTeam = (t: any) => {
      if (!t || !matchTeamIds.has(t.id)) return false;
      if (t.captainPlayerId && linkedSet.has(t.captainPlayerId)) return true;
      if (t.managerUserId === userId) return true;
      if (t.createdByUserId === userId) return true;
      if (t.players?.some(isLineupPlayer)) return true;
      return false;
    };

    if (isUserAffiliatedTeam(match.team1) || isUserAffiliatedTeam(match.team2)) {
      return true;
    }

    for (const t of teams) {
      if (isUserAffiliatedTeam(t)) {
        return true;
      }
    }

    // 5. Tournament relationship
    if (match.tournamentId) {
      for (const tr of tournaments) {
        if (tr.id === match.tournamentId) {
          if (tr.creatorUserId === userId || tr.organizerUserId === userId) {
            return true;
          }
          if (tr.teams?.some((t: any) => isUserAffiliatedTeam(t))) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Filters matches based on canonical user relationship:
   * - 'your': owned/managed/created/scored by user
   * - 'played': user actively participated in lineups or figures
   * - 'network': matches belonging to registered teams, clubs, or tournaments user belongs to
   * - 'all': all authorized matches for this user (never unscoped global leak)
   */
  static getFilteredMatchesForUser(
    userId: string,
    filterType: 'your' | 'played' | 'network' | 'all',
    matches: Match[],
    teams: any[] = [],
    tournaments: any[] = [],
    linkedPlayerIds: string[] = []
  ): Match[] {
    if (!matches || matches.length === 0) return [];
    if (!userId) return [];

    const linkedSet = new Set<string>(linkedPlayerIds);
    linkedSet.add(userId);

    // Filter to authorized matches first (privacy & scope enforcement)
    const authorized = matches.filter((m) =>
      PlayerPerformanceService.isAccountAuthorizedForMatch(
        userId,
        m,
        teams,
        tournaments,
        linkedPlayerIds
      )
    );

    if (filterType === 'all') {
      return authorized;
    }

    const isLineupPlayer = (p: any) =>
      Boolean(p && (linkedSet.has(p.id) || (p.claimedByUserId && p.claimedByUserId === userId)));

    const isTeamManagerOrCaptain = (t: any) => {
      if (!t) return false;
      return (
        (t.captainPlayerId && linkedSet.has(t.captainPlayerId)) ||
        t.managerUserId === userId ||
        t.createdByUserId === userId
      );
    };

    return authorized.filter((m) => {
      if (filterType === 'your') {
        const isOrganizer =
          m.organizerUserId === userId || (m as any).createdByUserId === userId;
        const isScorer =
          m.assignedScorerAccountId === userId ||
          (m as any).activeScorerAccountId === userId ||
          m.scorerPlayerId === userId;
        const isManager =
          isTeamManagerOrCaptain(m.team1) ||
          isTeamManagerOrCaptain(m.team2) ||
          teams.some((t) => (t.id === m.team1?.id || t.id === m.team2?.id) && isTeamManagerOrCaptain(t));
        return isOrganizer || isScorer || isManager;
      }

      if (filterType === 'played') {
        const inLineup =
          m.team1?.players?.some(isLineupPlayer) ||
          m.team2?.players?.some(isLineupPlayer);
        const inStats = m.innings?.some((inn) => {
          if (!inn) return false;
          for (const id of linkedSet) {
            if (inn.batterStats?.[id] || inn.bowlerStats?.[id]) return true;
          }
          return false;
        });
        return inLineup || inStats;
      }

      if (filterType === 'network') {
        // Matches involving user's teams or tournaments
        const userTeamIds = new Set<string>();
        for (const t of teams) {
          if (
            isTeamManagerOrCaptain(t) ||
            t.players?.some(isLineupPlayer)
          ) {
            userTeamIds.add(t.id);
          }
        }
        if (isTeamManagerOrCaptain(m.team1) || m.team1?.players?.some(isLineupPlayer)) {
          userTeamIds.add(m.team1.id);
        }
        if (isTeamManagerOrCaptain(m.team2) || m.team2?.players?.some(isLineupPlayer)) {
          userTeamIds.add(m.team2.id);
        }

        const inUserTeam =
          userTeamIds.has(m.team1?.id) || userTeamIds.has(m.team2?.id);

        let inUserTournament = false;
        if (m.tournamentId) {
          inUserTournament = tournaments.some(
            (tr) =>
              tr.id === m.tournamentId &&
              (tr.creatorUserId === userId ||
                tr.organizerUserId === userId ||
                tr.teams?.some((t: any) => userTeamIds.has(t.id)))
          );
        }
        return inUserTeam || inUserTournament;
      }

      return true;
    });
  }
}

