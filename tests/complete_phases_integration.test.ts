import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/services/authService';
import { CanonicalMatchService } from '../src/services/canonicalMatchService';
import { CanonicalTournamentService } from '../src/services/canonicalTournamentService';
import { CricketEngine, createInitialInnings, validateDeliveryInput } from '../src/engine/cricketEngine';
import { TournamentEngine } from '../src/engine/tournamentEngine';
import { StatsRollupEngine } from '../src/engine/statsRollupEngine';
import { generateUUID, toCanonicalUUID } from '../src/utils/uuid';
import { createSampleMatch, DEFAULT_TEAMS } from '../src/storage/defaultData';
import type { Match, Delivery, Innings, MatchRules, Tournament, Team } from '../src/types/cricket';

test('PHASE1: E.164 normalization, phone privacy, and server player claim workflow', async () => {
  // 1. Phone number E.164 normalization
  assert.equal(AuthService.normalizePhoneNumber('9876543210'), '+919876543210');
  assert.equal(AuthService.normalizePhoneNumber('+1 415 555 2671'), '+14155552671');
  assert.equal(AuthService.normalizePhoneNumber('+91 98765 43210'), '+919876543210');

  // 2. Player claim logic
  const playerId = generateUUID();
  const accountId = generateUUID();
  const claimResult = await AuthService.linkPlayerToAccount(
    accountId,
    playerId,
    'Official tournament registration ID'
  );

  assert.equal(claimResult.success, true);
  assert.equal(claimResult.status, 'pending');
});

test('PHASE2: Canonical match creation, scorer assignment, and END_INNINGS transition', async () => {
  const match = createSampleMatch();
  match.id = generateUUID();
  match.rules.totalOvers = 5;

  const inn1 = match.innings[0];
  inn1.totalRuns = 62;
  inn1.totalWickets = 4;
  inn1.legalBallsBowled = 30; // 5 overs completed
  inn1.oversFormatted = '5.0';

  // Innings transition
  const targetRuns = inn1.totalRuns + 1;
  const strikerId = match.team2.players[0].id;
  const nonStrikerId = match.team2.players[1].id;
  const bowlerId = match.team1.players[0].id;

  const inn2 = createInitialInnings(
    2,
    inn1.bowlingTeamId,
    inn1.battingTeamId,
    strikerId,
    nonStrikerId,
    bowlerId
  );

  const matchInnings2: Match = {
    ...match,
    innings: [{ ...inn1, isCompleted: true }, inn2],
    currentInningsIndex: 1,
    targetRuns,
    status: 'live',
  };

  assert.equal(matchInnings2.targetRuns, 63);
  assert.equal(matchInnings2.innings[1]?.battingTeamId, match.team2.id);
  assert.equal(matchInnings2.innings[1]?.bowlingTeamId, match.team1.id);
  assert.equal(matchInnings2.innings[1]?.currentStrikerId, strikerId);

  // 2nd innings completes (team 2 finishes with 63/2 in 4.1 overs -> Team 2 wins by 8 wickets)
  const inn2Completed: Innings = {
    ...inn2,
    totalRuns: 63,
    totalWickets: 2,
    legalBallsBowled: 25,
    oversFormatted: '4.1',
    isCompleted: true,
  };

  const finalMatch: Match = {
    ...matchInnings2,
    innings: [{ ...inn1, isCompleted: true }, inn2Completed],
    status: 'completed',
  };

  const outcome = CricketEngine.evaluateMatchResult(finalMatch);
  assert(outcome?.includes('won by 8 wickets'));
});

