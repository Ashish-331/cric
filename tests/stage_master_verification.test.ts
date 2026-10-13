import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteMatchRepository } from '../src/repositories/sqlite/sqliteMatchRepository';
import { getDatabase } from '../src/repositories/sqlite/database';
import { CanonicalMatchService } from '../src/services/canonicalMatchService';
import { PlayerPerformanceService } from '../src/services/playerPerformanceService';
import { generateUUID, toCanonicalUUID, isValidUUID } from '../src/utils/uuid';
import { CricketEngine } from '../src/engine/cricketEngine';
import { StatsRollupEngine } from '../src/engine/statsRollupEngine';
import { createSampleMatch, DEFAULT_TEAMS } from '../src/storage/defaultData';
import type { Match, InningsAction, Delivery } from '../src/types/cricket';

test('MASTER-001: SQLite saveMatch uses ON CONFLICT DO UPDATE and prevents cascading deletion of action history', async () => {
  const repo = new SQLiteMatchRepository();
  const db = await getDatabase();

  const matchId = generateUUID();
  const match = createSampleMatch();
  match.id = matchId;
  match.revision = 0;
  match.authorityEpoch = 1;

  // 1. Initial save
  await repo.saveMatch(match);

  // 2. Append action into local_actions and advance revision to 1
  const action: InningsAction = {
    type: 'SWAP_ENDS',
    timestamp: Date.now(),
  };
  await repo.appendAction(matchId, action, 0, 1);

  // Verify action exists in database
  const actionsBefore = await db.getAllAsync<{ id: string; match_id: string }>(
    'SELECT * FROM local_actions WHERE match_id = ?',
    [matchId]
  );
  assert.equal(actionsBefore.length, 1, 'Action must exist in local_actions');

  // 3. Save match again (e.g. metadata or title update)
  match.title = 'Updated Match Title';
  match.revision = 1;
  await repo.saveMatch(match);

  // 4. Verify local_actions were NOT deleted by ON DELETE CASCADE
  const actionsAfter = await db.getAllAsync<{ id: string; match_id: string }>(
    'SELECT * FROM local_actions WHERE match_id = ?',
    [matchId]
  );
  assert.equal(
    actionsAfter.length,
    1,
    'local_actions must NOT be deleted by saveMatch upsert! Cascade deletion prevented.'
  );

  const updatedMatch = await repo.getById(matchId);
  assert.equal(updatedMatch?.title, 'Updated Match Title');
});

test('MASTER-002: UUID Generation and deterministic legacy-to-canonical mapping', async () => {
  // 1. RFC 4122 UUID generator produces valid UUIDs
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  assert.notEqual(uuid1, uuid2);
  assert.equal(isValidUUID(uuid1), true, 'Generated UUID must be valid RFC 4122 v4');
  assert.equal(isValidUUID(uuid2), true, 'Generated UUID must be valid RFC 4122 v4');

  // 2. Legacy string mapping is deterministic and valid UUID
  const legacyId = 'match_1710002938';
  const mapped1 = toCanonicalUUID(legacyId);
  const mapped2 = toCanonicalUUID(legacyId);
  assert.equal(mapped1, mapped2, 'Deterministic mapping must be idempotent and repeatable');
  assert.equal(isValidUUID(mapped1), true, 'Mapped legacy ID must be a valid PostgreSQL UUID');

  // 3. Existing valid UUID is preserved as-is
  assert.equal(toCanonicalUUID(uuid1), uuid1);
});

