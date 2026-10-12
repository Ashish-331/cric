import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService, DEV_TEST_ACCOUNTS } from '../src/services/authService';
import { SQLiteMatchRepository } from '../src/repositories/sqlite/sqliteMatchRepository';
import { createSampleMatch } from '../src/storage/defaultData';
import type { InningsAction, Match } from '../src/types/cricket';

test('AUTH-SVC-001: Phone number normalization adheres to strict E.164 format', () => {
  // 1. Raw 10 digits default to India (+91)
  assert.equal(AuthService.normalizePhoneNumber('9876543210'), '+919876543210');

  // 2. Formatted with spaces and dashes
  assert.equal(AuthService.normalizePhoneNumber('+91 98765-43210'), '+919876543210');
  assert.equal(AuthService.normalizePhoneNumber('+1 (555) 123-4567'), '+15551234567');
  assert.equal(AuthService.normalizePhoneNumber('+44 20 7946 0958'), '+442079460958');

  // 3. Empty/undefined handling
  assert.equal(AuthService.normalizePhoneNumber(''), '');
  assert.equal(AuthService.normalizePhoneNumber(undefined), '');

  // 4. Distinction between identical digits in different countries
  const india = AuthService.normalizePhoneNumber('+91 9876543210');
  const us = AuthService.normalizePhoneNumber('+1 9876543210');
  assert.notEqual(india, us, 'Must produce distinct canonical E.164 keys');
});

test('AUTH-SVC-002: Dev test accounts exist for all core primary roles', () => {
  const roles = Object.keys(DEV_TEST_ACCOUNTS);
  assert.equal(roles.includes('ORGANIZER'), true);
  assert.equal(roles.includes('CAPTAIN'), true);
  assert.equal(roles.includes('SCORER'), true);
  assert.equal(roles.includes('PLAYER'), true);

  // All test numbers must be distinct E.164 strings
  const numbers = Object.values(DEV_TEST_ACCOUNTS).map((a) => a.phone);
  const uniqueNumbers = new Set(numbers);
  assert.equal(uniqueNumbers.size, numbers.length, 'Each dev role must have a distinct test phone number');
});

test('AUTH-SVC-003: Email normalization and validation rejects malformed formats', () => {
  // 1. Lowercase and trim
  assert.equal(AuthService.normalizeEmail(' Player@Example.COM  '), 'player@example.com');
  assert.equal(AuthService.normalizeEmail('captain.rohit@cric.test'), 'captain.rohit@cric.test');

  // 2. Reject malformed emails
  assert.throws(() => AuthService.normalizeEmail('notanemail'), /Invalid email address format/);
  assert.throws(() => AuthService.normalizeEmail('user@domain'), /Invalid email address format/);
  assert.throws(() => AuthService.normalizeEmail('@missingusername.com'), /Invalid email address format/);
  assert.equal(AuthService.normalizeEmail(''), '');
  assert.equal(AuthService.normalizeEmail(undefined), '');
});

test('AUTH-SVC-004: Email-first DEV test accounts provide complete credentials with zero SMS overhead', () => {
  const accounts = Object.values(DEV_TEST_ACCOUNTS);
  const emails = accounts.map((a) => a.email);
  const uniqueEmails = new Set(emails);

  assert.equal(uniqueEmails.size, accounts.length, 'Each dev role must have a distinct test email address');
  for (const acc of accounts) {
    assert(acc.email.endsWith('@cric.test'), `Dev email ${acc.email} must use the test domain`);
    assert(acc.password.length >= 6, `Dev password for ${acc.email} must satisfy minimum 6 character policy`);
    assert(acc.displayName.length > 0, `Dev account ${acc.email} must specify a displayName`);
    assert.doesNotThrow(() => AuthService.normalizeEmail(acc.email));
  }
});

test('REPO-001: Match repository contracts, filtering, and outbox lifecycle', async () => {
  const repo = new SQLiteMatchRepository();
  const sample = createSampleMatch();
  sample.id = 'match_repo_unit_1';
  sample.title = 'Official League Match';

  // 1. Persist match
  await repo.saveMatch(sample);
  const fetched = await repo.getById('match_repo_unit_1');
  assert(fetched !== null);
  assert.equal(fetched.title, 'Official League Match');

  // 2. Demo match filtering
  const demoMatch = createSampleMatch();
  demoMatch.id = 'match_repo_demo_1';
  demoMatch.title = 'Demo Friendly Match';
  await repo.saveMatch(demoMatch);

  const allMatches = await repo.listMatches();
  assert(allMatches.length >= 2);

  const nonDemoMatches = await repo.listMatches({ excludeDemo: true });
  const hasDemo = nonDemoMatches.some((m) => m.id === 'match_repo_demo_1');
  assert.equal(hasDemo, false, 'excludeDemo must filter out demo matches from official lists');

  // 3. Append scoring action and verify outbox entry
  const action: InningsAction = {
    type: 'SWAP_ENDS',
    timestamp: Date.now(),
  };

  const { revision, actionId } = await repo.appendAction('match_repo_unit_1', action, 0, 1);
  assert.equal(revision, 1);
  assert(actionId.startsWith('act_'));

  const pendingOutbox = await repo.getPendingSyncOutbox();
  const outboxEntry = pendingOutbox.find((e) => e.actionId === actionId);
  assert(outboxEntry !== undefined, 'Action must be queued in pending sync outbox');
  assert.equal(outboxEntry.status, 'pending');

  // 4. Mark outbox synced
  await repo.markOutboxSynced([outboxEntry.id]);
  const refreshedOutbox = await repo.getPendingSyncOutbox();
  const stillPending = refreshedOutbox.some((e) => e.id === outboxEntry.id);
  assert.equal(stillPending, false, 'Synced events must not appear in pending outbox');
});
