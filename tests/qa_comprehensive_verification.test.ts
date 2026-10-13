import test from 'node:test';
import assert from 'node:assert/strict';
import { StorageService, type UserProfile } from '../src/storage/storageService';
import { DEFAULT_TEAMS } from '../src/storage/defaultData';
import {
  CricketEngine,
  createInitialInnings,
  calculateRunRate,
  calculateRequiredRunRate,
} from '../src/engine/cricketEngine';
import { StatsRollupEngine } from '../src/engine/statsRollupEngine';
import type {
  Team,
  Match,
  Delivery,
  MatchRules,
  Player,
  AvatarPreset,
  TossDecision,
  DismissalType,
} from '../src/types/cricket';

const T20_RULES: MatchRules = {
  totalOvers: 20,
  maxOversPerBowler: 4,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('QA Test 1: Free Hit State Machine, Negated Dismissals, and Carry-Overs', () => {
  let inn = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // Step 1: Normal legal ball 1 (dot ball)
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd1',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'bat1',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: '',
      timestamp: 1000,
    },
    T20_RULES
  );
  assert.equal(inn.isFreeHit, false, 'Free hit is inactive on normal ball');

  // Step 2: No-Ball bowled on ball 2!
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd2',
      ballNumberInMatch: 2,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: false,
      strikerId: 'bat1',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 1,
      extraType: 'noBall',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: '',
      timestamp: 1001,
    },
    T20_RULES
  );
  assert.equal(inn.isFreeHit, true, 'isFreeHit flag is now TRUE');
  assert.equal(inn.legalBallsBowled, 1);

  // Step 3: On Free Hit delivery, bowler gets batsman CAUGHT!
  // CAUGHT is ILLEGAL on a free hit per MCC Law 21.19 / ICC T20 Playing Conditions!
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd3',
      ballNumberInMatch: 3,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: true,
      strikerId: 'bat1',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: true,
      wicketDetails: {
        dismissalType: 'caught',
        playerDismissedId: 'bat1',
        fielderId: 'fld1',
      },
      commentary: '',
      timestamp: 1002,
    },
    T20_RULES
  );

  assert.equal(inn.totalWickets, 0, 'Caught on Free Hit must be negated! Total wickets remains 0');
  assert.equal(inn.fallOfWickets.length, 0, 'No fall of wickets entry for negated catch');
  assert.equal(inn.batterStats['bat1'].isOut, false, 'Batter 1 remains NOT OUT');
  assert.equal(inn.isFreeHit, false, 'Free Hit expires after a legal delivery');

  // Step 4: No-ball triggered again
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd4',
      ballNumberInMatch: 4,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: false,
      strikerId: 'bat1',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 1,
      extraType: 'noBall',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: '',
      timestamp: 1003,
    },
    T20_RULES
  );
  assert.equal(inn.isFreeHit, true, 'Free hit active again');

  // Step 5: On Free Hit, bowler bowls a WIDE
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd5',
      ballNumberInMatch: 5,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: false,
      strikerId: 'bat1',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 1,
      extraType: 'wide',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: '',
      timestamp: 1004,
    },
    T20_RULES
  );
  assert.equal(inn.isFreeHit, true, 'Free hit MUST CARRY OVER after a wide delivery');

  // Step 6: On carried-over Free Hit, Bowler attempts LBW!
  // LBW is also NEGATED on free hit!
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd6',
      ballNumberInMatch: 6,
      overIndex: 0,
      ballInOver: 3,
      isLegalDelivery: true,
      strikerId: 'bat1',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: true,
      wicketDetails: {
        dismissalType: 'lbw',
        playerDismissedId: 'bat1',
        bowlerId: 'bowl1',
      },
      commentary: '',
      timestamp: 1005,
    },
    T20_RULES
  );
  assert.equal(inn.totalWickets, 0, 'LBW on Free Hit negated! Wickets remain 0');
  assert.equal(inn.batterStats['bat1'].isOut, false);
  assert.equal(inn.isFreeHit, false, 'Free Hit expires on legal ball');
});