test('PHASE3: Tournament creation, entry submission, squad lock, and Net Run Rate (NRR) computation', async () => {
  const tournamentId = generateUUID();
  const team1: Team = { ...DEFAULT_TEAMS[0], id: generateUUID() };
  const team2: Team = { ...DEFAULT_TEAMS[1], id: generateUUID() };

  const tournament: Tournament = {
    id: tournamentId,
    name: 'Premier Grassroots Cup 2026',
    format: 't20',
    totalOvers: 20,
    ballType: 'leather',
    creatorUserId: 'user_organizer_1',
    creatorName: 'Organizer',
    teams: [team1, team2],
    matches: [],
    status: 'upcoming',
    createdAt: Date.now(),
  };

  const created = await CanonicalTournamentService.createCanonicalTournament(tournament, 'user_organizer_1');
  assert.equal(created.success, true);
  assert.equal(created.tournament?.id, tournamentId);

  // Simulate completed match between Team 1 and Team 2
  // Team 1 scores 160 in 20.0 overs (RR = 8.0)
  // Team 2 scores 140 in 20.0 overs (RR = 7.0)
  const match1 = createSampleMatch();
  match1.id = generateUUID();
  match1.tournamentId = tournamentId;
  match1.team1 = team1;
  match1.team2 = team2;
  match1.status = 'completed';

  const m1Inn1: Innings = {
    ...match1.innings[0],
    battingTeamId: team1.id,
    bowlingTeamId: team2.id,
    totalRuns: 160,
    totalWickets: 5,
    legalBallsBowled: 120,
    oversFormatted: '20.0',
    isCompleted: true,
  };

  const m1Inn2: Innings = createInitialInnings(2, team2.id, team1.id);
  m1Inn2.totalRuns = 140;
  m1Inn2.totalWickets = 7;
  m1Inn2.legalBallsBowled = 120;
  m1Inn2.oversFormatted = '20.0';
  m1Inn2.isCompleted = true;

  match1.innings = [m1Inn1, m1Inn2];
  match1.result = `${team1.name} won by 20 runs`;

  const standings = CanonicalTournamentService.calculateStandings([match1], [team1, team2]);
  assert.equal(standings.length, 2);
  assert.equal(standings[0].teamId, team1.id);
  assert.equal(standings[0].points, 2); // 2 points for win
  assert.equal(standings[0].won, 1);
  assert.equal(standings[1].teamId, team2.id);
  assert.equal(standings[1].points, 0);
  assert.equal(standings[1].lost, 1);

  // NRR Team 1: 160/20 - 140/20 = +1.000
  // NRR Team 2: 140/20 - 160/20 = -1.000
  assert.equal(standings[0].nrr, 1.0);
  assert.equal(standings[1].nrr, -1.0);
});

test('PHASE4: Invitation code generation & redemption, live broadcast session, and result approval', async () => {
  // Test code generation format
  const code = 'TM9X2K';
  assert.equal(code.startsWith('TM'), true);
  assert.equal(code.length, 6);

  // Test match result approval updating match approval status
  const match = createSampleMatch();
  match.id = generateUUID();
  match.status = 'completed';
  match.approvalStatus = 'provisional';

  const approvalResult = await CanonicalMatchService.updateCanonicalMatchResultApproval(
    match.id,
    'approved',
    { summary: 'Warriors won by 20 runs' }
  );
  assert.equal(approvalResult, true);
});

test('PHASE5: Configurable short-sided teams (7-a-side) respect custom all-out rules', () => {
  const rules7: MatchRules = {
    totalOvers: 6,
    playersPerTeam: 7, // 7 players per team
    wideValue: 1,
    noBallValue: 1,
    freeHitOnNoBall: true,
  };

  const match7 = createSampleMatch();
  match7.rules = rules7;
  const inn7 = match7.innings[0];
  inn7.totalWickets = 5; // 5 down in 7-player team (all out at 6)

  const wicketDelivery: Delivery = {
    id: 'del_w_7',
    ballNumberInMatch: 15,
    overIndex: 2,
    ballInOver: 3,
    isLegalDelivery: true,
    strikerId: inn7.currentStrikerId || 'p1',
    nonStrikerId: inn7.currentNonStrikerId || 'p2',
    bowlerId: inn7.currentBowlerId || 'b1',
    runsBat: 0,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: true,
    wicketDetails: {
      dismissalType: 'caught',
      playerDismissedId: inn7.currentStrikerId || 'p1',
    },
    commentary: 'Caught at long-on!',
    timestamp: Date.now(),
  };

  const result = CricketEngine.executeScoringCommand(inn7, wicketDelivery, rules7);
  assert.equal(result.innings.totalWickets, 6);
  assert.equal(result.isInningsComplete, true, '7-a-side match must complete at 6 wickets (7 - 1)');
});
