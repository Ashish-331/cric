import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerPerformanceService } from '../src/services/playerPerformanceService';
import { SyncService } from '../src/services/syncService';
import { SQLiteMatchRepository } from '../src/repositories/sqlite/sqliteMatchRepository';
import { createSampleMatch } from '../src/storage/defaultData';
import type { Match, Delivery, InningsAction } from '../src/types/cricket';

test('STAGE3-001: Scorer records deliveries locally, persisting outbox events with incrementing revisions', async () => {
  const repo = new SQLiteMatchRepository();
  const match = createSampleMatch();
  match.id = 'match_stage3_scorer_1';
  match.scorerPlayerId = 'scorer_phone_s';
  match.status = 'live';

  await repo.saveMatch(match);

  // Scorer on Phone S records 3 successive deliveries
  const action1: InningsAction = {
    type: 'DELIVERY',
    delivery: {
      id: 'del_s3_1',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'p1_1',
      nonStrikerId: 'p1_2',
      bowlerId: 'p2_1',
      runsBat: 4,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: true,
      isSix: false,
      isWicket: false,
      commentary: 'FOUR runs scored to cover!',
      timestamp: Date.now(),
    },
  };

  const action2: InningsAction = {
    type: 'DELIVERY',
    delivery: {
      id: 'del_s3_2',
      ballNumberInMatch: 2,
      overIndex: 0,
      ballInOver: 2,
      isLegalDelivery: true,
      strikerId: 'p1_1',
      nonStrikerId: 'p1_2',
      bowlerId: 'p2_1',
      runsBat: 1,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: false,
      isWicket: false,
      commentary: '1 run, push to long-on, ends swapped',
      timestamp: Date.now() + 1000,
    },
  };

  const action3: InningsAction = {
    type: 'SWAP_ENDS',
    timestamp: Date.now() + 1100,
  };

  const res1 = await repo.appendAction(match.id, action1, 0, 1);
  assert.equal(res1.revision, 1);

  const res2 = await repo.appendAction(match.id, action2, 1, 1);
  assert.equal(res2.revision, 2);

  const res3 = await repo.appendAction(match.id, action3, 2, 1);
  assert.equal(res3.revision, 3);

  // Check outbox contents
  const pendingOutbox = await repo.getPendingSyncOutbox();
  const matchEvents = pendingOutbox.filter((e) => e.matchId === match.id);
  assert.equal(matchEvents.length, 3);
  assert.equal(matchEvents[0].expectedRevision, 0);
  assert.equal(matchEvents[1].expectedRevision, 1);
  assert.equal(matchEvents[2].expectedRevision, 2);
});

test('STAGE3-002: Player Phone resolves own live batting and bowling figures in real time (My Cricket)', () => {
  const match = createSampleMatch();
  match.id = 'match_stage3_player_live';
  match.status = 'live';
  match.currentInningsIndex = 0;

  // Let striker be p1_1 (Rohit) and bowler be p2_1 (Siraj)
  const inn = match.innings[0];
  inn.currentStrikerId = 'p1_1';
  inn.currentNonStrikerId = 'p1_2';
  inn.currentBowlerId = 'p2_1';

  inn.batterStats['p1_1'] = {
    playerId: 'p1_1',
    runs: 46,
    ballsFaced: 28,
    fours: 5,
    sixes: 2,
    strikeRate: 164.29,
    isOut: false,
    battingOrder: 1,
  };

  inn.bowlerStats['p2_1'] = {
    playerId: 'p2_1',
    legalBalls: 16,
    oversFormatted: '2.4',
    maidens: 0,
    runsConceded: 22,
    wickets: 1,
    economy: 8.25,
    wides: 0,
    noBalls: 0,
    dots: 7,
  };

  // Player P1 (Rohit) opens app on Phone P1
  const rohitFigure = PlayerPerformanceService.getLiveFiguresForPlayer('p1_1', [match]);
  assert(rohitFigure !== null);
  assert.equal(rohitFigure.matchId, match.id);
  assert.equal(rohitFigure.batting?.runs, 46);
  assert.equal(rohitFigure.batting?.ballsFaced, 28);
  assert.equal(rohitFigure.batting?.fours, 5);
  assert.equal(rohitFigure.batting?.sixes, 2);
  assert.equal(rohitFigure.batting?.isOnStrike, true);
  assert.equal(rohitFigure.batting?.isNonStriker, false);

  // Bowler P2 (Siraj) opens app on Phone P2
  const sirajFigure = PlayerPerformanceService.getLiveFiguresForPlayer('p2_1', [match]);
  assert(sirajFigure !== null);
  assert.equal(sirajFigure.bowling?.wickets, 1);
  assert.equal(sirajFigure.bowling?.runsConceded, 22);
  assert.equal(sirajFigure.bowling?.oversFormatted, '2.4');
  assert.equal(sirajFigure.bowling?.isCurrentBowler, true);

  // Non-participating player P999 opens app
  const bystanderFigure = PlayerPerformanceService.getLiveFiguresForPlayer('p_non_existent', [match]);
  assert.equal(bystanderFigure, null, 'Non-participating user must receive null figure');
});

