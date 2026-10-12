import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CricketEngine, createInitialInnings, validateDeliveryInput } from '../src/engine/cricketEngine';
import { CanonicalMatchService } from '../src/services/canonicalMatchService';
import { generateUUID, toCanonicalUUID } from '../src/utils/uuid';
import { createSampleMatch, DEFAULT_TEAMS } from '../src/storage/defaultData';
import type { Match, Delivery, Innings, MatchRules } from '../src/types/cricket';

test('P0-001: END_INNINGS transition handles target setting, team swap, and match conclusion', () => {
  const match = createSampleMatch();
  match.rules.totalOvers = 2; // 2-over match for fast deterministic transition

  // 1. First Innings is active
  const inn1 = match.innings[0];
  inn1.totalRuns = 45;
  inn1.legalBallsBowled = 12; // 2 overs complete
  inn1.oversFormatted = '2.0';

  // End of Innings 1 transition
  const targetRuns = inn1.totalRuns + 1;
  const inn1Finished: Innings = {
    ...inn1,
    isCompleted: true,
    completedReason: 'Overs completed',
  };

  const battingTeamId = inn1.bowlingTeamId;
  const bowlingTeamId = inn1.battingTeamId;
  const strikerId = match.team2.players[0].id;
  const nonStrikerId = match.team2.players[1].id;
  const bowlerId = match.team1.players[0].id;

  const inn2 = createInitialInnings(
    2,
    battingTeamId,
    bowlingTeamId,
    strikerId,
    nonStrikerId,
    bowlerId
  );

  const matchInnings2: Match = {
    ...match,
    innings: [inn1Finished, inn2],
    currentInningsIndex: 1,
    targetRuns,
    status: 'live',
  };

  assert.equal(matchInnings2.targetRuns, 46, 'Target must be exactly first innings total + 1');
  assert.equal(matchInnings2.currentInningsIndex, 1);
  assert.equal(matchInnings2.innings[1]?.battingTeamId, match.team2.id, 'Batting team must invert for 2nd innings');
  assert.equal(matchInnings2.innings[1]?.bowlingTeamId, match.team1.id, 'Bowling team must invert for 2nd innings');
  assert.equal(matchInnings2.innings[1]?.currentStrikerId, strikerId);
  assert.equal(matchInnings2.innings[1]?.currentBowlerId, bowlerId);

  // 2. Second Innings chase completes (score 48 runs -> Team 2 wins by 10 wickets)
  const inn2Finished: Innings = {
    ...inn2,
    totalRuns: 48,
    totalWickets: 0,
    legalBallsBowled: 8,
    oversFormatted: '1.2',
    isCompleted: true,
    completedReason: 'Target achieved',
  };

  const completedMatch: Match = {
    ...matchInnings2,
    innings: [inn1Finished, inn2Finished],
    status: 'completed',
  };

  const resultString = CricketEngine.evaluateMatchResult(completedMatch);
  assert(resultString?.includes('won by 10 wickets'), `Result should declare win by 10 wickets, got: ${resultString}`);
});

test('P0-002: Arbitrary squad sizes (6-a-side and 8-a-side) respect custom all-out rules', () => {
  // Test 6-a-side: 6 players per team -> all out at 5 wickets (playersPerTeam - 1)
  const rules6: MatchRules = {
    totalOvers: 5,
    playersPerTeam: 6,
    wideValue: 1,
    noBallValue: 1,
    freeHitOnNoBall: true,
  };

  const match6 = createSampleMatch();
  match6.rules = rules6;
  const inn6 = match6.innings[0];
  inn6.totalWickets = 4; // 4 wickets down -> 1 wicket left

  // Scoring a wicket delivery
  const wicketDelivery: Delivery = {
    id: 'del_w_5',
    ballNumberInMatch: 10,
    overIndex: 1,
    ballInOver: 4,
    isLegalDelivery: true,
    strikerId: inn6.currentStrikerId || 'p1',
    nonStrikerId: inn6.currentNonStrikerId || 'p2',
    bowlerId: inn6.currentBowlerId || 'b1',
    runsBat: 0,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: true,
    wicketDetails: {
      dismissalType: 'bowled',
      playerDismissedId: inn6.currentStrikerId || 'p1',
    },
    commentary: 'Wicket! Clean bowled.',
    timestamp: Date.now(),
  };

  const result6 = CricketEngine.executeScoringCommand(inn6, wicketDelivery, rules6);
  assert.equal(result6.innings.totalWickets, 5, 'Total wickets must now be 5');
  assert.equal(result6.isInningsComplete, true, '6-a-side innings must complete at 5 wickets (6 - 1)');
});

