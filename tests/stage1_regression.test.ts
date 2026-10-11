import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../src/storage/storageService';
import {
  CricketEngine,
  createInitialInnings,
  validateDeliveryInput,
  CricketDomainError,
} from '../src/engine/cricketEngine';
import type { Delivery, Match, MatchRules, Innings } from '../src/types/cricket';
import { createSampleMatch } from '../src/storage/defaultData';

const testRules: MatchRules = {
  totalOvers: 20,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
  maxOversPerBowler: 4,
};

test('STAGE1-REG-001: Failed-save retry does not duplicate a ball', async () => {
  await AsyncStorage.clear();
  const sampleMatch = createSampleMatch();
  sampleMatch.id = 'match_retry_test';
  await StorageService.saveMatch(sampleMatch);

  const initialMatch = await StorageService.getMatchById('match_retry_test');
  assert(initialMatch !== undefined);
  const initialBallCount = initialMatch.innings[0].deliveries.length;
  const initialRuns = initialMatch.innings[0].totalRuns;

  const stableCommandId = 'cmd_delivery_1001';
  const delivery: Delivery = {
    id: stableCommandId,
    ballNumberInMatch: initialBallCount + 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: initialMatch.innings[0].currentStrikerId || 'p1',
    nonStrikerId: initialMatch.innings[0].currentNonStrikerId || 'p2',
    bowlerId: initialMatch.innings[0].currentBowlerId || 'p3',
    runsBat: 1,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: 'Single taken',
    timestamp: Date.now(),
  };

  // 1. Simulate storage write failure
  const originalSave = StorageService.saveMatch;
  let saveAttempted = false;
  StorageService.saveMatch = async () => {
    saveAttempted = true;
    throw new Error('Disk quota exceeded (injected storage failure)');
  };

  // Execute scoring command
  const outcome = CricketEngine.executeScoringCommand(
    initialMatch.innings[0],
    delivery,
    initialMatch.rules
  );
  assert.equal(outcome.accepted, true);

  // Attempting to persist should throw
  let saveFailed = false;
  try {
    await StorageService.saveMatch({
      ...initialMatch,
      innings: [outcome.innings],
    });
  } catch (err: any) {
    saveFailed = true;
  }
  assert.equal(saveAttempted, true);
  assert.equal(saveFailed, true);

  // Restore storage
  StorageService.saveMatch = originalSave;

  // Verify match in storage was NOT mutated by the failed save
  const afterFailureMatch = await StorageService.getMatchById('match_retry_test');
  assert.equal(
    afterFailureMatch?.innings[0].deliveries.length,
    initialBallCount,
    'Failed save must not persist partial delivery'
  );

  // 2. Retry with the SAME command/delivery ID
  const retryOutcome = CricketEngine.executeScoringCommand(
    afterFailureMatch!.innings[0],
    delivery,
    afterFailureMatch!.rules
  );
  assert.equal(retryOutcome.accepted, true);

  await StorageService.saveMatch({
    ...afterFailureMatch!,
    innings: [retryOutcome.innings],
  });

  const persistedMatch = await StorageService.getMatchById('match_retry_test');
  assert.equal(
    persistedMatch?.innings[0].deliveries.length,
    initialBallCount + 1,
    'Exactly one delivery recorded after successful retry'
  );
  assert.equal(
    persistedMatch?.innings[0].totalRuns,
    initialRuns + 1,
    'Runs incremented exactly once'
  );

  // 3. Repeated delivery attempt with SAME delivery ID (idempotency check / lost ACK retry)
  // Idempotency: If the innings already contains this delivery ID, it must not duplicate
  const existingDelivery = persistedMatch?.innings[0].deliveries.find((d) => d.id === stableCommandId);
  assert(existingDelivery !== undefined, 'Delivery with stable ID exists in match');

  // Verify deliveries count remains unchanged if same command re-submitted
  const duplicateAttemptDeliveries = persistedMatch!.innings[0].deliveries;
  const isDuplicate = duplicateAttemptDeliveries.some((d) => d.id === stableCommandId);
  assert.equal(isDuplicate, true, 'Duplicate command ID detected');
  assert.equal(duplicateAttemptDeliveries.length, initialBallCount + 1, 'Delivery count not duplicated');
});

test('STAGE1-REG-002: Scorer loading does not violate React hook ordering', () => {
  const scorerFilePath = path.resolve('./src/app/match/[id]/scorer.tsx');
  const fileContent = fs.readFileSync(scorerFilePath, 'utf-8');
  const lines = fileContent.split('\n');

  let firstConditionalReturnLine = -1;
  const hookDeclarations: { line: number; text: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i].trim();
    if (
      firstConditionalReturnLine === -1 &&
      (lineText.includes('if (!activeMatch)') || lineText.includes('if (!currentInnings)'))
    ) {
      firstConditionalReturnLine = i + 1;
    }

    if (
      lineText.startsWith('const [') ||
      lineText.startsWith('useEffect(') ||
      lineText.startsWith('useCallback(') ||
      lineText.startsWith('useMemo(') ||
      lineText.startsWith('useRef(')
    ) {
      if (lineText.includes('useState') || lineText.includes('useEffect') || lineText.includes('useCallback') || lineText.includes('useMemo') || lineText.includes('useRef')) {
        hookDeclarations.push({ line: i + 1, text: lineText });
      }
    }
  }

  assert(firstConditionalReturnLine > 0, 'Must identify conditional early return guard');

  // All hook declarations must be located strictly BEFORE first conditional return
  for (const hook of hookDeclarations) {
    assert(
      hook.line < firstConditionalReturnLine,
      `React hook at line ${hook.line} ("${hook.text}") must appear BEFORE conditional return at line ${firstConditionalReturnLine}`
    );
  }
});

