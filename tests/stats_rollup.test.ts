import test from 'node:test';
import assert from 'node:assert/strict';
import { StatsRollupEngine } from '../src/engine/statsRollupEngine';
import type { Player, Match, MatchRules } from '../src/types/cricket';

const DUMMY_RULES: MatchRules = {
  totalOvers: 20,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('1. createEmptyCareerStats returns zeroed object with safe initial figures', () => {
  const stats = StatsRollupEngine.createEmptyCareerStats();
  assert.equal(stats.matches, 0);
  assert.equal(stats.runs, 0);
  assert.equal(stats.average, 0);
  assert.equal(stats.strikeRate, 0);
  assert.equal(stats.wickets, 0);
  assert.equal(stats.bowlingEconomy, 0);
  assert.equal(stats.bowlingAverage, 0);
  assert.equal(stats.bestBowling, '0/0');
  assert.equal(stats.catches, 0);
});

test('2. Baseline stats are preserved when no completed matches exist', () => {
  const playerWithBaseline: Player = {
    id: 'p_virat',
    name: 'Virat Kohli',
    role: 'batter',
    battingHand: 'right',
    careerStats: {
      matches: 50,
      inningsBatted: 48,
      runs: 2100,
      highestScore: 112,
      highestScoreNotOut: true,
      average: 52.5,
      strikeRate: 138.4,
      fifties: 18,
      hundreds: 3,
      fours: 195,
      sixes: 54,
      wickets: 0,
      oversBowled: 0,
      maidens: 0,
      runsConceded: 0,
      bowlingAverage: 0,
      bowlingEconomy: 0,
      bestBowling: '0/0',
      catches: 30,
      stumpings: 0,
      runOuts: 4,
    },
    recentScores: [62, 74, 15, 88, 42],
  };

  const matches: Match[] = [
    {
      id: 'm_live',
      title: 'Live match',
      format: 't20',
      venue: 'Ground',
      date: '2026-10-10',
      status: 'live', // not completed!
      team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
      team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#111', players: [] },
      playingXITeam1: ['p_virat'],
      playingXITeam2: [],
      tossWinnerId: 't1',
      tossDecision: 'bat',
      rules: DUMMY_RULES,
      innings: [
        {
          inningsNumber: 1,
          battingTeamId: 't1',
          bowlingTeamId: 't2',
          totalRuns: 30,
          totalWickets: 0,
          legalBallsBowled: 18,
          oversFormatted: '3.0',
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
          deliveries: [],
          batterStats: {},
          bowlerStats: {},
          fallOfWickets: [],
          isCompleted: false,
        },
      ],
      currentInningsIndex: 0,
      isSynced: false,
      lastUpdated: 1000,
    },
  ];

  const resultMap = StatsRollupEngine.rollupAllCareerStats([playerWithBaseline], matches);
  const result = resultMap.get('p_virat');

  assert.ok(result);
  assert.equal(result!.careerStats.matches, 50);
  assert.equal(result!.careerStats.runs, 2100);
  assert.equal(result!.careerStats.average, 52.5);
  assert.equal(result!.careerStats.strikeRate, 138.4);
  assert.deepEqual(result!.recentScores, [62, 74, 15, 88, 42]);
});

test('3. Batting aggregates: runs, milestones (50, 100), strike rate, average, high score', () => {
  const recruit: Player = {
    id: 'p_recruit',
    name: 'Young Star',
    role: 'batter',
    battingHand: 'right',
  };

  const match1: Match = {
    id: 'm_comp_1',
    title: 'Match 1',
    format: 't20',
    venue: 'Ground 1',
    date: '2026-10-10',
    status: 'completed',
    team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
    team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#111', players: [] },
    playingXITeam1: ['p_recruit'],
    playingXITeam2: [],
    tossWinnerId: 't1',
    tossDecision: 'bat',
    rules: DUMMY_RULES,
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        totalRuns: 65,
        totalWickets: 1,
        legalBallsBowled: 40,
        oversFormatted: '6.4',
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
        deliveries: [],
        batterStats: {
          p_recruit: {
            playerId: 'p_recruit',
            runs: 56, // 50 milestone!
            ballsFaced: 35,
            fours: 6,
            sixes: 2,
            strikeRate: 160.0,
            isOut: true, // out once
            battingOrder: 1,
          },
        },
        bowlerStats: {},
        fallOfWickets: [],
        isCompleted: true,
      },
    ],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: 2000,
  };

  const match2: Match = {
    id: 'm_comp_2',
    title: 'Match 2',
    format: 't20',
    venue: 'Ground 2',
    date: '2026-10-11',
    status: 'completed',
    team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
    team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#111', players: [] },
    playingXITeam1: ['p_recruit'],
    playingXITeam2: [],
    tossWinnerId: 't1',
    tossDecision: 'bat',
    rules: DUMMY_RULES,
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        totalRuns: 110,
        totalWickets: 0,
        legalBallsBowled: 60,
        oversFormatted: '10.0',
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
        deliveries: [],
        batterStats: {
          p_recruit: {
            playerId: 'p_recruit',
            runs: 104, // 100 milestone!
            ballsFaced: 52,
            fours: 10,
            sixes: 5,
            strikeRate: 200.0,
            isOut: false, // not out!
            battingOrder: 1,
          },
        },
        bowlerStats: {},
        fallOfWickets: [],
        isCompleted: true,
      },
    ],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: 3000,
  };

  const rolled = StatsRollupEngine.rollupAllCareerStats([recruit], [match1, match2]);
  const stats = rolled.get('p_recruit')!.careerStats;

  assert.equal(stats.matches, 2);
  assert.equal(stats.inningsBatted, 2);
  assert.equal(stats.runs, 160); // 56 + 104
  assert.equal(stats.fours, 16); // 6 + 10
  assert.equal(stats.sixes, 7); // 2 + 5
  assert.equal(stats.fifties, 1);
  assert.equal(stats.hundreds, 1);
  assert.equal(stats.highestScore, 104);
  assert.equal(stats.highestScoreNotOut, true);
  // Average: total runs (160) / timesOut (1) = 160.0
  assert.equal(stats.average, 160.0);
  // Strike rate: 160 runs in 87 balls faced = (160 / 87) * 100 = 183.91
  assert.equal(stats.strikeRate, 183.91);
  assert.deepEqual(rolled.get('p_recruit')!.recentScores, [56, 104]);
});

