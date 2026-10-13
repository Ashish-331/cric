import test from 'node:test';
import assert from 'node:assert/strict';
import { StorageService, type UserProfile } from '../src/storage/storageService';
import { DEFAULT_TEAMS } from '../src/storage/defaultData';
import { CricketEngine, createInitialInnings } from '../src/engine/cricketEngine';
import { StatsRollupEngine } from '../src/engine/statsRollupEngine';
import type { Team, Match, Delivery, MatchRules, Player } from '../src/types/cricket';

const RULES_20_OVERS: MatchRules = {
  totalOvers: 20,
  maxOversPerBowler: 4,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('End-to-End User Journeys 1 through 6 Complete Simulation', async () => {
  // =========================================================================
  // JOURNEY 1: Player Profile Creation
  // =========================================================================
  const playerProfile: UserProfile = {
    id: 'user_shreyas',
    name: 'Shreyas Iyer',
    phoneNumber: '+91 99887 76655',
    isGuest: false,
    isVerified: true,
    role: 'captain',
    playingRole: 'batter',
    battingHand: 'right',
    bowlingStyle: 'spin-off',
    claimedPlayerId: 'p_shreyas_1',
  };

  await StorageService.saveUserProfile(playerProfile);
  const loadedProfile = await StorageService.getUserProfile();

  assert.equal(loadedProfile.id, 'user_shreyas');
  assert.equal(loadedProfile.name, 'Shreyas Iyer');
  assert.equal(loadedProfile.playingRole, 'batter');
  assert.equal(loadedProfile.battingHand, 'right');
  assert.equal(loadedProfile.bowlingStyle, 'spin-off');
  assert.equal(loadedProfile.isVerified, true);

  // =========================================================================
  // JOURNEY 2: Captain registers a new team and becomes Captain/Admin
  // =========================================================================
  const captainPlayer: Player = {
    id: loadedProfile.claimedPlayerId || 'p_shreyas_1',
    name: loadedProfile.name,
    role: loadedProfile.playingRole || 'batter',
    battingHand: loadedProfile.battingHand || 'right',
    bowlingStyle: loadedProfile.bowlingStyle || 'spin-off',
    phoneNumber: loadedProfile.phoneNumber,
    isCaptain: true,
    isVerified: true,
    careerStats: StatsRollupEngine.createEmptyCareerStats(),
    recentScores: [],
  };

  const newTeam: Team = {
    id: 'team_kolkata',
    name: 'Kolkata Knights',
    shortName: 'KKR',
    primaryColor: '#7C3AED',
    captainPlayerId: captainPlayer.id,
    createdByUserId: loadedProfile.id,
    players: [captainPlayer],
  };

  await StorageService.saveTeam(newTeam);
  const allTeamsAfterCreation = await StorageService.getTeams();
  const foundTeam = allTeamsAfterCreation.find((t) => t.id === 'team_kolkata');

  assert.ok(foundTeam, 'Team Kolkata Knights registered');
  assert.equal(foundTeam!.name, 'Kolkata Knights');
  assert.equal(foundTeam!.captainPlayerId, 'p_shreyas_1');
  assert.equal(foundTeam!.players.length, 1);
  assert.equal(foundTeam!.players[0].name, 'Shreyas Iyer');
  assert.equal(foundTeam!.players[0].isCaptain, true);

  // =========================================================================
  // JOURNEY 3: Another Player requests to join -> Captain Approves -> Player added to active roster
  // =========================================================================
  const recruitUser: UserProfile = {
    id: 'user_rinku',
    name: 'Rinku Singh',
    phoneNumber: '+91 98888 11111',
    isGuest: false,
    isVerified: true,
    role: 'player',
    playingRole: 'batter',
    battingHand: 'left',
    claimedPlayerId: 'p_rinku_55',
  };

  // Recruit sends join request to Kolkata Knights
  const joinReq = {
    id: 'req_rinku_kkr',
    teamId: 'team_kolkata',
    playerId: recruitUser.claimedPlayerId!,
    playerName: recruitUser.name,
    playerRole: recruitUser.playingRole!,
    playerPhone: recruitUser.phoneNumber,
    status: 'pending' as const,
    requestedAt: Date.now(),
  };

  await StorageService.addJoinRequest(joinReq);
  const pendingRequests = await StorageService.getJoinRequests();
  const kkrPending = pendingRequests.filter(
    (r) => r.teamId === 'team_kolkata' && r.status === 'pending'
  );

  assert.equal(kkrPending.length, 1, 'Captain sees pending join request');
  assert.equal(kkrPending[0].playerName, 'Rinku Singh');

  // Captain Approves the join request atomically
  const approvalResult = await StorageService.approveJoinRequestAtomic('req_rinku_kkr');
  assert.equal(approvalResult.updatedRequest?.status, 'approved');

  // Verify Rinku is now in active squad roster
  const updatedKKR = approvalResult.allTeams.find((t) => t.id === 'team_kolkata')!;
  assert.ok(updatedKKR);
  assert.equal(updatedKKR.players.length, 2);
  const rinkuInTeam = updatedKKR.players.find((p) => p.id === 'p_rinku_55')!;
  assert.ok(rinkuInTeam, 'Rinku Singh is now in the active roster!');
  assert.equal(rinkuInTeam.name, 'Rinku Singh');
  assert.equal(rinkuInTeam.role, 'batter');
  assert.equal(rinkuInTeam.careerStats?.matches, 0);

  // =========================================================================
  // JOURNEY 4: Organizer creates Match between 2 registered teams
  // =========================================================================
  // Opposition team: Royal Challengers (save to storage for match creation)
  await StorageService.saveTeam(DEFAULT_TEAMS[1]);
  const allTeams = await StorageService.getTeams();
  const rcbTeam = allTeams.find((t) => t.id === 'team_bangalore') || allTeams[1];

  const inn1Start = createInitialInnings(
    1,
    updatedKKR.id,
    rcbTeam.id,
    'p_shreyas_1', // Striker: Shreyas Iyer
    'p_rinku_55',  // Non-Striker: Rinku Singh
    'p2_8'         // Bowler: Mohammed Siraj
  );

  const newMatch: Match = {
    id: 'match_kkr_vs_rcb_01',
    title: 'Eden Gardens Blockbuster 2026',
    format: 't20',
    venue: 'Eden Gardens, Kolkata',
    date: '2026-10-10',
    status: 'live',
    team1: updatedKKR,
    team2: rcbTeam,
    playingXITeam1: updatedKKR.players.map((p) => p.id),
    playingXITeam2: rcbTeam.players.map((p) => p.id),
    tossWinnerId: updatedKKR.id,
    tossDecision: 'bat',
    ballType: 'leather',
    scorerName: 'Official BCCI Scorer',
    organizerName: 'Bengal Cricket Association',
    rules: RULES_20_OVERS,
    innings: [inn1Start],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: Date.now(),
  };

  await StorageService.saveMatch(newMatch);
  const savedMatch = (await StorageService.getMatchById('match_kkr_vs_rcb_01'))!;
  assert.ok(savedMatch);
  assert.equal(savedMatch.status, 'live');
  assert.equal(savedMatch.venue, 'Eden Gardens, Kolkata');
  assert.equal(savedMatch.ballType, 'leather');
  assert.equal(savedMatch.scorerName, 'Official BCCI Scorer');

  // =========================================================================
  // JOURNEY 5: Scorer scores both innings until match completion
  // =========================================================================
  // INNINGS 1: KKR batting
  let inn1 = savedMatch.innings[0]!;

  // Delivery 1: Shreyas faces, dot ball (0)
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'd1_1',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'p_shreyas_1',
      nonStrikerId: 'p_rinku_55',
      bowlerId: 'p2_8',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: 'Dot ball defended',
      timestamp: 1001,
    },
    RULES_20_OVERS
  );
  assert.equal(inn1.currentStrikerId, 'p_shreyas_1');

  // Delivery 2: Shreyas takes a single (1) -> Rinku on strike!
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'd1_2',
      ballNumberInMatch: 2,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: true,
      strikerId: 'p_shreyas_1',
      nonStrikerId: 'p_rinku_55',
      bowlerId: 'p2_8',
      runsBat: 1,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: 'Single pushed to mid-on',
      timestamp: 1002,
    },
    RULES_20_OVERS
  );
  assert.equal(inn1.currentStrikerId, 'p_rinku_55');

  // Delivery 3: Wide ball down the leg side (+1 extra)
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'd1_3_w',
      ballNumberInMatch: 3,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: false,
      strikerId: 'p_rinku_55',
      nonStrikerId: 'p_shreyas_1',
      bowlerId: 'p2_8',
      runsBat: 0,
      runsExtra: 1,
      extraType: 'wide',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: 'Wide ball',
      timestamp: 1003,
    },
    RULES_20_OVERS
  );
  assert.equal(inn1.currentStrikerId, 'p_rinku_55');

  // Delivery 4: Rinku hits a FOUR (4)!
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'd1_4',
      ballNumberInMatch: 4,
      overIndex: 0,
      ballInOver: 3,
      isLegalDelivery: true,
      strikerId: 'p_rinku_55',
      nonStrikerId: 'p_shreyas_1',
      bowlerId: 'p2_8',
      runsBat: 4,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: true,
      isSix: false,
      isWicket: false,
      commentary: 'CRACKING FOUR through covers!',
      timestamp: 1004,
    },
    RULES_20_OVERS
  );
  assert.equal(inn1.batterStats['p_rinku_55'].fours, 1);
  assert.equal(inn1.currentStrikerId, 'p_rinku_55');

  // Delivery 5: Rinku smashes a massive SIX (6)!
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'd1_5',
      ballNumberInMatch: 5,
      overIndex: 0,
      ballInOver: 4,
      isLegalDelivery: true,
      strikerId: 'p_rinku_55',
      nonStrikerId: 'p_shreyas_1',
      bowlerId: 'p2_8',
      runsBat: 6,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: true,
      isWicket: false,
      commentary: 'SIX! High into the Eden Gardens stands!',
      timestamp: 1005,
    },
    RULES_20_OVERS
  );
  assert.equal(inn1.batterStats['p_rinku_55'].sixes, 1);
  assert.equal(inn1.currentStrikerId, 'p_rinku_55');

  // Delivery 6: Rinku takes 1 run
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'd1_6',
      ballNumberInMatch: 6,
      overIndex: 0,
      ballInOver: 5,
      isLegalDelivery: true,
      strikerId: 'p_rinku_55',
      nonStrikerId: 'p_shreyas_1',
      bowlerId: 'p2_8',
      runsBat: 1,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: 'Single taken',
      timestamp: 1006,
    },
    RULES_20_OVERS
  );
  assert.equal(inn1.currentStrikerId, 'p_shreyas_1');

  // Delivery 7: Shreyas takes 1 run on final ball of over 1!
  // Single + over finished -> Shreyas retains strike for Over 2!
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'd1_7',
      ballNumberInMatch: 7,
      overIndex: 0,
      ballInOver: 6,
      isLegalDelivery: true,
      strikerId: 'p_shreyas_1',
      nonStrikerId: 'p_rinku_55',
      bowlerId: 'p2_8',
      runsBat: 1,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: 'Single on final ball of over',
      timestamp: 1007,
    },
    RULES_20_OVERS
  );
  assert.equal(inn1.legalBallsBowled, 6);
  assert.equal(inn1.oversFormatted, '1.0');
  assert.equal(inn1.currentStrikerId, 'p_shreyas_1');

  // Let's complete Innings 1 with KKR totaling 25 runs (for concise match demonstration)
  inn1.isCompleted = true;
  inn1.completedReason = 'Innings Concluded';

  // INNINGS BREAK & START INNINGS 2:
  // Target is inn1.totalRuns + 1 (14 + 1 = 15 runs)
  const target = inn1.totalRuns + 1;
  assert.equal(target, 15);

  // RCB chases: Virat Kohli ('p2_1') and Faf du Plessis ('p2_2') open against Shreyas Iyer ('p_shreyas_1')
  let inn2 = createInitialInnings(
    2,
    rcbTeam.id,
    updatedKKR.id,
    'p2_1',
    'p2_2',
    'p_shreyas_1'
  );

  // Ball 1: Virat Kohli hits FOUR (4)
  inn2 = CricketEngine.applyDelivery(
    inn2,
    {
      id: 'd2_1',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'p2_1',
      nonStrikerId: 'p2_2',
      bowlerId: 'p_shreyas_1',
      runsBat: 4,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: true,
      isSix: false,
      isWicket: false,
      commentary: 'Four! Classic Kohli cover drive',
      timestamp: 2001,
    },
    RULES_20_OVERS,
    target
  );
  assert.equal(inn2.totalRuns, 4);
  assert.equal(inn2.isCompleted, false);

  // Ball 2: Virat Kohli hits SIX (6)
  inn2 = CricketEngine.applyDelivery(
    inn2,
    {
      id: 'd2_2',
      ballNumberInMatch: 2,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: true,
      strikerId: 'p2_1',
      nonStrikerId: 'p2_2',
      bowlerId: 'p_shreyas_1',
      runsBat: 6,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: true,
      isWicket: false,
      commentary: 'SIX over long on!',
      timestamp: 2002,
    },
    RULES_20_OVERS,
    target
  );
  assert.equal(inn2.totalRuns, 10);
  assert.equal(inn2.isCompleted, false);

  // Ball 3: Virat Kohli hits SIX (6) -> Reaches 16 runs (>= 15 Target)! TARGET ACHIEVED!
  inn2 = CricketEngine.applyDelivery(
    inn2,
    {
      id: 'd2_3',
      ballNumberInMatch: 3,
      overIndex: 0,
      ballInOver: 3,
      isLegalDelivery: true,
      strikerId: 'p2_1',
      nonStrikerId: 'p2_2',
      bowlerId: 'p_shreyas_1',
      runsBat: 6,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: true,
      isWicket: false,
      commentary: 'SIX! Royal Challengers seal the victory in style!',
      timestamp: 2003,
    },
    RULES_20_OVERS,
    target
  );

  // Verify Innings 2 completion and target achievement
  assert.equal(inn2.totalRuns, 16);
  assert.equal(inn2.isCompleted, true);
  assert.equal(inn2.completedReason, 'Target Achieved');

  // Finalize Match
  const completedMatch: Match = {
    ...newMatch,
    status: 'completed',
    innings: [inn1, inn2],
    targetRuns: target,
    result: CricketEngine.evaluateMatchResult({
      ...newMatch,
      innings: [inn1, inn2],
    }),
    lastUpdated: Date.now(),
  };

  assert.equal(
    completedMatch.result,
    'Royal Challengers won by 10 wickets (117 balls remaining)'
  );

  await StorageService.saveMatch(completedMatch);

  // =========================================================================
  // JOURNEY 6: Career Stats Rollup Updates Permanent Player Profiles
  // =========================================================================
  const allCurrentMatches = await StorageService.getMatches();
  const allCurrentTeams = await StorageService.getTeams();

  // Aggregate stats across all players
  const allPlayersInLeague = allCurrentTeams.flatMap((t) => t.players);
  const rollupMap = StatsRollupEngine.rollupAllCareerStats(
    allPlayersInLeague,
    allCurrentMatches
  );

  // Verify Rinku Singh's updated permanent career stats
  const rinkuStatsRecord = rollupMap.get('p_rinku_55')!;
  assert.ok(rinkuStatsRecord, 'Rinku Singh rollup stats computed');
  const rStats = rinkuStatsRecord.careerStats;

  assert.equal(rStats.matches, 1, 'Rinku has 1 match recorded');
  assert.equal(rStats.inningsBatted, 1);
  assert.equal(rStats.runs, 11, 'Rinku scored 11 runs (4 + 6 + 1)');
  assert.equal(rStats.fours, 1);
  assert.equal(rStats.sixes, 1);
  assert.equal(rStats.highestScore, 11);
  assert.equal(rStats.highestScoreNotOut, true);
  // Strike rate: 11 runs off 3 balls faced = (11 / 3) * 100 = 366.67
  assert.equal(rStats.strikeRate, 366.67);
  // Average: not out, so average = 11.0
  assert.equal(rStats.average, 11);
  assert.deepEqual(rinkuStatsRecord.recentScores, [11]);

  // Verify Shreyas Iyer's updated stats
  const shreyasRecord = rollupMap.get('p_shreyas_1')!;
  assert.ok(shreyasRecord);
  assert.equal(shreyasRecord.careerStats.matches, 1);
  assert.equal(shreyasRecord.careerStats.runs, 2); // 1 + 1
  assert.equal(shreyasRecord.careerStats.oversBowled, 0.3); // 3 balls bowled
  assert.equal(shreyasRecord.careerStats.runsConceded, 16);

  // Verify Virat Kohli's updated stats (Kohli had seeded baseline stats + new match)
  const viratRecord = rollupMap.get('p2_1')!;
  assert.ok(viratRecord);
  // In baseline, Kohli had 2340 runs in 56 matches
  // New match: +1 match, +16 runs
  assert.equal(viratRecord.careerStats.matches, 57);
  assert.equal(viratRecord.careerStats.runs, 2356);
  assert.equal(viratRecord.careerStats.fours, 231); // 230 + 1
  assert.equal(viratRecord.careerStats.sixes, 70);  // 68 + 2
  assert.deepEqual(viratRecord.recentScores, [83, 42, 108, 51, 16], 'Recent scores rolling window updated');

  // Verify Mohammed Siraj's bowling stats
  const sirajRecord = rollupMap.get('p2_8')!;
  assert.ok(sirajRecord);
  assert.equal(sirajRecord.careerStats.matches, 1);
  assert.equal(sirajRecord.careerStats.oversBowled, 1.0);
  assert.equal(sirajRecord.careerStats.runsConceded, 14);
  assert.equal(sirajRecord.careerStats.maidens, 0);

  // Commit rollup to persistent storage
  const updatedTeamsWithStats = allCurrentTeams.map((team) => ({
    ...team,
    players: team.players.map((player) => {
      const stats = rollupMap.get(player.id);
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

  await StorageService.saveTeams(updatedTeamsWithStats);

  // Final verification from storage reload:
  const verifiedTeams = await StorageService.getTeams();
  const kkrStored = verifiedTeams.find((t) => t.id === 'team_kolkata')!;
  const rinkuStored = kkrStored.players.find((p) => p.id === 'p_rinku_55')!;

  assert.equal(rinkuStored.careerStats?.runs, 11);
  assert.equal(rinkuStored.careerStats?.fours, 1);
  assert.equal(rinkuStored.careerStats?.sixes, 1);
  assert.equal(rinkuStored.careerStats?.strikeRate, 366.67);
  assert.deepEqual(rinkuStored.recentScores, [11]);
});