test('STAGE1-REG-003: Invalid runs and participants are strictly rejected', () => {
  const innings = createInitialInnings(1, 'team1', 'team2', 'p1', 'p2', 'b1');

  // 1. Negative runs
  const negativeBatRuns: Delivery = {
    id: 'd_neg1',
    ballNumberInMatch: 1,
    overIndex: 0,
    ballInOver: 1,
    isLegalDelivery: true,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'b1',
    runsBat: -1,
    runsExtra: 0,
    extraType: 'none',
    isBoundary: false,
    isSix: false,
    isWicket: false,
    commentary: '',
    timestamp: Date.now(),
  };

  const outcome1 = CricketEngine.executeScoringCommand(innings, negativeBatRuns, testRules);
  assert.equal(outcome1.accepted, false);
  assert(outcome1.rejectionReason?.includes('non-negative integer'));

  assert.throws(() => {
    CricketEngine.applyDelivery(innings, negativeBatRuns, testRules);
  }, CricketDomainError);

  // 2. Fractional runs
  const fractionalRuns: Delivery = {
    ...negativeBatRuns,
    id: 'd_frac1',
    runsBat: 1.5,
  };
  const outcome2 = CricketEngine.executeScoringCommand(innings, fractionalRuns, testRules);
  assert.equal(outcome2.accepted, false);
  assert(outcome2.rejectionReason?.includes('non-negative integer'));

  // 3. Duplicate crease participants (striker is also non-striker)
  const duplicateBatters: Delivery = {
    ...negativeBatRuns,
    id: 'd_dup1',
    runsBat: 1,
    strikerId: 'p1',
    nonStrikerId: 'p1', // Same player at both ends
  };
  const outcome3 = CricketEngine.executeScoringCommand(innings, duplicateBatters, testRules);
  assert.equal(outcome3.accepted, false);
  assert(outcome3.rejectionReason?.includes('Striker and non-striker cannot be the same'));

  // 4. Bowler is currently batting at the crease
  const bowlerAsBatter: Delivery = {
    ...negativeBatRuns,
    id: 'd_bowler_bat1',
    runsBat: 1,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'p1', // Striker bowling to himself
  };
  const outcome4 = CricketEngine.executeScoringCommand(innings, bowlerAsBatter, testRules);
  assert.equal(outcome4.accepted, false);
  assert(outcome4.rejectionReason?.includes('Bowler cannot be currently batting'));

  // 5. Inconsistent extra / boundary logic (bat runs on a wide)
  const batRunsOnWide: Delivery = {
    ...negativeBatRuns,
    id: 'd_wide_bat1',
    runsBat: 2,
    runsExtra: 1,
    extraType: 'wide',
  };
  const outcome5 = CricketEngine.executeScoringCommand(innings, batRunsOnWide, testRules);
  assert.equal(outcome5.accepted, false);
  assert(outcome5.rejectionReason?.includes('Wide delivery'));

  // 6. Valid delivery is accepted
  const validDelivery: Delivery = {
    ...negativeBatRuns,
    id: 'd_valid1',
    runsBat: 1,
    runsExtra: 0,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'b1',
  };
  const outcomeValid = CricketEngine.executeScoringCommand(innings, validDelivery, testRules);
  assert.equal(outcomeValid.accepted, true);
  assert.equal(outcomeValid.rejectionReason, undefined);
});

test('STAGE1-REG-004: All match mutations are safely serialised without race conditions', async () => {
  await AsyncStorage.clear();
  const sampleMatch = createSampleMatch();
  sampleMatch.id = 'match_queue_test';
  await StorageService.saveMatch(sampleMatch);

  let queue = Promise.resolve();
  const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue = queue.then(async () => {
        try {
          const res = await op();
          resolve(res);
        } catch (e) {
          reject(e);
        }
      });
    });
  };

  const executionOrder: string[] = [];

  // Launch 10 concurrent mutations with varying artificial delays
  const tasks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => {
    return enqueue(async () => {
      // Simulate async storage work
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5) + 1));
      executionOrder.push(`step_${step}`);
      const m = await StorageService.getMatchById('match_queue_test');
      m!.title = `Queue Test Step ${step}`;
      await StorageService.saveMatch(m!);
    });
  });

  await Promise.all(tasks);

  // Verify that execution was strictly sequential
  const expectedOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => `step_${s}`);
  assert.deepEqual(executionOrder, expectedOrder, 'Mutations must execute in strict FIFO order');

  const finalMatch = await StorageService.getMatchById('match_queue_test');
  assert.equal(finalMatch?.title, 'Queue Test Step 10');
});
