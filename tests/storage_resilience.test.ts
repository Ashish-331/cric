import { test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService, StorageError } from '../src/storage/storageService';
import type { Match, MatchRules, Team } from '../src/types/cricket';
import { createSampleMatch } from '../src/storage/defaultData';

test('STORE-001: Structured persistence errors on failure', async () => {
  // Test 1: Corrupted payload rejection
  await assert.rejects(
    async () => {
      await StorageService.saveMatch({} as any);
    },
    (err: any) => {
      assert(err instanceof StorageError, 'Must throw StorageError');
      assert.equal(err.code, 'PAYLOAD_CORRUPT');
      return true;
    }
  );

  // Ensure migration initialized before testing save write failure
  await StorageService.migrateLegacyMatchesIfNeeded();

  // Test 2: Injected storage write failure
  const originalSetItem = AsyncStorage.setItem;
  try {
    AsyncStorage.setItem = async () => {
      throw new Error('Disk quota exceeded (injected failure)');
    };

    const sample = createSampleMatch();
    await assert.rejects(
      async () => {
        await StorageService.saveMatch(sample);
      },
      (err: any) => {
        assert(err instanceof StorageError, 'Must propagate structured StorageError');
        assert.equal(err.code, 'WRITE_FAILED');
        return true;
      }
    );
  } finally {
    AsyncStorage.setItem = originalSetItem;
  }
});

test('STORE-002: Match-scoped storage layout and legacy migration', async () => {
  // Clear mock storage
  await AsyncStorage.clear();

  // Seed legacy @cric_matches_v1 layout with 2 matches
  const sample1 = createSampleMatch();
  sample1.id = 'match_legacy_1';
  sample1.title = 'Legacy Match 1';

  const sample2 = createSampleMatch();
  sample2.id = 'match_legacy_2';
  sample2.title = 'Legacy Match 2';

  await AsyncStorage.setItem('@cric_matches_v1', JSON.stringify([sample1, sample2]));

  // Migration trigger on getMatches
  const matches = await StorageService.getMatches();
  assert.equal(matches.length, 2, 'Should load both migrated matches');

  // Verify match-scoped keys exist
  const m1Raw = await AsyncStorage.getItem('@cric_match_match_legacy_1');
  const m2Raw = await AsyncStorage.getItem('@cric_match_match_legacy_2');
  assert(m1Raw !== null, '@cric_match_match_legacy_1 must exist');
  assert(m2Raw !== null, '@cric_match_match_legacy_2 must exist');

  // Verify v2 index
  const indexRaw = await AsyncStorage.getItem('@cric_match_ids_v2');
  assert(indexRaw !== null, '@cric_match_ids_v2 index must exist');
  const index = JSON.parse(indexRaw!);
  assert.deepEqual(index, ['match_legacy_1', 'match_legacy_2']);

  // Verify legacy backup was preserved
  const backup = await AsyncStorage.getItem('@cric_matches_v1_backup');
  assert(backup !== null, 'Legacy backup key should be preserved');

  // Verify O(1) single match lookup uses match-scoped key
  const fetched1 = await StorageService.getMatchById('match_legacy_1');
  assert.equal(fetched1?.title, 'Legacy Match 1');

  // Mutation of match 1 should only rewrite match 1
  fetched1!.title = 'Updated Legacy 1';
  await StorageService.saveMatch(fetched1!);

  const m1UpdatedRaw = await AsyncStorage.getItem('@cric_match_match_legacy_1');
  const parsedM1 = JSON.parse(m1UpdatedRaw!);
  assert.equal(parsedM1.title, 'Updated Legacy 1');
});

test('STORE-002: Command serialization prevents write interleaving', async () => {
  await AsyncStorage.clear();
  const sample = createSampleMatch();
  sample.id = 'match_concurrent_test';

  // Dispatch 5 concurrent writes rapidly
  const writes = [1, 2, 3, 4, 5].map((version) => {
    return StorageService.saveMatch({
      ...sample,
      title: `Concurrent Title v${version}`,
      lastUpdated: version * 100,
    });
  });

  await Promise.all(writes);

  // The latest scheduled write should be the one saved
  const finalMatch = await StorageService.getMatchById('match_concurrent_test');
  assert.equal(finalMatch?.title, 'Concurrent Title v5');
});

test('AUTH-002: E.164 phone normalization prevents cross-country collisions', () => {
  // Two numbers with identical 10 digits but different country codes
  const indiaPhone = '+91 98765 43210';
  const usPhone = '+1 98765 43210';

  const normIndia = StorageService.normalizePhone(indiaPhone);
  const normUS = StorageService.normalizePhone(usPhone);

  assert.equal(normIndia, '+919876543210');
  assert.equal(normUS, '+19876543210');
  assert.notEqual(normIndia, normUS, 'Numbers across country codes must NOT collide');

  // Number without prefix defaults to +91
  const raw10 = '9876543210';
  const normRaw = StorageService.normalizePhone(raw10);
  assert.equal(normRaw, '+919876543210');
});

test('AUTH-001: Fresh install defaults to Guest profile', async () => {
  await AsyncStorage.clear();
  const profile = await StorageService.getUserProfile();
  assert.equal(profile.isGuest, true, 'Default profile must be guest');
  assert.equal(profile.isVerified, false, 'Default profile must not be pre-verified');
  assert.notEqual(profile.id, 'user_rohit', 'Default profile must not be Rohit Sharma');
});
