import test from 'node:test';
import assert from 'node:assert/strict';
import { CricketEngine } from '../src/engine/cricketEngine';
import type { Match, Innings, Delivery, MatchRules } from '../src/types/cricket';

function createTestInnings(): Innings {
  return {
    inningsNumber: 1,
    battingTeamId: 't1',
    bowlingTeamId: 't2',
    totalRuns: 0,
    totalWickets: 0,
    legalBallsBowled: 0,
    oversFormatted: '0.0',
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
    deliveries: [],
    actions: [],
    batterStats: {
      p1: { playerId: 'p1', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, strikeRate: 0, isOut: false, battingOrder: 1 },
      p2: { playerId: 'p2', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, strikeRate: 0, isOut: false, battingOrder: 2 },
    },
    bowlerStats: {
      b1: { playerId: 'b1', legalBalls: 0, oversFormatted: '0.0', maidens: 0, runsConceded: 0, wickets: 0, economy: 0, wides: 0, noBalls: 0, dots: 0 },
    },
    fallOfWickets: [],
    initialStrikerId: 'p1',
    initialNonStrikerId: 'p2',
    initialBowlerId: 'b1',
    currentStrikerId: 'p1',
    currentNonStrikerId: 'p2',
    currentBowlerId: 'b1',
    isFreeHit: false,
    isCompleted: false,
  };
}

