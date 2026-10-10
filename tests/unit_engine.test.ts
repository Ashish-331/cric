import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CricketEngine,
  createInitialInnings,
  formatOvers,
  calculateRunRate,
  calculateRequiredRunRate,
} from '../src/engine/cricketEngine';
import type { Delivery, Innings, MatchRules, Match } from '../src/types/cricket';

const DEFAULT_RULES: MatchRules = {
  totalOvers: 20,
  maxOversPerBowler: 4,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('1. formatOvers, calculateRunRate, and calculateRequiredRunRate calculations', () => {
  assert.equal(formatOvers(0), '0.0');
  assert.equal(formatOvers(1), '0.1');
  assert.equal(formatOvers(5), '0.5');
  assert.equal(formatOvers(6), '1.0');
  assert.equal(formatOvers(11), '1.5');
  assert.equal(formatOvers(12), '2.0');

  assert.equal(calculateRunRate(0, 0), 0);
  assert.equal(calculateRunRate(36, 36), 6.0);
  assert.equal(calculateRunRate(85, 60), 8.5);

  assert.equal(calculateRequiredRunRate(60, 60), 6.0);
  assert.equal(calculateRequiredRunRate(0, 30), 0);
  assert.equal(calculateRequiredRunRate(10, 0), 99.99);
});

test('2. Ball-by-ball scoring: dot ball, singles, boundaries, sixes', () => {
  const innings = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // Dot ball
  const dotDelivery: Delivery = {
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
    commentary: 'Dot ball',
    timestamp: 1000,
  };

  const state1 = CricketEngine.applyDelivery(innings, dotDelivery, DEFAULT_RULES);
  assert.equal(state1.totalRuns, 0);
  assert.equal(state1.legalBallsBowled, 1);
  assert.equal(state1.oversFormatted, '0.1');
  assert.equal(state1.batterStats['bat1'].runs, 0);
  assert.equal(state1.batterStats['bat1'].ballsFaced, 1);
  assert.equal(state1.batterStats['bat1'].strikeRate, 0);
  assert.equal(state1.bowlerStats['bowl1'].dots, 1);
  assert.equal(state1.bowlerStats['bowl1'].runsConceded, 0);
  assert.equal(state1.bowlerStats['bowl1'].legalBalls, 1);
  assert.equal(state1.currentStrikerId, 'bat1', 'Strike remains on dot ball');

  // Single (1 run) -> strike rotates!
  const singleDelivery: Delivery = {
    id: 'd2',
    ballNumberInMatch: 2,
    overIndex: 0,
    ballInOver: 2,
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
    commentary: 'Single',
    timestamp: 1001,
  };
  const state2 = CricketEngine.applyDelivery(state1, singleDelivery, DEFAULT_RULES);
  assert.equal(state2.totalRuns, 1);
  assert.equal(state2.legalBallsBowled, 2);
  assert.equal(state2.batterStats['bat1'].runs, 1);
  assert.equal(state2.batterStats['bat1'].ballsFaced, 2);
  assert.equal(state2.batterStats['bat1'].strikeRate, 50.0);
  assert.equal(state2.currentStrikerId, 'bat2', 'Strike rotates to bat2 on single');
  assert.equal(state2.currentNonStrikerId, 'bat1');

  // Boundary (4 runs) -> strike does NOT rotate!
  const fourDelivery: Delivery = {
    id: 'd3',
    ballNumberInMatch: 3,
    overIndex: 0,
    ballInOver: 3,
    isLegalDelivery: true,
    strikerId: 'bat2',
    nonStrikerId: 'bat1',
    bowlerId: 'bowl1',
    runsBat: 4,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: true,
    isSix: false,
    isWicket: false,
    commentary: 'Four!',
    timestamp: 1002,
  };
  const state3 = CricketEngine.applyDelivery(state2, fourDelivery, DEFAULT_RULES);
  assert.equal(state3.totalRuns, 5);
  assert.equal(state3.batterStats['bat2'].runs, 4);
  assert.equal(state3.batterStats['bat2'].fours, 1);
  assert.equal(state3.batterStats['bat2'].strikeRate, 400.0);
  assert.equal(state3.currentStrikerId, 'bat2', 'Strike stays on bat2 on boundary');

  // Six (6 runs) -> strike does NOT rotate!
  const sixDelivery: Delivery = {
    id: 'd4',
    ballNumberInMatch: 4,
    overIndex: 0,
    ballInOver: 4,
    isLegalDelivery: true,
    strikerId: 'bat2',
    nonStrikerId: 'bat1',
    bowlerId: 'bowl1',
    runsBat: 6,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: true,
    isWicket: false,
    commentary: 'Six!',
    timestamp: 1003,
  };
  const state4 = CricketEngine.applyDelivery(state3, sixDelivery, DEFAULT_RULES);
  assert.equal(state4.totalRuns, 11);
  assert.equal(state4.batterStats['bat2'].runs, 10);
  assert.equal(state4.batterStats['bat2'].sixes, 1);
  assert.equal(state4.currentStrikerId, 'bat2', 'Strike stays on bat2 on six');
});

test('3. Ball-by-ball scoring: Wides, No-Balls, Byes, and Leg-Byes', () => {
  const innings = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // Standard Wide: +1 extra, 0 legal balls, balls faced unchanged
  const wideDelivery: Delivery = {
    id: 'w1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 0,
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
    commentary: 'Wide ball',
    timestamp: 1000,
  };
  const sWide = CricketEngine.applyDelivery(innings, wideDelivery, DEFAULT_RULES);
  assert.equal(sWide.totalRuns, 1);
  assert.equal(sWide.extras.wides, 1);
  assert.equal(sWide.extras.total, 1);
  assert.equal(sWide.legalBallsBowled, 0);
  assert.equal(sWide.batterStats['bat1'].ballsFaced, 0, 'Wide does not count as ball faced');
  assert.equal(sWide.bowlerStats['bowl1'].wides, 1);
  assert.equal(sWide.bowlerStats['bowl1'].runsConceded, 1);
  assert.equal(sWide.currentStrikerId, 'bat1');

  // Wide with 1 physical run running between wickets (total 2 runsExtra) -> rotates strike!
  const wideRunDelivery: Delivery = {
    id: 'w2',
    ballNumberInMatch: 2,
    overIndex: 0,
    ballInOver: 0,
    isLegalDelivery: false,
    strikerId: 'bat1',
    nonStrikerId: 'bat2',
    bowlerId: 'bowl1',
    runsBat: 0,
    runsExtra: 2,
    extraType: 'wide',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: 'Wide + 1 run',
    timestamp: 1001,
  };
  const sWideRun = CricketEngine.applyDelivery(sWide, wideRunDelivery, DEFAULT_RULES);
  assert.equal(sWideRun.totalRuns, 3);
  assert.equal(sWideRun.currentStrikerId, 'bat2', 'Strike rotated because 1 physical run was taken on wide');

  // No-Ball with 2 runs off the bat: 1 extra + 2 bat = 3 runs total, legal ball unchanged, batter faced +1
  const noBallDelivery: Delivery = {
    id: 'nb1',
    ballNumberInMatch: 3,
    overIndex: 0,
    ballInOver: 0,
    isLegalDelivery: false,
    strikerId: 'bat2',
    nonStrikerId: 'bat1',
    bowlerId: 'bowl1',
    runsBat: 2,
    runsExtra: 1,
    extraType: 'noBall',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: 'No-ball + 2 runs',
    timestamp: 1002,
  };
  const sNb = CricketEngine.applyDelivery(sWideRun, noBallDelivery, DEFAULT_RULES);
  assert.equal(sNb.totalRuns, 6);
  assert.equal(sNb.extras.noBalls, 1);
  assert.equal(sNb.batterStats['bat2'].runs, 2);
  assert.equal(sNb.batterStats['bat2'].ballsFaced, 1, 'No ball with bat contact counts as ball faced');
  assert.equal(sNb.bowlerStats['bowl1'].noBalls, 1);
  assert.equal(sNb.bowlerStats['bowl1'].runsConceded, 6);
  assert.equal(sNb.currentStrikerId, 'bat2', 'Even runs bat so strike remains');

  // Leg-Byes (1 extra): legal ball counts, batter faced +1, bowler runsConceded does NOT increase!
  const legByeDelivery: Delivery = {
    id: 'lb1',
    ballNumberInMatch: 4,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'bat2',
    nonStrikerId: 'bat1',
    bowlerId: 'bowl1',
    runsBat: 0,
    runsExtra: 1,
    extraType: 'legBye',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: '1 Leg bye',
    timestamp: 1003,
  };
  const sLb = CricketEngine.applyDelivery(sNb, legByeDelivery, DEFAULT_RULES);
  assert.equal(sLb.totalRuns, 7);
  assert.equal(sLb.extras.legByes, 1);
  assert.equal(sLb.legalBallsBowled, 1);
  assert.equal(sLb.batterStats['bat2'].ballsFaced, 2);
  assert.equal(sLb.bowlerStats['bowl1'].runsConceded, 6, 'Leg byes are NOT charged to the bowler');
  assert.equal(sLb.currentStrikerId, 'bat1', 'Strike rotated on 1 leg bye');

  // Byes (2 extras): legal ball counts, batter faced +1, bowler runsConceded does NOT increase
  const byeDelivery: Delivery = {
    id: 'b1',
    ballNumberInMatch: 5,
    overIndex: 0,
    ballInOver: 2,
    isLegalDelivery: true,
    strikerId: 'bat1',
    nonStrikerId: 'bat2',
    bowlerId: 'bowl1',
    runsBat: 0,
    runsExtra: 2,
    extraType: 'bye',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: '2 Byes',
    timestamp: 1004,
  };
  const sBye = CricketEngine.applyDelivery(sLb, byeDelivery, DEFAULT_RULES);
  assert.equal(sBye.totalRuns, 9);
  assert.equal(sBye.extras.byes, 2);
  assert.equal(sBye.legalBallsBowled, 2);
  assert.equal(sBye.bowlerStats['bowl1'].runsConceded, 6, 'Byes are NOT charged to the bowler');
  assert.equal(sBye.currentStrikerId, 'bat1', '2 byes (even) means strike does not rotate');
});

test('4. End of over strike rotation: 6th ball single vs 6th ball dot', () => {
  // Scenario A: 6th ball single
  // Over balls 1-5 dots. Ball 6 single.
  // Batter 1 faces ball 6, takes single (swaps to non-striker), then over finishes (ends switch), so Batter 1 keeps strike!
  let innA = createInitialInnings(1, 'tA', 'tB', 'bat1', 'bat2', 'bowl1');
  for (let i = 1; i <= 5; i++) {
    innA = CricketEngine.applyDelivery(
      innA,
      {
        id: `d_a_${i}`,
        ballNumberInMatch: i,
        overIndex: 0,
        ballInOver: i,
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
        commentary: 'Dot',
        timestamp: 1000 + i,
      },
      DEFAULT_RULES
    );
  }
  assert.equal(innA.currentStrikerId, 'bat1');
  assert.equal(innA.legalBallsBowled, 5);

  // Ball 6 single
  innA = CricketEngine.applyDelivery(
    innA,
    {
      id: 'd_a_6',
      ballNumberInMatch: 6,
      overIndex: 0,
      ballInOver: 6,
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
      commentary: 'Single on last ball',
      timestamp: 1006,
    },
    DEFAULT_RULES
  );
  assert.equal(innA.legalBallsBowled, 6);
  assert.equal(innA.oversFormatted, '1.0');
  assert.equal(
    innA.currentStrikerId,
    'bat1',
    'Batter 1 single on 6th ball + over change = Batter 1 faces first ball of over 2'
  );
  assert.equal(innA.currentNonStrikerId, 'bat2');

  // Scenario B: 6th ball dot
  // Batter 1 faces ball 6, dot ball. Ends switch at over completion -> Batter 2 is on strike for over 2!
  let innB = createInitialInnings(1, 'tA', 'tB', 'bat1', 'bat2', 'bowl1');
  for (let i = 1; i <= 6; i++) {
    innB = CricketEngine.applyDelivery(
      innB,
      {
        id: `d_b_${i}`,
        ballNumberInMatch: i,
        overIndex: 0,
        ballInOver: i,
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
        commentary: 'Dot',
        timestamp: 2000 + i,
      },
      DEFAULT_RULES
    );
  }
  assert.equal(innB.legalBallsBowled, 6);
  assert.equal(innB.oversFormatted, '1.0');
  assert.equal(
    innB.currentStrikerId,
    'bat2',
    'Dot on 6th ball means partner (bat2) faces next over'
  );
  assert.equal(innB.currentNonStrikerId, 'bat1');
});

test('5. 6th-ball wicket transition: over completion and batsman slot clearing', () => {
  let inn = createInitialInnings(1, 'tA', 'tB', 'bat1', 'bat2', 'bowl1');
  // First 5 balls dots
  for (let i = 1; i <= 5; i++) {
    inn = CricketEngine.applyDelivery(
      inn,
      {
        id: `del_${i}`,
        ballNumberInMatch: i,
        overIndex: 0,
        ballInOver: i,
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
        commentary: 'Dot',
        timestamp: 3000 + i,
      },
      DEFAULT_RULES
    );
  }

  // 6th ball: WICKET! bat1 is clean bowled!
  const wicketDelivery: Delivery = {
    id: 'del_6_wkt',
    ballNumberInMatch: 6,
    overIndex: 0,
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
    isWicket: true,
    wicketDetails: {
      dismissalType: 'bowled',
      playerDismissedId: 'bat1',
      bowlerId: 'bowl1',
    },
    commentary: 'BOWLED HIM!',
    timestamp: 3006,
  };

  const stateWkt = CricketEngine.applyDelivery(inn, wicketDelivery, DEFAULT_RULES);

  assert.equal(stateWkt.legalBallsBowled, 6);
  assert.equal(stateWkt.oversFormatted, '1.0');
  assert.equal(stateWkt.totalWickets, 1);
  assert.equal(stateWkt.fallOfWickets.length, 1);
  assert.equal(stateWkt.fallOfWickets[0].playerDismissedId, 'bat1');
  assert.equal(stateWkt.batterStats['bat1'].isOut, true);
  assert.equal(stateWkt.bowlerStats['bowl1'].wickets, 1);

  // Verification of 6th-ball transition:
  // Since bat1 was dismissed on 6th ball, ends switch for next over:
  // Surviving partner (bat2) is now the striker facing for over 2!
  assert.equal(
    stateWkt.currentStrikerId,
    'bat2',
    'Surviving partner moves to strike for new over'
  );
  assert.equal(
    stateWkt.currentNonStrikerId,
    undefined,
    'Non-striker slot is vacant awaiting incoming batter selection'
  );
});

test('6. Maidens calculation for Bowler', () => {
  let inn = createInitialInnings(1, 'tA', 'tB', 'bat1', 'bat2', 'bowl1');
  // Bowler 1 bowls 6 legal dots in over 0
  for (let i = 1; i <= 6; i++) {
    inn = CricketEngine.applyDelivery(
      inn,
      {
        id: `m_${i}`,
        ballNumberInMatch: i,
        overIndex: 0,
        ballInOver: i,
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
        commentary: 'Dot',
        timestamp: 4000 + i,
      },
      DEFAULT_RULES
    );
  }

  assert.equal(inn.bowlerStats['bowl1'].maidens, 1, '6 dots = 1 maiden over');
  assert.equal(inn.bowlerStats['bowl1'].economy, 0.0);

  // In over 1, Bowler 2 bowls 5 dots and 1 wide
  inn.currentBowlerId = 'bowl2';
  for (let i = 1; i <= 5; i++) {
    inn = CricketEngine.applyDelivery(
      inn,
      {
        id: `b2_${i}`,
        ballNumberInMatch: 6 + i,
        overIndex: 1,
        ballInOver: i,
        isLegalDelivery: true,
        strikerId: 'bat2',
        nonStrikerId: 'bat1',
        bowlerId: 'bowl2',
        runsBat: 0,
        runsExtra: 0,
        extraType: 'none',
        isBoundary: false,
        isSix: false,
        isWicket: false,
        commentary: 'Dot',
        timestamp: 4010 + i,
      },
      DEFAULT_RULES
    );
  }
  // Ball with wide
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'b2_wide',
      ballNumberInMatch: 12,
      overIndex: 1,
      ballInOver: 5,
      isLegalDelivery: false,
      strikerId: 'bat2',
      nonStrikerId: 'bat1',
      bowlerId: 'bowl2',
      runsBat: 0,
      runsExtra: 1,
      extraType: 'wide',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: 'Wide',
      timestamp: 4016,
    },
    DEFAULT_RULES
  );
  // Legal 6th ball dot
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'b2_legal6',
      ballNumberInMatch: 13,
      overIndex: 1,
      ballInOver: 6,
      isLegalDelivery: true,
      strikerId: 'bat2',
      nonStrikerId: 'bat1',
      bowlerId: 'bowl2',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: 'Dot',
      timestamp: 4017,
    },
    DEFAULT_RULES
  );

  assert.equal(inn.bowlerStats['bowl2'].maidens, 0, 'Wide in over prevents maiden');
  assert.equal(inn.bowlerStats['bowl2'].runsConceded, 1);
});