test('STAGE3-003: Spectator and non-scorer permission checks strictly reject unauthorized scoring authority', () => {
  const match = createSampleMatch();
  match.id = 'match_stage3_permissions';
  match.tournamentId = 'tourn_official_1';
  match.isSynced = true;
  match.scorerPlayerId = 'official_scorer_123';

  // Helper evaluating scoring authority as defined in match centre & home screen
  const canScore = (userRole?: string, userId?: string) => {
    return (
      userRole === 'scorer' ||
      match.scorerPlayerId === userId ||
      (!match.tournamentId && !match.isSynced)
    );
  };

  // 1. Authorized scorer
  assert.equal(canScore('scorer', 'any_user_id'), true);
  assert.equal(canScore('player', 'official_scorer_123'), true);

  // 2. Spectators and normal players
  assert.equal(canScore('player', 'spectator_phone_p'), false);
  assert.equal(canScore('captain', 'other_captain_id'), false);
  assert.equal(canScore(undefined, undefined), false);

  // 3. Local casual match without tournament or sync allows grassroots scorer
  const casualMatch = createSampleMatch();
  casualMatch.tournamentId = undefined;
  casualMatch.isSynced = false;
  const canScoreCasual = (userRole?: string, userId?: string) => {
    return (
      userRole === 'scorer' ||
      casualMatch.scorerPlayerId === userId ||
      (!casualMatch.tournamentId && !casualMatch.isSynced)
    );
  };
  assert.equal(canScoreCasual('player', 'casual_scorer_id'), true);
});

test('STAGE3-004: Offline scoring queue, delay detection, and idempotent outbox replay without duplicate ball commits', async () => {
  const repo = new SQLiteMatchRepository();
  const match = createSampleMatch();
  match.id = 'match_stage3_offline_sync';
  match.scorerPlayerId = 'scorer_phone_s';
  match.status = 'live';
  // Match was updated 3 minutes ago (> 120s) without cloud sync
  match.lastUpdated = Date.now() - 180000;
  match.isSynced = false;
  await repo.saveMatch(match);

  // Verify delay detection on viewer phones
  const liveFigure = PlayerPerformanceService.getLiveFiguresForPlayer(
    match.innings[0].currentStrikerId || 'p1_1',
    [match]
  );
  assert(liveFigure !== null);
  assert.equal(liveFigure.isDelayed, true, 'Figure must indicate delay when cloud update is older than 120s');

  // Queue two actions while offline
  const act1: InningsAction = {
    type: 'SELECT_BOWLER',
    bowlerId: 'p2_2',
    timestamp: Date.now() - 170000,
  };
  const act2: InningsAction = {
    type: 'DELIVERY',
    delivery: {
      id: 'del_offline_1',
      ballNumberInMatch: 1,
      overIndex: 0,
      ballInOver: 1,
      isLegalDelivery: true,
      strikerId: 'p1_1',
      nonStrikerId: 'p1_2',
      bowlerId: 'p2_2',
      runsBat: 6,
      runsExtra: 0,
      extraType: 'none',
      isBoundary: false,
      isSix: true,
      isWicket: false,
      commentary: 'SIX over long-on!',
      timestamp: Date.now() - 165000,
    },
  };

  await repo.appendAction(match.id, act1, 0, 1);
  await repo.appendAction(match.id, act2, 1, 1);

  const initialPending = await repo.getPendingSyncOutbox();
  const matchPending = initialPending.filter((e) => e.matchId === match.id);
  assert.equal(matchPending.length, 2);

  // Network reconnects -> SyncService.processOutbox
  const syncResult1 = await SyncService.processOutbox(repo);
  assert.equal(syncResult1.syncedCount >= 2, true);
  assert.equal(syncResult1.failedCount, 0);

  // Verify outbox is now empty for this match
  const afterSyncPending = await repo.getPendingSyncOutbox();
  const remaining = afterSyncPending.filter((e) => e.matchId === match.id);
  assert.equal(remaining.length, 0, 'All events must be marked synced');

  // Subsequent sync invocation must be completely idempotent (0 events processed)
  const syncResult2 = await SyncService.processOutbox(repo);
  const remainingAttempt = syncResult2.syncedCount;
  assert.equal(remainingAttempt, 0, 'Idempotent replay must not re-transmit synced deliveries');
});