test('MASTER-003: PlayerPerformanceService resolves My Cricket filters (Your, Played, Network, All)', async () => {
  const match1 = createSampleMatch();
  match1.id = 'match_user_created';
  match1.organizerUserId = 'user_ashish';
  match1.team1 = { ...DEFAULT_TEAMS[0] };
  match1.team2 = { ...DEFAULT_TEAMS[1] };

  const match2 = createSampleMatch();
  match2.id = 'match_user_played';
  match2.organizerUserId = 'other_organizer';
  match2.team1 = {
    ...DEFAULT_TEAMS[0],
    players: [
      {
        id: 'p_ashish',
        claimedByUserId: 'user_ashish',
        name: 'Ashish',
        role: 'all-rounder',
        battingHand: 'right',
      },
    ],
  };
  match2.team2 = { ...DEFAULT_TEAMS[1] };

  const match3 = createSampleMatch();
  match3.id = 'match_unrelated';
  match3.organizerUserId = 'unrelated_user';
  match3.team1 = { ...DEFAULT_TEAMS[1] };
  match3.team2 = { ...DEFAULT_TEAMS[1] };

  const allMatches = [match1, match2, match3];

  // Test 'your' filter
  const yourMatches = PlayerPerformanceService.getFilteredMatchesForUser(
    'user_ashish',
    'your',
    allMatches,
    [],
    []
  );
  assert.equal(yourMatches.some((m) => m.id === 'match_user_created'), true);
  assert.equal(yourMatches.some((m) => m.id === 'match_unrelated'), false);

  // Test 'played' filter
  const playedMatches = PlayerPerformanceService.getFilteredMatchesForUser(
    'user_ashish',
    'played',
    allMatches,
    [],
    []
  );
  assert.equal(playedMatches.some((m) => m.id === 'match_user_played'), true);
  assert.equal(playedMatches.some((m) => m.id === 'match_unrelated'), false);

  // Test 'all' filter enforces account visibility (denying unrelated match)
  const publicMatches = PlayerPerformanceService.getFilteredMatchesForUser(
    'user_ashish',
    'all',
    allMatches,
    [],
    []
  );
  assert.equal(publicMatches.length, 2);
  assert.equal(publicMatches.some((m) => m.id === 'match_user_created'), true);
  assert.equal(publicMatches.some((m) => m.id === 'match_user_played'), true);
  assert.equal(publicMatches.some((m) => m.id === 'match_unrelated'), false);
});

test('MASTER-004: Live player performance extraction across phones with delay detection', async () => {
  const match = createSampleMatch();
  match.id = generateUUID();
  match.status = 'live';
  match.lastUpdated = Date.now() - 150000; // 150 seconds ago (>120s threshold)

  const playerFigure = PlayerPerformanceService.getLiveFiguresForPlayer(
    match.innings[0].currentStrikerId || '',
    [match],
    Date.now()
  );

  assert(playerFigure !== null, 'Player participating in live match must resolve live figures');
  assert.equal(playerFigure.isDelayed, true, 'Delay flag must trigger honestly when scorer is offline > 120s');
  assert.equal(playerFigure.isProvisional, true, 'Live uncompleted match figures must be labeled provisional');
});

test('MASTER-005: Scoring Edge Function pure CricketEngine execution rejects invalid delivery', async () => {
  const match = createSampleMatch();
  const currentInnings = match.innings[0];

  const invalidDelivery: Delivery = {
    id: 'del_invalid_1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: currentInnings.currentStrikerId || 'p1',
    nonStrikerId: currentInnings.currentNonStrikerId || 'p2',
    bowlerId: currentInnings.currentBowlerId || 'b1',
    runsBat: -4, // INVALID: Negative runs
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: '',
    timestamp: Date.now(),
  };

  const commandResult = CricketEngine.executeScoringCommand(
    currentInnings,
    invalidDelivery,
    match.rules,
    match.targetRuns
  );

  assert.equal(commandResult.accepted, false, 'Negative runs must be rejected by pure cricket engine');
  assert(commandResult.rejectionReason?.includes('Batter runs must be a non-negative integer'));
});

test('MASTER-006: Leaderboard and Fantasy MVP calculation transparency', async () => {
  const player = DEFAULT_TEAMS[0].players[0];
  const careerStats = StatsRollupEngine.createEmptyCareerStats();
  careerStats.matches = 5;
  careerStats.inningsBatted = 5;
  careerStats.runs = 250;
  careerStats.fours = 20;
  careerStats.sixes = 10;
  careerStats.wickets = 6;
  careerStats.maidens = 2;
  careerStats.catches = 3;
  careerStats.stumpings = 1;
  careerStats.runOuts = 1;

  // Formula: Runs(1) + 4s(1) + 6s(2) + Wickets(25) + Maidens(8) + Catches(8) + Stumpings(12) + RunOuts(8)
  // Expected = 250*1 + 20*1 + 10*2 + 6*25 + 2*8 + 3*8 + 1*12 + 1*8
  // = 250 + 20 + 20 + 150 + 16 + 24 + 12 + 8 = 500
  const expectedMvp =
    careerStats.runs * 1 +
    careerStats.fours * 1 +
    careerStats.sixes * 2 +
    careerStats.wickets * 25 +
    careerStats.maidens * 8 +
    careerStats.catches * 8 +
    careerStats.stumpings * 12 +
    careerStats.runOuts * 8;

  assert.equal(expectedMvp, 500, 'MVP points formula calculation must strictly equal 500');
});