const defaultRules: MatchRules = {
  totalOvers: 20,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('A1: Pitch mapping Off must not invent pitch length, line, or coordinates', () => {
  const inn = createTestInnings();
  const delivery: Delivery = {
    id: 'd1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'b1',
    runsBat: 2,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: 'Two runs taken',
    timestamp: Date.now(),
    shotArea: 'Cover',
    pitchProvenance: 'unknown',
    // pitchLength, pitchLine, pitchCoord deliberately undefined because user set Pitch Mapping to OFF
  };

  const updated = CricketEngine.applyDelivery(inn, delivery, defaultRules);
  const recorded = updated.deliveries[0];

  assert.equal(recorded.shotArea, 'Cover');
  assert.equal(recorded.pitchProvenance, 'unknown');
  assert.equal(recorded.pitchLength, undefined, 'pitchLength must NOT be derived when mapping is Off/unknown');
  assert.equal(recorded.pitchLine, undefined, 'pitchLine must NOT be derived when mapping is Off/unknown');
  assert.equal(recorded.pitchCoord, undefined, 'pitchCoord must NOT be derived when mapping is Off/unknown');
});

test('A2: Structured command outcome accurately reports dismissal validity and vacant slot', () => {
  const inn = createTestInnings();

  // Test 1: Prohibited dismissal on a No-Ball (Bowled)
  const noBallBowled: Delivery = {
    id: 'd_nb',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 0,
    isLegalDelivery: false,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'b1',
    runsBat: 0,
    runsExtra: 1,
    extraType: 'noBall',
    isBoundary: false,
    isSix: false,
    isWicket: true,
    wicketDetails: {
      dismissalType: 'bowled',
      playerDismissedId: 'p1',
    },
    commentary: 'No-ball bowled',
    timestamp: Date.now(),
  };

  const result1 = CricketEngine.executeScoringCommand(inn, noBallBowled, defaultRules);
  assert.equal(result1.accepted, true);
  assert.equal(result1.wicketValid, false, 'Bowled on No-ball must be marked invalid');
  assert.equal(result1.isWicket, false);
  assert.equal(result1.vacantSlot, null, 'No batter replacement slot when wicket is negated');
  assert.equal(result1.needsNewBowler, false);

  // Test 2: Sixth-ball wicket prompts correct vacant slot and bowler change if innings continues
  let currentInn = createTestInnings();
  // Score 5 legal dots
  for (let b = 1; b <= 5; b++) {
    const dot: Delivery = {
      id: `dot_${b}`,
      ballNumberInMatch: b,
      overIndex: 0,
      ballInOver: b,
      isLegalDelivery: true,
      strikerId: 'p1',
      nonStrikerId: 'p2',
      bowlerId: 'b1',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: 'Dot ball',
      timestamp: Date.now(),
    };
    currentInn = CricketEngine.applyDelivery(currentInn, dot, defaultRules);
  }

  // 6th ball: Bowled (fair delivery)
  const ball6Wicket: Delivery = {
    id: 'b6_w',
    ballNumberInMatch: 6,
    overIndex: 0,
    ballInOver: 6,
    isLegalDelivery: true,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'b1',
    runsBat: 0,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: true,
    wicketDetails: {
      dismissalType: 'bowled',
      playerDismissedId: 'p1',
    },
    commentary: 'Bowled clean!',
    timestamp: Date.now(),
  };

  const result2 = CricketEngine.executeScoringCommand(currentInn, ball6Wicket, defaultRules);
  assert.equal(result2.wicketValid, true);
  assert.equal(result2.isWicket, true);
  assert.equal(result2.isOverComplete, true, '6th ball completes over');
  assert.equal(result2.needsNewBowler, true, 'Over completed, needs new bowler');
  assert.ok(result2.vacantSlot === 'striker' || result2.vacantSlot === 'nonStriker');

  // Test 3: Innings completion (final over or all out) does NOT request a new bowler
  const singleOverRules: MatchRules = {
    ...defaultRules,
    totalOvers: 1, // Only 1 over match
  };
  const result3 = CricketEngine.executeScoringCommand(currentInn, ball6Wicket, singleOverRules);
  assert.equal(result3.isInningsComplete, true, '1-over match is complete after over 1');
  assert.equal(result3.needsNewBowler, false, 'Completed innings must not request a new bowler');
});

test('A5: Complete cricket combinations: Compound extras, 4 completed runs, and Law 39.1 Wide Stumping', () => {
  const inn = createTestInnings();

  // 1. No-Ball + 4 off bat
  const nbFour: Delivery = {
    id: 'nb4',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 0,
    isLegalDelivery: false,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'b1',
    runsBat: 4,
    runsExtra: 1,
    extraType: 'noBall',
    extrasDetail: { noBall: 1 },
    isBoundary: true,
    isSix: false,
    isWicket: false,
    commentary: 'No-ball and smashed for four!',
    timestamp: Date.now(),
  };

  const innAfterNb4 = CricketEngine.applyDelivery(inn, nbFour, defaultRules);
  assert.equal(innAfterNb4.totalRuns, 5, 'Team gets 1 no-ball + 4 bat = 5');
  assert.equal(innAfterNb4.batterStats['p1'].runs, 4);
  assert.equal(innAfterNb4.batterStats['p1'].fours, 1);
  assert.equal(innAfterNb4.bowlerStats['b1'].runsConceded, 5);

  // 2. Wide + Stumping (MCC Law 39.1 on a regular delivery)
  const freshInn = createTestInnings();
  const wideStump: Delivery = {
    id: 'ws1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 0,
    isLegalDelivery: false,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'b1',
    runsBat: 0,
    runsExtra: 1,
    extraType: 'wide',
    extrasDetail: { wide: 1 },
    isBoundary: false,
    isSix: false,
    isWicket: true,
    wicketDetails: {
      dismissalType: 'stumped',
      playerDismissedId: 'p1',
      fielderId: 'keeper1',
    },
    commentary: 'Wide and stumped down the leg side!',
    timestamp: Date.now(),
  };

  const outcomeStump = CricketEngine.executeScoringCommand(freshInn, wideStump, defaultRules);
  assert.equal(outcomeStump.wicketValid, true, 'Stumped on wide is legal under MCC Law 39.1');
  assert.equal(outcomeStump.innings.totalWickets, 1);
  assert.equal(outcomeStump.innings.bowlerStats['b1'].wickets, 1, 'Bowler credited for stumping');

  // 3. Four physically completed runs (NOT a boundary)
  const fourRunPhys: Delivery = {
    id: 'r4_phys',
    ballNumberInMatch: 3,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'p2', // p2 facing after p1 was out
    nonStrikerId: 'p3',
    bowlerId: 'b1',
    runsBat: 4,
    runsExtra: 0,
    extraType: 'none',
    physicalRunsRan: 4,
    isBoundary: false, // NOT a boundary rope hit
    isSix: false,
    isWicket: false,
    commentary: 'Misfield allows four runs run between wickets',
    timestamp: Date.now(),
  };

  const innAfterPhys4 = CricketEngine.applyDelivery(outcomeStump.innings, fourRunPhys, defaultRules);
  assert.equal(innAfterPhys4.batterStats['p2'].runs, 4);
  assert.equal(innAfterPhys4.batterStats['p2'].fours, 0, 'No boundary four credited for completed physical runs');
  assert.equal(innAfterPhys4.currentStrikerId, 'p2', 'Even number of completed runs leaves striker at same end');
});