test('4. Bowling figures: legal balls, overs bowled format, best bowling comparison, maidens, economy', () => {
  const bowler: Player = {
    id: 'p_bowler',
    name: 'Ace Bowler',
    role: 'bowler',
    battingHand: 'right',
  };

  const match: Match = {
    id: 'm_bowl_1',
    status: 'completed',
    title: 'Bowling Test',
    format: 't20',
    venue: 'Ground',
    date: '2026-10-10',
    team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
    team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#111', players: [] },
    playingXITeam1: [],
    playingXITeam2: ['p_bowler'],
    tossWinnerId: 't1',
    tossDecision: 'bat',
    rules: DUMMY_RULES,
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        totalRuns: 20,
        totalWickets: 3,
        legalBallsBowled: 23,
        oversFormatted: '3.5',
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
        deliveries: [],
        batterStats: {},
        bowlerStats: {
          p_bowler: {
            playerId: 'p_bowler',
            legalBalls: 23, // 3 overs and 5 balls
            oversFormatted: '3.5',
            maidens: 1,
            runsConceded: 14,
            wickets: 3,
            economy: 3.65,
            wides: 0,
            noBalls: 0,
            dots: 16,
          },
        },
        fallOfWickets: [],
        isCompleted: true,
      },
    ],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: 5000,
  };

  const rolled = StatsRollupEngine.rollupAllCareerStats([bowler], [match]);
  const stats = rolled.get('p_bowler')!.careerStats;

  assert.equal(stats.oversBowled, 3.5, '23 balls formatted as 3.5 overs');
  assert.equal(stats.maidens, 1);
  assert.equal(stats.wickets, 3);
  assert.equal(stats.runsConceded, 14);
  assert.equal(stats.bestBowling, '3/14');
  // Economy: 14 runs in 23 balls (23/6 = 3.833 overs) -> 14 / 3.833 = 3.65
  assert.equal(stats.bowlingEconomy, 3.65);
  // Bowling Average: 14 / 3 wickets = 4.67
  assert.equal(stats.bowlingAverage, 4.67);
});

test('5. Fielding aggregates: catches, stumpings, and run-outs', () => {
  const fielder: Player = {
    id: 'p_keeper',
    name: 'Wicketkeeper Fielder',
    role: 'wicketkeeper',
    battingHand: 'right',
  };

  const match: Match = {
    id: 'm_field_1',
    status: 'completed',
    title: 'Fielding Test',
    format: 't20',
    venue: 'Ground',
    date: '2026-10-10',
    team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
    team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#111', players: [] },
    playingXITeam1: [],
    playingXITeam2: ['p_keeper'],
    tossWinnerId: 't1',
    tossDecision: 'bat',
    rules: DUMMY_RULES,
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        totalRuns: 50,
        totalWickets: 3,
        legalBallsBowled: 30,
        oversFormatted: '5.0',
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
        deliveries: [
          {
            id: 'd_c',
            ballNumberInMatch: 1,
            overIndex: 0,
            ballInOver: 1,
            isLegalDelivery: true,
            strikerId: 'b1',
            nonStrikerId: 'b2',
            bowlerId: 'bowl1',
            runsBat: 0,
            runsExtra: 0,
            extraType: 'none',
            isBoundary: false,
            isSix: false,
            isWicket: true,
            wicketDetails: {
              dismissalType: 'caught',
              playerDismissedId: 'b1',
              fielderId: 'p_keeper', // catch
            },
            commentary: 'Caught behind',
            timestamp: 10,
          },
          {
            id: 'd_st',
            ballNumberInMatch: 2,
            overIndex: 0,
            ballInOver: 2,
            isLegalDelivery: true,
            strikerId: 'b3',
            nonStrikerId: 'b2',
            bowlerId: 'bowl1',
            runsBat: 0,
            runsExtra: 0,
            extraType: 'none',
            isBoundary: false,
            isSix: false,
            isWicket: true,
            wicketDetails: {
              dismissalType: 'stumped',
              playerDismissedId: 'b3',
              fielderId: 'p_keeper', // stumping
            },
            commentary: 'Stumped!',
            timestamp: 20,
          },
          {
            id: 'd_ro',
            ballNumberInMatch: 3,
            overIndex: 0,
            ballInOver: 3,
            isLegalDelivery: true,
            strikerId: 'b4',
            nonStrikerId: 'b2',
            bowlerId: 'bowl1',
            runsBat: 0,
            runsExtra: 0,
            extraType: 'none',
            isBoundary: false,
            isSix: false,
            isWicket: true,
            wicketDetails: {
              dismissalType: 'run_out',
              playerDismissedId: 'b2',
              fielderId: 'p_keeper', // run out
            },
            commentary: 'Run out!',
            timestamp: 30,
          },
        ],
        batterStats: {},
        bowlerStats: {},
        fallOfWickets: [],
        isCompleted: true,
      },
    ],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: 6000,
  };

  const rolled = StatsRollupEngine.rollupAllCareerStats([fielder], [match]);
  const stats = rolled.get('p_keeper')!.careerStats;

  assert.equal(stats.catches, 1);
  assert.equal(stats.stumpings, 1);
  assert.equal(stats.runOuts, 1);
});