test('QA Test 2: MCC Law 25.4 (Retired Hurt vs Retired Out) Verification', () => {
  let inn = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // Batter 1 scores 10 runs then retires hurt
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'rh_del',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'bat1',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: true,
      wicketDetails: {
        dismissalType: 'retired_hurt',
        playerDismissedId: 'bat1',
      },
      commentary: '',
      timestamp: 2001,
    },
    T20_RULES
  );

  // Assertions for Retired Hurt:
  assert.equal(inn.totalWickets, 0, 'Retired Hurt must NOT increment total wickets');
  assert.equal(inn.fallOfWickets.length, 0, 'Retired Hurt must NOT add fall of wicket');
  assert.equal(inn.batterStats['bat1'].isOut, false, 'Batter 1 remains NOT OUT in stats');
  assert.equal(inn.currentStrikerId, undefined, 'Crease slot cleared for next batter');
  assert.equal(
    CricketEngine.getDismissalDescription('retired_hurt'),
    'retired hurt (not out)'
  );

  // Incoming batter 3 arrives
  inn.currentStrikerId = 'bat3';
  inn.batterStats['bat3'] = {
    playerId: 'bat3',
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    isOut: false,
    battingOrder: 3,
  };

  // Batter 3 retires OUT on ball 2
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'ro_del',
      ballNumberInMatch: 2,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: true,
      strikerId: 'bat3',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: true,
      wicketDetails: {
        dismissalType: 'retired_out',
        playerDismissedId: 'bat3',
      },
      commentary: '',
      timestamp: 2002,
    },
    T20_RULES
  );

  // Assertions for Retired Out:
  assert.equal(inn.totalWickets, 1, 'Retired Out counts as a wicket lost for the team');
  assert.equal(inn.fallOfWickets.length, 1);
  assert.equal(inn.batterStats['bat3'].isOut, true, 'Batter 3 is marked OUT');
  assert.equal(CricketEngine.getDismissalDescription('retired_out'), 'retired out');
});

test('QA Test 3: Shot Area Tagging & Contextual Commentary with Bowler/Batter Figures & Milestones', () => {
  const delivery: Delivery = {
    id: 'comm_1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'b_kohli',
    nonStrikerId: 'b_faf',
    bowlerId: 'b_bumrah',
    runsBat: 4,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: true,
    isSix: false,
    isWicket: false,
    shotArea: 'Cover',
    bowlingSide: 'round',
    commentary: '',
    timestamp: 3001,
  };

  // Context: Kohli crosses from 48 to 52 (FIFTY milestone!)
  const comm = CricketEngine.generateDeliveryCommentary(delivery, {
    bowlerName: 'Jasprit Bumrah',
    strikerName: 'Virat Kohli',
    bowlerStats: {
      playerId: 'b_bumrah',
      legalBalls: 7,
      oversFormatted: '1.1',
      maidens: 0,
      runsConceded: 12,
      wickets: 1,
      economy: 10.28,
      wides: 0,
      noBalls: 0,
      dots: 3,
    },
    strikerStats: {
      playerId: 'b_kohli',
      runs: 52,
      ballsFaced: 32,
      fours: 6,
      sixes: 2,
      strikeRate: 162.5,
      isOut: false,
      battingOrder: 1,
    },
    previousStrikerRuns: 48,
    currentPartnershipRuns: 54,
    previousPartnershipRuns: 50,
  });

  // Verify Bowler figures & spell prefix
  assert.ok(comm.includes('Jasprit Bumrah (1.1-0-12-1) to Virat Kohli (52* off 32b)'));
  // Verify bowling angle info
  assert.ok(comm.includes('from round the wicket'));
  // Verify shot area in boundary description
  assert.ok(comm.includes('Cover'));
  // Verify automated milestone celebration banner in commentary
  assert.ok(comm.includes('🎉 FIFTY! A masterclass half-century for Virat Kohli'));

  // Test Century Milestone & Partnership alerts
  const deliveryCentury: Delivery = {
    ...delivery,
    runsBat: 6,
    isBoundary: false,
    isSix: true,
    shotArea: 'Long-On',
  };

  const commCentury = CricketEngine.generateDeliveryCommentary(deliveryCentury, {
    bowlerName: 'Jasprit Bumrah',
    strikerName: 'Virat Kohli',
    strikerStats: {
      playerId: 'b_kohli',
      runs: 102,
      ballsFaced: 58,
      fours: 10,
      sixes: 5,
      strikeRate: 175.8,
      isOut: false,
      battingOrder: 1,
    },
    previousStrikerRuns: 96,
    currentPartnershipRuns: 104,
    previousPartnershipRuns: 98,
  });

  assert.ok(commCentury.includes('💯 HUNDRED! Roaring century for Virat Kohli'));
  assert.ok(commCentury.includes('🤝 100-RUN PARTNERSHIP!'));
  assert.ok(commCentury.includes('Long-On'));
});