test('7. 100% deterministic 1-tap Undo restoring state', () => {
  const initial = createInitialInnings(1, 'tA', 'tB', 'bat1', 'bat2', 'bowl1');

  const del1: Delivery = {
    id: 'd1',
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
    commentary: '1 run',
    timestamp: 5001,
  };

  const del2: Delivery = {
    id: 'd2',
    ballNumberInMatch: 2,
    overIndex: 0,
    ballInOver: 2,
    isLegalDelivery: true,
    strikerId: 'bat2',
    nonStrikerId: 'bat1',
    bowlerId: 'bowl1',
    runsBat: 4,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: true,
    isSix: false,
    isWicket: false,
    commentary: 'Boundary four',
    timestamp: 5002,
  };

  const del3: Delivery = {
    id: 'd3',
    ballNumberInMatch: 3,
    overIndex: 0,
    ballInOver: 3,
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
      dismissalType: 'caught',
      playerDismissedId: 'bat2',
      bowlerId: 'bowl1',
      fielderId: 'fld1',
    },
    commentary: 'Caught at mid-on',
    timestamp: 5003,
  };

  const step1 = CricketEngine.applyDelivery(initial, del1, DEFAULT_RULES);
  const step2 = CricketEngine.applyDelivery(step1, del2, DEFAULT_RULES);
  const step3 = CricketEngine.applyDelivery(step2, del3, DEFAULT_RULES);

  assert.equal(step3.totalRuns, 5);
  assert.equal(step3.totalWickets, 1);
  assert.equal(step3.batterStats['bat2'].isOut, true);
  assert.equal(step3.bowlerStats['bowl1'].wickets, 1);

  // Undo Ball 3 (Wicket)
  const undoneBall3 = CricketEngine.replayInnings(
    initial,
    [del1, del2],
    DEFAULT_RULES
  );

  assert.equal(undoneBall3.totalRuns, 5);
  assert.equal(undoneBall3.totalWickets, 0, 'Wicket undone!');
  assert.equal(undoneBall3.legalBallsBowled, 2);
  assert.equal(undoneBall3.oversFormatted, '0.2');
  assert.equal(undoneBall3.batterStats['bat2'].isOut, false, 'Batter 2 restored to not out');
  assert.equal(undoneBall3.bowlerStats['bowl1'].wickets, 0, 'Bowler wicket revoked');
  assert.equal(undoneBall3.currentStrikerId, 'bat2', 'Strike restored to bat2');
  assert.equal(undoneBall3.currentNonStrikerId, 'bat1');

  // Undo Ball 2 (Four)
  const undoneBall2 = CricketEngine.replayInnings(
    initial,
    [del1],
    DEFAULT_RULES
  );
  assert.equal(undoneBall2.totalRuns, 1);
  assert.equal(undoneBall2.legalBallsBowled, 1);
  assert.equal(undoneBall2.batterStats['bat2'].runs, 0);
  assert.equal(undoneBall2.batterStats['bat2'].fours, 0);
  assert.equal(undoneBall2.bowlerStats['bowl1'].runsConceded, 1);

  // Undo Ball 1 (Single) -> restores completely empty initial state
  const undoneBall1 = CricketEngine.replayInnings(
    initial,
    [],
    DEFAULT_RULES
  );
  assert.equal(undoneBall1.totalRuns, 0);
  assert.equal(undoneBall1.legalBallsBowled, 0);
  assert.equal(undoneBall1.totalWickets, 0);
  assert.equal(undoneBall1.oversFormatted, '0.0');
});

