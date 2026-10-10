import test from 'node:test';
import assert from 'node:assert/strict';
import { CricketEngine, createInitialInnings } from '../src/engine/cricketEngine';
import type { MatchRules, Delivery } from '../src/types/cricket';

const RULES: MatchRules = {
  totalOvers: 20,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('Cricket Depth: Free Hit state machine, dismissal negations, and carry-over', () => {
  let inn = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // 1. Delivery 1: No-Ball (extraType: 'noBall', 1 run extra, 1 run bat)
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd1',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 0,
      isLegalDelivery: false,
      strikerId: 'bat1',
      nonStrikerId: 'bat2',
      bowlerId: 'bowl1',
      runsBat: 1,
      runsExtra: 1,
      extraType: 'noBall',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: '',
      timestamp: 1001,
    },
    RULES
  );

  // Assert: Next ball MUST be Free Hit!
  assert.equal(inn.isFreeHit, true, 'Next ball must have isFreeHit active after No-Ball');
  assert.equal(inn.legalBallsBowled, 0, 'No-ball is illegal, legal balls count stays 0');

  // 2. Delivery 2 (Free Hit): Bowler bowls the batsman! Bowled must be NEGATED per Law 21.19
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd2',
      ballNumberInMatch: 2,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'bat2', // rotated on odd run
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
      timestamp: 1002,
    },
    RULES
  );

  // Bowled on Free Hit must be negated:
  assert.equal(inn.totalWickets, 0, 'Bowled on Free Hit must NOT increment wickets');
  assert.equal(inn.fallOfWickets.length, 0, 'No entry in fall of wickets for negated dismissal');
  assert.equal(inn.batterStats['bat2'].isOut, false, 'Batsman must remain NOT OUT');
  assert.equal(inn.isFreeHit, false, 'Free Hit expires after a legal delivery');

  // 3. Trigger another Free Hit: No-Ball
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd3',
      ballNumberInMatch: 3,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: false,
      strikerId: 'bat2',
      nonStrikerId: 'bat1',
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
    RULES
  );
  assert.equal(inn.isFreeHit, true, 'Free hit active after No-ball');

  // 4. On the Free Hit delivery, bowler bowls a WIDE!
  // Free Hit MUST carry over!
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd4',
      ballNumberInMatch: 4,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: false,
      strikerId: 'bat2',
      nonStrikerId: 'bat1',
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
    RULES
  );
  assert.equal(inn.isFreeHit, true, 'Free hit MUST carry over after a wide delivery');

  // 5. On the carried-over Free Hit, a RUN OUT occurs!
  // Run Out IS permitted on Free Hit!
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'd5',
      ballNumberInMatch: 5,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: true,
      strikerId: 'bat2',
      nonStrikerId: 'bat1',
      bowlerId: 'bowl1',
      runsBat: 1,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: true,
      wicketDetails: {
        dismissalType: 'run_out',
        playerDismissedId: 'bat2',
        fielderId: 'fld1',
      },
      commentary: '',
      timestamp: 1005,
    },
    RULES
  );

  assert.equal(inn.totalWickets, 1, 'Run Out ON Free Hit MUST increment wickets lost');
  assert.equal(inn.fallOfWickets.length, 1, 'Fall of wicket recorded for run out');
  assert.equal(inn.batterStats['bat2'].isOut, true, 'Dismissed batter marked out');
  assert.equal(inn.isFreeHit, false, 'Free Hit expires after legal ball');
});

test('Cricket Depth: MCC Law 25.4 Retired Hurt vs Retired Out handling', () => {
  let inn = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // 1. bat1 retires hurt on ball 1
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'rh1',
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
    RULES
  );

  // MCC Law 25.4: Retired Hurt does NOT count as a wicket lost!
  assert.equal(inn.totalWickets, 0, 'Retired hurt must NOT increment total wickets');
  assert.equal(inn.fallOfWickets.length, 0, 'Retired hurt must NOT add to fallOfWickets');
  assert.equal(inn.batterStats['bat1'].isOut, false, 'Retired hurt batsman remains not out in stats');
  assert.equal(inn.currentStrikerId, undefined, 'Crease slot is cleared for incoming batter');

  // New batsman takes strike
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

  // 2. bat3 retires OUT on ball 2
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'ro1',
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
    RULES
  );

  // Retired Out DOES count as a dismissal!
  assert.equal(inn.totalWickets, 1, 'Retired out MUST increment total wickets');
  assert.equal(inn.fallOfWickets.length, 1, 'Retired out adds to fallOfWickets');
  assert.equal(inn.batterStats['bat3'].isOut, true, 'Retired out marks batsman as out');
});

test('Cricket Depth: Delivery metadata preservation (shotArea, bowlingSide)', () => {
  let inn = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'meta1',
      ballNumberInMatch: 1,
      overIndex: 0,
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
      bowlingSide: 'round',
      commentary: '',
      timestamp: 3001,
    },
    RULES
  );

  const recorded = inn.deliveries[0];
  assert.equal(recorded.shotArea, 'Cover', 'Shot area must be preserved in delivery record');
  assert.equal(recorded.bowlingSide, 'round', 'Bowling side must be preserved in delivery record');
  assert.ok(recorded.commentary.includes('Cover') || recorded.commentary.includes('FOUR'), 'Commentary contains context');
});

test('Cricket Depth: Replay innings preserves opening batters and bowler baseline when undone to 0 deliveries', () => {
  const initial = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // Score 1 delivery
  const delivery: Delivery = {
    id: 'd1',
    ballNumberInMatch: 1,
    overIndex: 0,
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
    commentary: 'Cracking 4',
    timestamp: 4001,
  };

  const inningsAfter1Ball = CricketEngine.applyDelivery(initial, delivery, RULES);
  assert.equal(inningsAfter1Ball.totalRuns, 4);
  assert.equal(inningsAfter1Ball.batterStats['bat1'].runs, 4);

  // Now simulate 1-tap Undo back to 0 deliveries
  const undoneInnings = CricketEngine.replayInnings(initial, [], RULES);
  assert.equal(undoneInnings.totalRuns, 0);
  assert.equal(undoneInnings.deliveries.length, 0);
  assert.ok(undoneInnings.batterStats['bat1'], 'Opening striker must be preserved in batterStats');
  assert.equal(undoneInnings.batterStats['bat1'].runs, 0);
  assert.equal(undoneInnings.batterStats['bat1'].ballsFaced, 0);
  assert.ok(undoneInnings.batterStats['bat2'], 'Opening non-striker must be preserved in batterStats');
  assert.equal(undoneInnings.batterStats['bat2'].runs, 0);
  assert.ok(undoneInnings.bowlerStats['bowl1'], 'Opening bowler must be preserved in bowlerStats');
  assert.equal(undoneInnings.bowlerStats['bowl1'].legalBalls, 0);
  assert.equal(undoneInnings.bowlerStats['bowl1'].oversFormatted, '0.0');
});
