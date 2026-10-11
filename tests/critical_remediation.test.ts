import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteMatchRepository } from '../src/repositories/sqlite/sqliteMatchRepository';
import { SyncService } from '../src/services/syncService';
import { AuthService } from '../src/services/authService';
import { createSampleMatch } from '../src/storage/defaultData';
import type { Match, InningsAction } from '../src/types/cricket';
import type { OutboxEvent } from '../src/repositories/types';

test('CRIT-001: Login fails closed - rejects invalid code and unreachable provider without claiming verification', async () => {
  // Test invalid OTP length
  await assert.rejects(
    async () => {
      await AuthService.verifyOtp('+919876543210', '123');
    },
    /OTP code must be exactly 6 digits/,
    'Invalid length OTP must throw immediately'
  );

  // Test invalid OTP or unreachable backend
  await assert.rejects(
    async () => {
      await AuthService.verifyOtp('+919876543210', '000000');
    },
    'Invalid OTP or failed backend must fail closed and reject'
  );
});

test('CRIT-002: SQLite transactional consistency - appendAction enforces atomic revision & epoch concurrency', async () => {
  const repo = new SQLiteMatchRepository();
  const match = createSampleMatch();
  match.id = 'match_crit_concurrency_1';
  match.revision = 5;
  match.authorityEpoch = 1;

  await repo.saveMatch(match);

  const action: InningsAction = {
    type: 'SELECT_BOWLER',
    bowlerId: 'p2_1',
    timestamp: Date.now(),
  };

  // 1. Revision conflict: expected 4, stored is 5 -> must throw conflict
  await assert.rejects(
    async () => {
      await repo.appendAction(match.id, action, 4, 1);
    },
    /Revision conflict/,
    'Stale revision must be rejected with revision conflict'
  );

  // 2. Epoch mismatch: expected epoch 2, stored is 1 -> must throw epoch mismatch
  await assert.rejects(
    async () => {
      await repo.appendAction(match.id, action, 5, 2);
    },
    /Authority epoch mismatch/,
    'Revoked or outdated epoch authority must be rejected'
  );

  // 3. Correct expectedRevision (5) and epoch (1) -> succeeds and advances to 6
  const res = await repo.appendAction(match.id, action, 5, 1);
  assert.equal(res.revision, 6);

  // 4. Stored match in SQLite now has revision 6
  const stored = await repo.getById(match.id);
  assert(stored !== null);
  assert.equal(stored.revision, 6);
});

test('CRIT-003: SyncService fails closed - does not simulate sync success without authenticated session', async () => {
  const repo = new SQLiteMatchRepository();
  const match = createSampleMatch();
  match.id = 'match_crit_fail_closed_sync';
  match.revision = 0;
  await repo.saveMatch(match);

  const action: InningsAction = {
    type: 'SWAP_ENDS',
    timestamp: Date.now(),
  };

  await repo.appendAction(match.id, action, 0, 1);

  // Ensure no transmitter mock is active
  SyncService.setTransmitter(null);

  // Process outbox with no session -> fails closed
  const syncResult = await SyncService.processOutbox(repo);
  assert.equal(syncResult.syncedCount, 0, 'Must never mark outbox synced without verified cloud acceptance');
  assert.equal(syncResult.failedCount >= 1, true);

  // Event must still remain in outbox as pending or failed, NEVER deleted or marked synced
  const pending = await repo.getPendingSyncOutbox();
  const matchPending = pending.filter((e) => e.matchId === match.id);
  assert.equal(matchPending.length, 1);
  assert.equal(matchPending[0].status, 'failed');
  assert(matchPending[0].lastError?.includes('NO_SESSION'));
});

test('CRIT-004: Outbox isolation - conflict on Match A halts Match A without starving Match B', async () => {
  const repo = new SQLiteMatchRepository();

  // Match A
  const matchA = createSampleMatch();
  matchA.id = 'match_crit_isolate_A';
  matchA.revision = 0;
  await repo.saveMatch(matchA);

  // Match B
  const matchB = createSampleMatch();
  matchB.id = 'match_crit_isolate_B';
  matchB.revision = 0;
  await repo.saveMatch(matchB);

  const actionA1: InningsAction = { type: 'SWAP_ENDS', timestamp: Date.now() };
  const actionA2: InningsAction = { type: 'SWAP_ENDS', timestamp: Date.now() + 10 };
  const actionB1: InningsAction = { type: 'SELECT_BOWLER', bowlerId: 'p2_1', timestamp: Date.now() };

  await repo.appendAction(matchA.id, actionA1, 0, 1);
  await repo.appendAction(matchA.id, actionA2, 1, 1);
  await repo.appendAction(matchB.id, actionB1, 0, 1);

  // Configure transmitter: Match A encounters revision conflict; Match B succeeds
  SyncService.setTransmitter(async (event: OutboxEvent) => {
    if (event.matchId === matchA.id) {
      return { accepted: false, conflict: true, canonicalRevision: 99 };
    }
    return { accepted: true };
  });

  try {
    const syncRes = await SyncService.processOutbox(repo);
    assert.equal(syncRes.conflictsCount, 1, 'Match A first action reports conflict');
    assert(syncRes.syncedCount >= 1, 'Match B action is synced despite Match A conflict');

    // Verify Match B outbox is cleared
    const pending = await repo.getPendingSyncOutbox();
    const pendingB = pending.filter((e) => e.matchId === matchB.id);
    assert.equal(pendingB.length, 0, 'Match B queue was not starved by Match A conflict');

    // Match A action 1 is marked conflict
    const pendingA = pending.filter((e) => e.matchId === matchA.id);
    assert.equal(pendingA.length, 1, 'Subsequent actions on Match A were halted');
  } finally {
    SyncService.setTransmitter(null);
  }
});