test('8. Target calculation and match result determination (won by wickets, won by runs, tie)', () => {
  const dummyTeam1 = {
    id: 't1',
    name: 'Mumbai Strikers',
    shortName: 'MUM',
    primaryColor: '#004BA0',
    players: [],
  };
  const dummyTeam2 = {
    id: 't2',
    name: 'Royal Challengers',
    shortName: 'RCB',
    primaryColor: '#D32F2F',
    players: [],
  };

  const inn1: Innings = {
    inningsNumber: 1,
    battingTeamId: 't1',
    bowlingTeamId: 't2',
    totalRuns: 160,
    totalWickets: 6,
    legalBallsBowled: 120,
    oversFormatted: '20.0',
    extras: { wides: 5, noBalls: 1, byes: 2, legByes: 2, penalties: 0, total: 10 },
    deliveries: [],
    batterStats: {},
    bowlerStats: {},
    fallOfWickets: [],
    isCompleted: true,
    completedReason: 'Overs Completed',
  };

  // Scenario 1: Team 2 chases 161 (Target 161) in 18.2 overs losing 4 wickets
  const inn2Won: Innings = {
    inningsNumber: 2,
    battingTeamId: 't2',
    bowlingTeamId: 't1',
    totalRuns: 164,
    totalWickets: 4,
    legalBallsBowled: 110, // 18.2 overs -> 10 balls left (120 - 110)
    oversFormatted: '18.2',
    extras: { wides: 2, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 2 },
    deliveries: [],
    batterStats: {},
    bowlerStats: {},
    fallOfWickets: [],
    isCompleted: true,
    completedReason: 'Target Achieved',
  };

  const matchWonByWickets: Match = {
    id: 'm_res_1',
    title: 'Final',
    format: 't20',
    venue: 'Wankhede',
    date: '2026-10-10',
    status: 'completed',
    team1: dummyTeam1,
    team2: dummyTeam2,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 't1',
    tossDecision: 'bat',
    rules: DEFAULT_RULES,
    innings: [inn1, inn2Won],
    currentInningsIndex: 1,
    targetRuns: 161,
    isSynced: false,
    lastUpdated: 1000,
  };

  const res1 = CricketEngine.evaluateMatchResult(matchWonByWickets);
  // Players per team = 11. Wickets lost = 4 -> 11 - 1 - 4 = 6 wickets left. 120 - 110 = 10 balls left.
  assert.equal(res1, 'Royal Challengers won by 6 wickets (10 balls remaining)');

  // Scenario 2: Team 2 scores 145/8 in 20 overs (Target 161). Team 1 won by 15 runs.
  const inn2Lost: Innings = {
    ...inn2Won,
    totalRuns: 145,
    totalWickets: 8,
    legalBallsBowled: 120,
    oversFormatted: '20.0',
    isCompleted: true,
    completedReason: 'Overs Completed',
  };
  const matchWonByRuns: Match = {
    ...matchWonByWickets,
    innings: [inn1, inn2Lost],
  };
  const res2 = CricketEngine.evaluateMatchResult(matchWonByRuns);
  assert.equal(res2, 'Mumbai Strikers won by 15 runs');

  // Scenario 3: Match Tied (160 vs 160)
  const inn2Tied: Innings = {
    ...inn2Won,
    totalRuns: 160,
    totalWickets: 7,
    legalBallsBowled: 120,
    oversFormatted: '20.0',
    isCompleted: true,
    completedReason: 'Overs Completed',
  };
  const matchTied: Match = {
    ...matchWonByWickets,
    innings: [inn1, inn2Tied],
  };
  const res3 = CricketEngine.evaluateMatchResult(matchTied);
  assert.equal(res3, 'Match Tied');
});
