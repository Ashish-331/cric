import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CricketEngine, createInitialInnings } from '../src/engine/cricketEngine';
import type { Delivery, MatchRules } from '../src/types/cricket';

const standardRules: MatchRules = {
  totalOvers: 20,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('CRIC-001: Undo fails to restore original striker after single', () => {
  const innings = createInitialInnings(1, 't1', 't2', 's1', 's2', 'b1');
  const d1: Delivery = {
    id: 'd1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 's1',
    nonStrikerId: 's2',
    bowlerId: 'b1',
    runsBat: 1,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: 'Single taken',
    timestamp: 1000,
  };

  const afterD1 = CricketEngine.applyDelivery(innings, d1, standardRules);
  assert.equal(afterD1.currentStrikerId, 's2', 'After single, s2 should be on strike');
  assert.equal(afterD1.currentNonStrikerId, 's1', 's1 should be non-striker');

  // Now undo: replay with 0 deliveries
  const afterUndo = CricketEngine.replayInnings(afterD1, [], standardRules);
  assert.equal(afterUndo.currentStrikerId, 's1', 'After undoing the only ball, original striker s1 MUST be restored');
  assert.equal(afterUndo.currentNonStrikerId, 's2', 'Original non-striker s2 MUST be restored');
  assert.equal(afterUndo.totalRuns, 0, 'Runs must be 0');
  assert.equal(afterUndo.batterStats['s1']?.runs, 0, 's1 runs must be 0');
});

test('CRIC-002: Boundary byes must not increment batter fours or bowler concessions', () => {
  const innings = createInitialInnings(1, 't1', 't2', 's1', 's2', 'b1');
  const fourByes: Delivery = {
    id: 'd1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 's1',
    nonStrikerId: 's2',
    bowlerId: 'b1',
    runsBat: 0,
    runsExtra: 4,
    extraType: 'bye',
    isBoundary: true, // four byes to the fence
    isSix: false,
    isWicket: false,
    commentary: 'Four byes',
    timestamp: 1000,
  };

  const result = CricketEngine.applyDelivery(innings, fourByes, standardRules);

  assert.equal(result.totalRuns, 4, 'Team runs should be 4');
  assert.equal(result.extras.byes, 4, 'Byes should be 4');
  assert.equal(result.batterStats['s1']?.runs, 0, 'Batter runs must be 0');
  assert.equal(result.batterStats['s1']?.fours, 0, 'Batter fours MUST be 0 on four byes');
  assert.equal(result.bowlerStats['b1']?.runsConceded, 0, 'Bowler conceded runs must be 0 for byes');
});

test('CRIC-003: Bowled on a current No-Ball must be prohibited and negated', () => {
  const innings = createInitialInnings(1, 't1', 't2', 's1', 's2', 'b1');
  // First ball is a No-Ball (not preceded by Free Hit)
  const noBallBowled: Delivery = {
    id: 'd1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 0,
    isLegalDelivery: false,
    strikerId: 's1',
    nonStrikerId: 's2',
    bowlerId: 'b1',
    runsBat: 0,
    runsExtra: 1,
    extraType: 'noBall',
    isBoundary: false,
    isSix: false,
    isWicket: true,
    wicketDetails: {
      dismissalType: 'bowled',
      playerDismissedId: 's1',
      bowlerId: 'b1',
    },
    commentary: 'No ball and bowled',
    timestamp: 1000,
  };

  const result = CricketEngine.applyDelivery(innings, noBallBowled, standardRules);

  assert.equal(result.totalWickets, 0, 'A batter CANNOT be out bowled on a No-Ball (MCC Law 21.19)');
  assert.equal(result.bowlerStats['b1']?.wickets, 0, 'Bowler must NOT be credited with a wicket');
  assert.equal(result.batterStats['s1']?.isOut, false, 'Batter must NOT be out');
  assert.equal(result.currentStrikerId, 's1', 'Striker slot must not be vacated');
});

test('CRIC-004: Hit the ball twice must NOT credit the bowler', () => {
  const innings = createInitialInnings(1, 't1', 't2', 's1', 's2', 'b1');
  const hitBallTwice: Delivery = {
    id: 'd1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 's1',
    nonStrikerId: 's2',
    bowlerId: 'b1',
    runsBat: 0,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: true,
    wicketDetails: {
      dismissalType: 'hit_twice',
      playerDismissedId: 's1',
    },
    commentary: 'Out hit the ball twice',
    timestamp: 1000,
  };

  const result = CricketEngine.applyDelivery(innings, hitBallTwice, standardRules);

  assert.equal(result.totalWickets, 1, 'Team wickets should be 1');
  assert.equal(result.batterStats['s1']?.isOut, true, 'Batter is out');
  assert.equal(result.bowlerStats['b1']?.wickets, 0, 'Hit the ball twice MUST NOT credit the bowler');
});

test('CRIC-006: Compound extras (No-ball + 2 Byes) attribution', () => {
  const innings = createInitialInnings(1, 't1', 't2', 's1', 's2', 'b1');
  const noBallWithByes: Delivery = {
    id: 'd1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 0,
    isLegalDelivery: false,
    strikerId: 's1',
    nonStrikerId: 's2',
    bowlerId: 'b1',
    runsBat: 0,
    runsExtra: 3, // 1 NB penalty + 2 Byes
    extraType: 'noBall',
    extrasDetail: {
      noBall: 1,
      bye: 2,
    },
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: 'No ball + 2 byes',
    timestamp: 1000,
  };

  const result = CricketEngine.applyDelivery(innings, noBallWithByes, standardRules);

  assert.equal(result.totalRuns, 3, 'Total runs should be 3');
  assert.equal(result.extras.noBalls, 1, 'No-balls should be 1');
  assert.equal(result.extras.byes, 2, 'Byes should be 2');
  assert.equal(result.bowlerStats['b1']?.runsConceded, 1, 'Bowler should only be charged the 1 No-ball run, not the byes');
});

test('CRIC-005: Retirement between deliveries must not manufacture a delivery or increment balls faced', () => {
  const innings = createInitialInnings(1, 't1', 't2', 's1', 's2', 'b1');
  
  // Explicit non-delivery action
  const afterRetire = CricketEngine.retireBatter(innings, 's1', 'retired_hurt', 1000);
  
  assert.equal(afterRetire.deliveries.length, 0, 'No deliveries should be manufactured');
  assert.equal(afterRetire.legalBallsBowled, 0, 'Legal balls bowled must remain 0');
  assert.equal(afterRetire.totalRuns, 0, 'Total runs must remain 0');
  assert.equal(afterRetire.totalWickets, 0, 'Retired hurt must NOT increment total wickets');
  assert.equal(afterRetire.batterStats['s1']?.ballsFaced, 0, 'Striker balls faced must remain 0');
  assert.equal(afterRetire.batterStats['s1']?.isOut, false, 'Retired hurt batter is NOT out');
  assert.equal(afterRetire.currentStrikerId, undefined, 'Crease slot must be vacated for incoming batter');
  assert.equal(afterRetire.bowlerStats['b1']?.legalBalls, 0, 'Bowler legal balls must remain 0');
});