test('QA Test 4: 1-Tap Undo Determinism Restoring Crease Slots & Figures', () => {
  const initial = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // Over progression:
  // Ball 1: single -> bat2 on strike
  const d1: Delivery = {
    id: 'u1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'bat1',
    nonStrikerId: 'bat2',
    bowlerId: 'bowl1',
    runsBat: 1,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: '',
    timestamp: 4001,
  };

  // Ball 2: Bowled! bat2 dismissed -> striker slot cleared to undefined!
  const d2: Delivery = {
    id: 'u2',
    ballNumberInMatch: 2,
    overIndex: 0,
    ballInOver: 2,
    isLegalDelivery: true,
    strikerId: 'bat2',
    nonStrikerId: 'bat1',
    bowlerId: 'bowl1',
    runsBat: 0,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: true,
    wicketDetails: {
      dismissalType: 'bowled',
      playerDismissedId: 'bat2',
      bowlerId: 'bowl1',
    },
    commentary: '',
    timestamp: 4002,
  };

  const state1 = CricketEngine.applyDelivery(initial, d1, T20_RULES);
  const state2 = CricketEngine.applyDelivery(state1, d2, T20_RULES);

  assert.equal(state2.totalWickets, 1);
  assert.equal(state2.currentStrikerId, undefined, 'Dismissed striker slot is vacant');
  assert.equal(state2.currentNonStrikerId, 'bat1');

  // 1-Tap Undo of Ball 2:
  const undone = CricketEngine.replayInnings(initial, [d1], T20_RULES);
  assert.equal(undone.totalWickets, 0, 'Wicket count restored to 0');
  assert.equal(undone.fallOfWickets.length, 0);
  assert.equal(undone.currentStrikerId, 'bat2', 'Striker slot restored to bat2');
  assert.equal(undone.currentNonStrikerId, 'bat1', 'Non-striker restored to bat1');
  assert.equal(undone.batterStats['bat2'].isOut, false, 'bat2 restored to not out');
  assert.equal(undone.bowlerStats['bowl1'].wickets, 0, 'Bowler wickets restored');

  // 1-Tap Undo of Ball 1 back to 0 balls:
  const undoneToEmpty = CricketEngine.replayInnings(initial, [], T20_RULES);
  assert.equal(undoneToEmpty.totalRuns, 0);
  assert.equal(undoneToEmpty.legalBallsBowled, 0);
  assert.equal(undoneToEmpty.currentStrikerId, 'bat1', 'Initial striker preserved');
  assert.equal(undoneToEmpty.currentNonStrikerId, 'bat2', 'Initial non-striker preserved');
  assert.equal(undoneToEmpty.currentBowlerId, 'bowl1', 'Initial bowler preserved');
});

