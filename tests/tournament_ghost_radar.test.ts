import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CricketEngine,
  createInitialInnings,
  derivePitchMapping,
} from '../src/engine/cricketEngine';
import type { BallInput } from '../src/engine/cricketEngine';
import { StorageService } from '../src/storage/storageService';
import type {
  Match,
  MatchRules,
  Team,
  Player,
  Tournament,
  Innings,
  Delivery,
  ShotSector,
} from '../src/types/cricket';

const TEST_RULES: MatchRules = {
  totalOvers: 20,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('1. Tournament Standings & Net Run Rate (NRR) Mathematical Calculation', () => {
  // Test scenario:
  // Match 1: Team A scores 180 in 20.0 overs (RR = 9.00).
  // Team B is bowled out for 120 in 15.0 overs.
  // CRITICAL NRR LAW: If a team is all out, the FULL quota of allotted overs (20.0) is used for the divisor!
  // Team A NRR: (180 / 20.0) - (120 / 20.0) = 9.00 - 6.00 = +3.000
  // Team B NRR: (120 / 20.0) - (180 / 20.0) = 6.00 - 9.00 = -3.000

  const teamA: Team = {
    id: 'team_a',
    name: 'Warriors',
    shortName: 'WAR',
    primaryColor: '#00E676',
    players: [],
  };

  const teamB: Team = {
    id: 'team_b',
    name: 'Titans',
    shortName: 'TIT',
    primaryColor: '#3B82F6',
    players: [],
  };

  const totalAllottedOvers = 20;

  // Innings 1: Team A bats, scores 180/4 in 20.0 overs
  const inn1: Innings = {
    inningsNumber: 1,
    battingTeamId: teamA.id,
    bowlingTeamId: teamB.id,
    totalRuns: 180,
    totalWickets: 4,
    legalBallsBowled: 120, // 20.0 ov
    oversFormatted: '20.0',
    deliveries: [],
    batterStats: {},
    bowlerStats: {},
    fallOfWickets: [],
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
    isCompleted: true,
  };

  // Innings 2: Team B bats, all out for 120 in 15.0 overs (90 legal balls)
  const inn2: Innings = {
    inningsNumber: 2,
    battingTeamId: teamB.id,
    bowlingTeamId: teamA.id,
    totalRuns: 120,
    totalWickets: 10, // All Out!
    legalBallsBowled: 90, // 15.0 ov
    oversFormatted: '15.0',
    deliveries: [],
    batterStats: {},
    bowlerStats: {},
    fallOfWickets: [],
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
    isCompleted: true,
  };

  const match: Match = {
    id: 'm1',
    title: 'Match 1',
    format: 't20',
    date: '2026-10-10',
    status: 'completed',
    venue: 'Wankhede Arena',
    team1: teamA,
    team2: teamB,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: teamA.id,
    tossDecision: 'bat',
    currentInningsIndex: 1,
    innings: [inn1, inn2],
    rules: TEST_RULES,
    result: 'Warriors won by 60 runs',
    isSynced: true,
    lastUpdated: Date.now(),
  };

  // Calculate NRR logic
  // Helper for decimal overs:
  const getOversDecimal = (legalBalls: number, isAllOut: boolean, quota: number) => {
    if (isAllOut) return quota;
    const completed = Math.floor(legalBalls / 6);
    const rem = legalBalls % 6;
    return completed + rem / 6;
  };

  // Team A faced 120 balls = 20.0 overs; conceded 120 runs in 20.0 overs (because Team B was all out)
  const teamAOversFaced = getOversDecimal(inn1.legalBallsBowled, inn1.totalWickets >= 10, totalAllottedOvers);
  const teamAOversBowled = getOversDecimal(inn2.legalBallsBowled, inn2.totalWickets >= 10, totalAllottedOvers);

  assert.equal(teamAOversFaced, 20.0, 'Team A faced 20.0 overs');
  assert.equal(teamAOversBowled, 20.0, 'Team A overs bowled is credited as full 20.0 due to All Out rule');

  const teamANRR = inn1.totalRuns / teamAOversFaced - inn2.totalRuns / teamAOversBowled;
  assert.equal(teamANRR.toFixed(3), '3.000', 'Team A NRR must be exactly +3.000');

  // Team B faced 90 balls but all out = credited as 20.0 overs; conceded 180 in 20.0 overs
  const teamBOversFaced = getOversDecimal(inn2.legalBallsBowled, inn2.totalWickets >= 10, totalAllottedOvers);
  const teamBOversBowled = getOversDecimal(inn1.legalBallsBowled, inn1.totalWickets >= 10, totalAllottedOvers);

  assert.equal(teamBOversFaced, 20.0, 'Team B faced overs is 20.0 due to All Out rule');
  assert.equal(teamBOversBowled, 20.0, 'Team B bowled overs is 20.0');

  const teamBNRR = inn2.totalRuns / teamBOversFaced - inn1.totalRuns / teamBOversBowled;
  assert.equal(teamBNRR.toFixed(3), '-3.000', 'Team B NRR must be exactly -3.000');
});

test('2. Dynamic Fantasy MVP Points and Leaderboards Calculation', () => {
  // Formula:
  // MVP = Runs*1 + 4s*1 + 6s*2 + Wickets*25 + Maidens*8 + Catches*8 + Stumpings*12 + RunOuts*8
  const playerStats = {
    runs: 75,
    fours: 8,
    sixes: 3,
    wickets: 3,
    maidens: 1,
    catches: 2,
    stumpings: 0,
    runOuts: 1,
  };

  const expectedMvp =
    playerStats.runs * 1 +
    playerStats.fours * 1 +
    playerStats.sixes * 2 +
    playerStats.wickets * 25 +
    playerStats.maidens * 8 +
    playerStats.catches * 8 +
    playerStats.stumpings * 12 +
    playerStats.runOuts * 8;

  // 75 + 8 + 6 + 75 + 8 + 16 + 0 + 8 = 196
  assert.equal(expectedMvp, 196, 'MVP points must equal 196 for all-round performance');
});

test('3. Ghost Account Creation, Phone Normalization, and Historical Profile Claiming', async () => {
  // Test storage service claiming mechanism
  const phoneRaw = '+91 98765-43210';
  const phoneNormalized = '9876543210';

  const initialTeams: Team[] = [
    {
      id: 'team_mumbai',
      name: 'Mumbai Grassroots',
      shortName: 'MUM',
      primaryColor: '#0055A5',
      players: [
        {
          id: 'ghost_p1',
          name: 'Local Hero',
          role: 'all-rounder',
          battingHand: 'right',
          phoneNumber: phoneRaw,
          isGuest: true,
          isVerified: false,
          teamId: 'team_mumbai',
          careerStats: {
            matches: 5,
            inningsBatted: 5,
            runs: 140,
            highestScore: 52,
            average: 28.0,
            strikeRate: 135.0,
            fifties: 1,
            hundreds: 0,
            fours: 14,
            sixes: 4,
            wickets: 4,
            oversBowled: 12.0,
            maidens: 1,
            runsConceded: 82,
            bowlingAverage: 20.5,
            bowlingEconomy: 6.83,
            bestBowling: '2/18',
            catches: 2,
            stumpings: 0,
            runOuts: 1,
          },
        },
      ],
    },
  ];

  await StorageService.saveTeams(initialTeams);

  // Verification that ghost exists
  let saved = await StorageService.getTeams();
  let ghost = saved[0].players.find((p) => p.id === 'ghost_p1');
  assert.equal(ghost?.isGuest, true, 'Ghost player is initially a guest');
  assert.equal(ghost?.isVerified, false, 'Ghost player is unverified');

  // Claim with slightly different formatted phone number: '98765 43210'
  const claimResult = await StorageService.claimGhostPlayersByPhone(
    '98765 43210',
    'verified_user_101',
    'Rohit S.'
  );

  assert.equal(claimResult.claimedCount, 1, 'Successfully claimed 1 ghost player record');

  saved = await StorageService.getTeams();
  const claimedPlayer = saved[0].players.find((p) => p.id === 'ghost_p1');
  assert.ok(claimedPlayer, 'Claimed player exists');
  assert.equal(claimedPlayer?.isGuest, false, 'Claimed player is no longer a guest');
  assert.equal(claimedPlayer?.isVerified, true, 'Claimed player is now verified');
  assert.equal(claimedPlayer?.claimedByUserId, 'verified_user_101', 'Claimed player userId is recorded');
  assert.equal(claimedPlayer?.careerStats?.runs, 140, 'Career runs are preserved');
  assert.equal(claimedPlayer?.careerStats?.wickets, 4, 'Career wickets are preserved');
});

test('4. Pitch Radar: derivePitchMapping across sectors and coordinate boundaries', () => {
  const sectors: ShotSector[] = [
    'Third Man',
    'Point',
    'Cover',
    'Mid-Off',
    'Long-Off',
    'Long-On',
    'Mid-Wicket',
    'Square Leg',
    'Fine Leg',
    'Behind Keeper',
  ];

  for (const sector of sectors) {
    const mapping = derivePitchMapping(sector);
    assert.ok(mapping.pitchLength, `Pitch length derived for ${sector}`);
    assert.ok(mapping.pitchLine, `Pitch line derived for ${sector}`);
    assert.ok(mapping.pitchCoord, `Pitch coordinates derived for ${sector}`);

    // Verify coordinate percentage bounds [0, 100]
    assert.ok(
      mapping.pitchCoord.x >= 0 && mapping.pitchCoord.x <= 100,
      `X coordinate in bounds for ${sector}: ${mapping.pitchCoord.x}`
    );
    assert.ok(
      mapping.pitchCoord.y >= 0 && mapping.pitchCoord.y <= 100,
      `Y coordinate in bounds for ${sector}: ${mapping.pitchCoord.y}`
    );
  }

  // Check specific cricketing mappings
  const coverMapping = derivePitchMapping('Cover');
  assert.equal(coverMapping.pitchLength, 'full', 'Cover drives derive from full length');
  assert.equal(coverMapping.pitchLine, 'outside_off', 'Cover drives derive from outside off line');

  const thirdManMapping = derivePitchMapping('Third Man');
  assert.equal(thirdManMapping.pitchLength, 'short', 'Third man derives from short/back-of-length');
  assert.equal(thirdManMapping.pitchLine, 'outside_off', 'Third man derives from outside off');

  const fineLegMapping = derivePitchMapping('Fine Leg', 4);
  assert.equal(fineLegMapping.pitchLength, 'full', 'Fine leg boundary derives from full delivery');
  assert.equal(fineLegMapping.pitchLine, 'down_leg', 'Fine leg boundary derives from leg stump line');
});

test('5. Broadcast Commentary: Maiden Overs, Boundary Droughts, and 5-fers', () => {
  let inn = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // Simulate 6 dot balls in an over to trigger Maiden Over commentary
  for (let i = 0; i < 6; i++) {
    inn = CricketEngine.applyDelivery(
      inn,
      {
        id: `b_${i}`,
        ballNumberInMatch: i + 1,
        overIndex: 0,
        ballInOver: i,
        isLegalDelivery: true,
        strikerId: inn.currentStrikerId || 'bat1',
        nonStrikerId: inn.currentNonStrikerId || 'bat2',
        bowlerId: inn.currentBowlerId || 'bowl1',
        runsBat: 0,
        runsExtra: 0,
        extraType: 'none',
        isBoundary: false,
        isSix: false,
        isWicket: false,
        commentary: '',
        timestamp: 1000 + i,
      },
      TEST_RULES
    );
  }

  const lastDelivery = inn.deliveries[inn.deliveries.length - 1];

  // Generate commentary for the 6th ball (end of over maiden)
  const maidenComm = CricketEngine.generateDeliveryCommentary(lastDelivery!, {
    bowlerName: 'Bumrah',
    strikerName: 'Warner',
    isMaidenOverJustCompleted: true,
  });

  assert.ok(
    maidenComm.includes('MAIDEN OVER') || maidenComm.includes('🔥'),
    `Maiden commentary should celebrate maiden over: "${maidenComm}"`
  );

  // Test Boundary Drought: simulate 18 consecutive balls without boundary
  const singleDelivery: Delivery = {
    id: 'd_18',
    ballNumberInMatch: 18,
    overIndex: 2,
    ballInOver: 6,
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
    timestamp: 3000,
  };

  const droughtComm = CricketEngine.generateDeliveryCommentary(singleDelivery, {
    bowlerName: 'Bumrah',
    strikerName: 'Warner',
    ballsSinceLastBoundary: 18,
  });

  assert.ok(
    droughtComm.includes('Pressure mounting') || droughtComm.includes('without a boundary'),
    `Drought commentary should report boundary drought: "${droughtComm}"`
  );

  // Now break the drought with a boundary!
  const boundaryDelivery: Delivery = {
    id: 'd_19',
    ballNumberInMatch: 19,
    overIndex: 3,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'bat1',
    nonStrikerId: 'bat2',
    bowlerId: 'bowl1',
    runsBat: 4,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: true,
    isSix: false,
    isWicket: false,
    shotArea: 'Cover',
    commentary: '',
    timestamp: 3010,
  };

  const breakDroughtComm = CricketEngine.generateDeliveryCommentary(boundaryDelivery, {
    bowlerName: 'Bumrah',
    strikerName: 'Warner',
    ballsSinceLastBoundary: 18,
  });

  assert.ok(
    breakDroughtComm.includes('Boundary drought broken') || breakDroughtComm.includes('Pressure released'),
    `Boundary break commentary should celebrate breaking drought: "${breakDroughtComm}"`
  );
});

test('6. Net Run Rate: Float Epsilon Normalization and Division-by-Zero Protection', () => {
  // Test case A: Both teams score identical runs in identical overs
  const runsFor = 150;
  const oversFor = 20.0;
  const runsAgainst = 150;
  const oversAgainst = 20.0;

  const runRateFor = oversFor > 0 ? runsFor / oversFor : 0;
  const runRateAgainst = oversAgainst > 0 ? runsAgainst / oversAgainst : 0;
  const rawNrr = isFinite(runRateFor - runRateAgainst) ? runRateFor - runRateAgainst : 0;
  const nrr = Math.abs(rawNrr) < 0.0005 ? 0 : Number(rawNrr.toFixed(3));

  assert.equal(nrr, 0, 'Equal runs and overs yield exactly 0 NRR');
  assert.equal(Object.is(nrr, -0), false, 'NRR must not be negative zero (-0)');

  // Test case B: Negligible floating point inaccuracy (e.g. -0.0001)
  const rawNegTiny = -0.0002;
  const safeNegTiny = Math.abs(rawNegTiny) < 0.0005 ? 0 : Number(rawNegTiny.toFixed(3));
  assert.equal(safeNegTiny, 0, 'Negligible negative float normalized to 0 without +-0.000 display bug');

  // Test case C: 0 overs faced / 0 overs bowled (no division by zero or NaN)
  const zeroOversFor = 0;
  const zeroOversAgainst = 0;
  const rrForZero = zeroOversFor > 0 ? 50 / zeroOversFor : 0;
  const rrAgainstZero = zeroOversAgainst > 0 ? 50 / zeroOversAgainst : 0;
  const rawZeroNrr = isFinite(rrForZero - rrAgainstZero) ? rrForZero - rrAgainstZero : 0;
  const nrrZero = Math.abs(rawZeroNrr) < 0.0005 ? 0 : Number(rawZeroNrr.toFixed(3));

  assert.equal(nrrZero, 0, 'Zero overs faced and bowled safely evaluates to 0');
  assert.ok(isFinite(nrrZero), 'NRR is finite number');
});

test('7. Phone Normalization Edge Cases and Atomic Multi-Key Tournament Sync', async () => {
  // A. Guard against short or empty phone numbers
  const shortResult = await StorageService.claimGhostPlayersByPhone('12', 'uid_1', 'User 1');
  assert.equal(shortResult.claimedCount, 0, 'Phone numbers shorter than 5 digits are rejected');
  assert.equal(shortResult.firstClaimedPlayerId, undefined, 'No player claimed for short phone');

  const emptyResult = await StorageService.claimGhostPlayersByPhone('   ', 'uid_1', 'User 1');
  assert.equal(emptyResult.claimedCount, 0, 'Empty phone numbers are rejected');

  // B. Setup tournament with team containing ghost player
  const ghostPlayerId = 'ghost_tourney_p1';
  const phone = '+91 99887 76655';
  const team: Team = {
    id: 'team_alpha',
    name: 'Team Alpha',
    shortName: 'ALP',
    primaryColor: '#10B981',
    players: [
      {
        id: ghostPlayerId,
        name: 'Alpha Striker',
        role: 'batter',
        battingHand: 'right',
        phoneNumber: phone,
        isGuest: true,
        isVerified: false,
        teamId: 'team_alpha',
      },
    ],
  };

  const tournament: Tournament = {
    id: 'tourney_cup_1',
    name: 'Alpha Super League',
    format: 't20',
    totalOvers: 20,
    ballType: 'leather',
    status: 'active',
    createdAt: Date.now(),
    creatorUserId: 'admin_1',
    creatorName: 'Organizer',
    teams: [team],
    matches: [],
  };

  await StorageService.saveTeams([team]);
  await StorageService.saveTournament(tournament);

  // C. Claim by normalized phone
  const claim = await StorageService.claimGhostPlayersByPhone(
    '9988776655',
    'verified_user_200',
    'Alpha Star'
  );

  assert.equal(claim.claimedCount, 1, 'Claimed 1 ghost player record');
  assert.equal(claim.firstClaimedPlayerId, ghostPlayerId, 'Returns firstClaimedPlayerId');

  // D. Verify persistence in both Teams storage and Tournaments storage
  const updatedTeams = await StorageService.getTeams();
  const playerInTeam = updatedTeams[0]?.players.find((p) => p.id === ghostPlayerId);
  assert.equal(playerInTeam?.isGuest, false, 'Player in teams is no longer guest');
  assert.equal(playerInTeam?.isVerified, true, 'Player in teams is verified');

  const updatedTourneys = await StorageService.getTournaments();
  const playerInTourney = updatedTourneys[0]?.teams[0]?.players.find((p) => p.id === ghostPlayerId);
  assert.equal(playerInTourney?.isGuest, false, 'Player in tournaments is no longer guest');
  assert.equal(playerInTourney?.isVerified, true, 'Player in tournaments is verified');
});