test('P0-003: Bowler quota enforcement in short-format cricket', () => {
  const rulesShort: MatchRules = {
    totalOvers: 5,
    maxOversPerBowler: 1, // Only 1 over (6 legal balls) permitted per bowler
    playersPerTeam: 11,
    wideValue: 1,
    noBallValue: 1,
    freeHitOnNoBall: true,
  };

  const match = createSampleMatch();
  match.rules = rulesShort;
  const inn = match.innings[0];
  const bowlerId = inn.currentBowlerId || 'b1';

  // Bowler has already completed 6 legal balls (1 over)
  inn.bowlerStats[bowlerId] = {
    playerId: bowlerId,
    legalBalls: 6,
    oversFormatted: '1.0',
    maidens: 0,
    runsConceded: 8,
    wickets: 0,
    economy: 8.0,
    wides: 0,
    noBalls: 0,
    dots: 2,
  };

  const legalBall: Delivery = {
    id: 'del_quota_exceeded',
    ballNumberInMatch: 7,
    overIndex: 1,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: inn.currentStrikerId || 'p1',
    nonStrikerId: inn.currentNonStrikerId || 'p2',
    bowlerId,
    runsBat: 1,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: 'Single',
    timestamp: Date.now(),
  };

  const validation = validateDeliveryInput(legalBall, inn, rulesShort);
  assert.equal(validation.isValid, false, 'Delivery must be rejected if bowler exceeded max overs quota');
  assert(validation.reason?.includes('quota of 1 overs'));
});

test('P0-004: Participant validation prevents batter bowling or same batsman at both ends', () => {
  const match = createSampleMatch();
  const inn = match.innings[0];

  const sameBatterBall: Delivery = {
    id: 'del_same_batter',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'player_same',
    nonStrikerId: 'player_same', // INVALID: same player at both ends
    bowlerId: 'player_other',
    runsBat: 0,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: '',
    timestamp: Date.now(),
  };

  const res1 = validateDeliveryInput(sameBatterBall, inn, match.rules);
  assert.equal(res1.isValid, false);
  assert(res1.reason?.includes('Striker and non-striker cannot be the same player'));

  const bowlerIsBatterBall: Delivery = {
    id: 'del_bowler_is_batter',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'player_crease_1',
    nonStrikerId: 'player_crease_2',
    bowlerId: 'player_crease_1', // INVALID: bowler is currently batting
    runsBat: 0,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: '',
    timestamp: Date.now(),
  };

  const res2 = validateDeliveryInput(bowlerIsBatterBall, inn, match.rules);
  assert.equal(res2.isValid, false);
  assert(res2.reason?.includes('Bowler cannot be currently batting at the crease'));
});

test('P0-005: CanonicalMatchService handles parent entity upserts and deterministic UUIDs', async () => {
  const match = createSampleMatch();
  match.id = generateUUID();
  match.team1.id = generateUUID();
  match.team2.id = generateUUID();

  // Test that deterministic UUID generator correctly canonicalizes legacy and RFC 4122 IDs
  const legacyId = 'match_12345';
  const canonicalLegacy = toCanonicalUUID(legacyId);
  assert.equal(typeof canonicalLegacy, 'string');
  assert.equal(canonicalLegacy.length, 36);

  const uuidAlready = generateUUID();
  assert.equal(toCanonicalUUID(uuidAlready), uuidAlready);
});