test('QA Test 5: End-to-End Simulation of All 6 Core User Journeys', async () => {
  // -------------------------------------------------------------------------
  // Journey 1: Player Profile Creation with Customization
  // -------------------------------------------------------------------------
  const customAvatar: AvatarPreset = 'helmet';
  const profile: UserProfile = {
    id: 'user_rutu',
    name: 'Ruturaj Gaikwad',
    phoneNumber: '+91 98444 33221',
    isGuest: false,
    isVerified: true,
    role: 'captain',
    playingRole: 'batter',
    battingHand: 'right',
    bowlingStyle: 'spin-off',
    claimedPlayerId: 'p_rutu_31',
  };

  await StorageService.saveUserProfile(profile);
  const reloadedProfile = await StorageService.getUserProfile();
  assert.equal(reloadedProfile.name, 'Ruturaj Gaikwad');
  assert.equal(reloadedProfile.playingRole, 'batter');
  assert.equal(reloadedProfile.battingHand, 'right');

  // -------------------------------------------------------------------------
  // Journey 2: Team Registration by Captain
  // -------------------------------------------------------------------------
  const captain: Player = {
    id: reloadedProfile.claimedPlayerId || 'p_rutu_31',
    name: reloadedProfile.name,
    role: reloadedProfile.playingRole || 'batter',
    battingHand: reloadedProfile.battingHand || 'right',
    bowlingStyle: reloadedProfile.bowlingStyle || 'spin-off',
    phoneNumber: reloadedProfile.phoneNumber,
    isCaptain: true,
    avatarPreset: customAvatar,
    jerseyNumber: 31,
    city: 'Pune',
    clubName: 'Maharashtra Cricket Club',
    careerStats: StatsRollupEngine.createEmptyCareerStats(),
    recentScores: [],
  };

  const newTeam: Team = {
    id: 'team_chennai_lions',
    name: 'Chennai Lions',
    shortName: 'CHL',
    primaryColor: '#F59E0B',
    captainPlayerId: captain.id,
    createdByUserId: reloadedProfile.id,
    players: [captain],
  };

  await StorageService.saveTeam(newTeam);
  const loadedTeams = await StorageService.getTeams();
  const createdTeam = loadedTeams.find((t) => t.id === 'team_chennai_lions');
  assert.ok(createdTeam);
  assert.equal(createdTeam!.name, 'Chennai Lions');
  assert.equal(createdTeam!.players[0].jerseyNumber, 31);
  assert.equal(createdTeam!.players[0].avatarPreset, 'helmet');

  // -------------------------------------------------------------------------
  // Journey 3: Join Request -> Captain Inbox -> Approval -> Roster Updated
  // -------------------------------------------------------------------------
  const recruitPlayer: Player = {
    id: 'p_dube_25',
    name: 'Shivam Dube',
    role: 'all-rounder',
    battingHand: 'left',
    bowlingStyle: 'medium',
    phoneNumber: '+91 98444 33222',
    avatarPreset: 'gloves',
    jerseyNumber: 25,
    careerStats: StatsRollupEngine.createEmptyCareerStats(),
    recentScores: [],
  };

  await StorageService.addJoinRequest({
    id: 'req_dube_chl',
    teamId: 'team_chennai_lions',
    playerId: recruitPlayer.id,
    playerName: recruitPlayer.name,
    playerRole: recruitPlayer.role,
    playerPhone: recruitPlayer.phoneNumber,
    status: 'pending',
    requestedAt: Date.now(),
  });

  const pendingList = await StorageService.getJoinRequests();
  const teamPending = pendingList.filter(
    (r) => r.teamId === 'team_chennai_lions' && r.status === 'pending'
  );
  assert.equal(teamPending.length, 1);
  assert.equal(teamPending[0].playerName, 'Shivam Dube');

  // Captain Approves atomically
  const approvedResult = await StorageService.approveJoinRequestAtomic('req_dube_chl');
  assert.equal(approvedResult.updatedRequest?.status, 'approved');

  const chlSquad = approvedResult.allTeams.find((t) => t.id === 'team_chennai_lions')!;
  assert.equal(chlSquad.players.length, 2);
  assert.ok(chlSquad.players.some((p) => p.name === 'Shivam Dube'));

  // -------------------------------------------------------------------------
  // Journey 4: Match Setup by Organizer with Interactive Coin Toss
  // -------------------------------------------------------------------------
  // Second team: Royal Challengers (save to storage for match creation)
  await StorageService.saveTeam(DEFAULT_TEAMS[1]);
  const teamsWithOpponent = await StorageService.getTeams();
  const rcbTeam = teamsWithOpponent.find((t) => t.id === 'team_bangalore') || teamsWithOpponent[1];

  // Coin Toss: Chennai Lions win toss and elect to bat
  const tossDecision: TossDecision = 'bat';
  const tossWinnerId = chlSquad.id;

  const inn1Start = createInitialInnings(
    1,
    chlSquad.id,
    rcbTeam.id,
    'p_rutu_31',  // Striker: Ruturaj
    'p_dube_25',  // Non-Striker: Dube
    'p2_8'        // Opening Bowler: Siraj
  );

  const match: Match = {
    id: 'match_chl_vs_rcb_cup',
    title: 'Super Derby 2026',
    format: 't20',
    venue: 'MA Chidambaram Stadium, Chepauk',
    date: '2026-10-10',
    status: 'live',
    team1: chlSquad,
    team2: rcbTeam,
    playingXITeam1: chlSquad.players.map((p) => p.id),
    playingXITeam2: rcbTeam.players.map((p) => p.id),
    tossWinnerId,
    tossDecision,
    ballType: 'leather',
    scorerName: 'Official BCCI Scorer',
    organizerName: 'Tamil Nadu Cricket Board',
    rules: T20_RULES,
    innings: [inn1Start],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: Date.now(),
  };

  await StorageService.saveMatch(match);
  const persistedMatch = (await StorageService.getMatchById('match_chl_vs_rcb_cup'))!;
  assert.equal(persistedMatch.status, 'live');
  assert.equal(persistedMatch.venue, 'MA Chidambaram Stadium, Chepauk');

  // -------------------------------------------------------------------------
  // Journey 5: Live Scoring with Bowler Angle, Shot Area, Free Hit, and Completion
  // -------------------------------------------------------------------------
  let inn1 = persistedMatch.innings[0]!;

  // Ball 1: Ruturaj hits a FOUR through Cover! (Angle: round)
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'm_d1',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'p_rutu_31',
      nonStrikerId: 'p_dube_25',
      bowlerId: 'p2_8',
      runsBat: 4,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: true,
      isSix: false,
      isWicket: false,
      shotArea: 'Cover',
      bowlingSide: 'round',
      commentary: '',
      timestamp: 5001,
    },
    T20_RULES
  );
  assert.equal(inn1.totalRuns, 4);

  // Ball 2: No-Ball overstepping! Free Hit triggered!
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'm_d2',
      ballNumberInMatch: 2,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: false,
      strikerId: 'p_rutu_31',
      nonStrikerId: 'p_dube_25',
      bowlerId: 'p2_8',
      runsBat: 1,
      runsExtra: 1,
      extraType: 'noBall',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      shotArea: 'Mid-Wicket',
      bowlingSide: 'round',
      commentary: '',
      timestamp: 5002,
    },
    T20_RULES
  );
  assert.equal(inn1.isFreeHit, true, 'Free hit active after No-Ball');
  assert.equal(inn1.currentStrikerId, 'p_dube_25', 'Strike rotated on 1 run bat');

  // Ball 3 (Free Hit): Dube smashes SIX over Long-On!
  inn1 = CricketEngine.applyDelivery(
    inn1,
    {
      id: 'm_d3',
      ballNumberInMatch: 3,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: true,
      strikerId: 'p_dube_25',
      nonStrikerId: 'p_rutu_31',
      bowlerId: 'p2_8',
      runsBat: 6,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: true,
      isWicket: false,
      shotArea: 'Long-On',
      bowlingSide: 'round',
      commentary: '',
      timestamp: 5003,
    },
    T20_RULES
  );
  assert.equal(inn1.totalRuns, 12);
  assert.equal(inn1.isFreeHit, false, 'Free hit expired on legal ball');

  // Conclude Innings 1 with 12 runs
  inn1.isCompleted = true;
  inn1.completedReason = 'Innings Concluded';

  // INNINGS 2: Target is 13 runs (12 + 1)
  const target = 13;
  let inn2 = createInitialInnings(
    2,
    rcbTeam.id,
    chlSquad.id,
    'p2_1', // Virat Kohli
    'p2_2', // Faf du Plessis
    'p_rutu_31' // Bowler: Ruturaj
  );

  // Ball 1: Kohli hits SIX over Deep Mid-Wicket
  inn2 = CricketEngine.applyDelivery(
    inn2,
    {
      id: 'm2_d1',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'p2_1',
      nonStrikerId: 'p2_2',
      bowlerId: 'p_rutu_31',
      runsBat: 6,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: true,
      isWicket: false,
      shotArea: 'Mid-Wicket',
      bowlingSide: 'over',
      commentary: '',
      timestamp: 6001,
    },
    T20_RULES,
    target
  );

  // Ball 2: Kohli hits SIX over Long-Off (Total: 12 runs)
  inn2 = CricketEngine.applyDelivery(
    inn2,
    {
      id: 'm2_d2',
      ballNumberInMatch: 2,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: true,
      strikerId: 'p2_1',
      nonStrikerId: 'p2_2',
      bowlerId: 'p_rutu_31',
      runsBat: 6,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: true,
      isWicket: false,
      shotArea: 'Long-Off',
      bowlingSide: 'over',
      commentary: '',
      timestamp: 6002,
    },
    T20_RULES,
    target
  );

  // Ball 3: Kohli hits single (Total: 13 runs >= 13 target) -> TARGET ACHIEVED!
  inn2 = CricketEngine.applyDelivery(
    inn2,
    {
      id: 'm2_d3',
      ballNumberInMatch: 3,
      overIndex: 0,
      ballInOver: 3,
      isLegalDelivery: true,
      strikerId: 'p2_1',
      nonStrikerId: 'p2_2',
      bowlerId: 'p_rutu_31',
      runsBat: 1,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      shotArea: 'Cover',
      bowlingSide: 'over',
      commentary: '',
      timestamp: 6003,
    },
    T20_RULES,
    target
  );

  assert.equal(inn2.totalRuns, 13);
  assert.equal(inn2.isCompleted, true);
  assert.equal(inn2.completedReason, 'Target Achieved');

  const completedMatch: Match = {
    ...persistedMatch,
    status: 'completed',
    innings: [inn1, inn2],
    targetRuns: target,
    result: CricketEngine.evaluateMatchResult({
      ...persistedMatch,
      innings: [inn1, inn2],
    }),
    lastUpdated: Date.now(),
  };

  assert.equal(
    completedMatch.result,
    'Royal Challengers won by 10 wickets (117 balls remaining)'
  );

  await StorageService.saveMatch(completedMatch);

  // -------------------------------------------------------------------------
  // Journey 6: Automatic Career Stats Rollup Updating Permanent Profiles
  // -------------------------------------------------------------------------
  const matches = await StorageService.getMatches();
  const currentTeams = await StorageService.getTeams();
  const allPlayers = currentTeams.flatMap((t) => t.players);

  const rollupMap = StatsRollupEngine.rollupAllCareerStats(allPlayers, matches);

  // Verify Shivam Dube stats
  const dubeRecord = rollupMap.get('p_dube_25')!;
  assert.ok(dubeRecord);
  assert.equal(dubeRecord.careerStats.matches, 1);
  assert.equal(dubeRecord.careerStats.runs, 6);
  assert.equal(dubeRecord.careerStats.sixes, 1);
  assert.equal(dubeRecord.careerStats.strikeRate, 600.0);
  assert.equal(dubeRecord.careerStats.average, 6);
  assert.deepEqual(dubeRecord.recentScores, [6]);

  // Verify Ruturaj Gaikwad stats
  const rutuRecord = rollupMap.get('p_rutu_31')!;
  assert.ok(rutuRecord);
  assert.equal(rutuRecord.careerStats.matches, 1);
  assert.equal(rutuRecord.careerStats.runs, 5); // 4 + 1
  assert.equal(rutuRecord.careerStats.fours, 1);
  assert.equal(rutuRecord.careerStats.oversBowled, 0.3);
  assert.equal(rutuRecord.careerStats.runsConceded, 13);

  // Verify no NaN or Infinity across all rolled up records
  for (const [playerId, record] of rollupMap.entries()) {
    const s = record.careerStats;
    assert.equal(isNaN(s.average), false, `Average for ${playerId} must not be NaN`);
    assert.equal(isNaN(s.strikeRate), false, `Strike rate for ${playerId} must not be NaN`);
    assert.equal(isFinite(s.average), true, `Average for ${playerId} must be finite`);
    assert.equal(isFinite(s.strikeRate), true, `Strike rate for ${playerId} must be finite`);
    assert.equal(isNaN(s.bowlingEconomy), false, `Economy for ${playerId} must not be NaN`);
    assert.equal(isNaN(s.bowlingAverage), false, `Bowling average for ${playerId} must not be NaN`);
  }
});