test('6. Divide-by-zero guards: 0 balls faced, 0 dismissals, 0 overs bowled, 0 wickets', () => {
  const inactivePlayer: Player = {
    id: 'p_bench',
    name: 'Bench Player',
    role: 'all-rounder',
    battingHand: 'right',
  };

  const match: Match = {
    id: 'm_bench_1',
    status: 'completed',
    title: 'Bench Test',
    format: 't20',
    venue: 'Ground',
    date: '2026-10-10',
    team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
    team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#111', players: [] },
    playingXITeam1: ['p_bench'],
    playingXITeam2: [],
    tossWinnerId: 't1',
    tossDecision: 'bat',
    rules: DUMMY_RULES,
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        totalRuns: 10,
        totalWickets: 0,
        legalBallsBowled: 6,
        oversFormatted: '1.0',
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
        deliveries: [],
        batterStats: {}, // didn't bat
        bowlerStats: {}, // didn't bowl
        fallOfWickets: [],
        isCompleted: true,
      },
    ],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: 7000,
  };

  const rolled = StatsRollupEngine.rollupAllCareerStats([inactivePlayer], [match]);
  const stats = rolled.get('p_bench')!.careerStats;

  assert.equal(stats.matches, 1);
  assert.equal(stats.runs, 0);
  assert.equal(stats.average, 0, 'No NaN average on 0 innings');
  assert.equal(stats.strikeRate, 0, 'No NaN strike rate on 0 balls faced');
  assert.equal(stats.bowlingEconomy, 0, 'No NaN economy on 0 overs bowled');
  assert.equal(stats.bowlingAverage, 0, 'No NaN bowling average on 0 wickets');
  assert.equal(isNaN(stats.average), false);
  assert.equal(isNaN(stats.strikeRate), false);
  assert.equal(isNaN(stats.bowlingEconomy), false);
  assert.equal(isNaN(stats.bowlingAverage), false);
});

test('7. Recent scores rolling window: retains only last 5 scores', () => {
  const player: Player = {
    id: 'p_slugger',
    name: 'Frequent Batter',
    role: 'batter',
    battingHand: 'right',
    recentScores: [10, 20, 30, 40], // already 4 scores
  };

  const createBattingMatch = (id: string, runs: number, ts: number): Match => ({
    id,
    status: 'completed',
    title: id,
    format: 't20',
    venue: 'Ground',
    date: '2026-10-10',
    team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
    team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#111', players: [] },
    playingXITeam1: ['p_slugger'],
    playingXITeam2: [],
    tossWinnerId: 't1',
    tossDecision: 'bat',
    rules: DUMMY_RULES,
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        totalRuns: runs,
        totalWickets: 0,
        legalBallsBowled: 20,
        oversFormatted: '3.2',
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
        deliveries: [],
        batterStats: {
          p_slugger: {
            playerId: 'p_slugger',
            runs,
            ballsFaced: 15,
            fours: 2,
            sixes: 1,
            strikeRate: 100,
            isOut: true,
            battingOrder: 1,
          },
        },
        bowlerStats: {},
        fallOfWickets: [],
        isCompleted: true,
      },
    ],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: ts,
  });

  const m1 = createBattingMatch('m_1', 50, 1000);
  const m2 = createBattingMatch('m_2', 60, 2000);

  // Baseline has [10, 20, 30, 40]. Matches add 50, 60.
  // Total 6 scores -> last 5 should be [20, 30, 40, 50, 60]!
  const rolled = StatsRollupEngine.rollupAllCareerStats([player], [m1, m2]);
  const recent = rolled.get('p_slugger')!.recentScores;

  assert.equal(recent.length, 5);
  assert.deepEqual(recent, [20, 30, 40, 50, 60]);
});
