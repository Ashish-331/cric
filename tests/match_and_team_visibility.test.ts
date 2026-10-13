import test from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../src/storage/storageService';
import { PlayerPerformanceService } from '../src/services/playerPerformanceService';
import { SQLiteMatchRepository } from '../src/repositories/sqlite/sqliteMatchRepository';
import { getDatabase } from '../src/repositories/sqlite/database';
import { createSampleMatch, DEFAULT_TEAMS } from '../src/storage/defaultData';
import { createInitialInnings } from '../src/engine/cricketEngine';
import type { Match, Team, Player, MatchRules } from '../src/types/cricket';

const SAMPLE_RULES: MatchRules = {
  totalOvers: 20,
  maxOversPerBowler: 4,
  playersPerTeam: 11,
  wideValue: 1,
  noBallValue: 1,
  freeHitOnNoBall: true,
};

test('VISIBILITY-001: Fresh install storage returns empty arrays (no auto-seeding of demo data)', async () => {
  // Clear any existing storage
  await AsyncStorage.clear();

  const matches = await StorageService.getMatches();
  const teams = await StorageService.getTeams();
  const joinRequests = await StorageService.getJoinRequests();

  assert.deepEqual(matches, [], 'Fresh install must not auto-seed sample match');
  assert.deepEqual(teams, [], 'Fresh install must not auto-seed default teams');
  assert.deepEqual(joinRequests, [], 'Fresh install must not auto-seed default join requests');
});

test('VISIBILITY-002: purgeUntouchedDemoFixtures conservatively purges untouched seeds and preserves genuine user data', async () => {
  await AsyncStorage.clear();

  // Seed sample match and default teams manually as legacy data would have
  const sampleMatch = createSampleMatch();
  await StorageService.saveMatch(sampleMatch);
  await StorageService.saveTeams(DEFAULT_TEAMS);

  // Also add genuine user match and user team
  const userTeam: Team = {
    id: 'team_genuine_user_01',
    name: 'Real User Club',
    shortName: 'RUC',
    primaryColor: '#10B981',
    createdByUserId: 'user_genuine',
    players: [],
  };
  await StorageService.saveTeam(userTeam);

  const genuineMatch: Match = {
    id: 'match_genuine_01',
    title: 'Genuine Local Final',
    format: 't20',
    venue: 'City Ground',
    date: '2026-10-13',
    status: 'scheduled',
    isSynced: false,
    lastUpdated: Date.now(),
    organizerUserId: 'user_genuine',
    team1: userTeam,
    team2: { ...userTeam, id: 'team_genuine_user_02', name: 'Real User Opponent' },
    rules: SAMPLE_RULES,
    innings: [createInitialInnings(1, 'team_genuine_user_01', 'team_genuine_user_02')],
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 'team_genuine_user_01',
    tossDecision: 'bat',
  };
  await StorageService.saveMatch(genuineMatch);

  // Run purge
  const purgeResult = await StorageService.purgeUntouchedDemoFixtures();
  assert.equal(purgeResult.purgedMatches, 1, 'Purges sample_match_1');
  assert.equal(purgeResult.purgedTeams, 3, 'Purges 3 default legacy demo teams');

  // Verify genuine user items are preserved intact
  const remainingMatches = await StorageService.getMatches();
  assert.equal(remainingMatches.length, 1);
  assert.equal(remainingMatches[0].id, 'match_genuine_01');

  const remainingTeams = await StorageService.getTeams();
  assert.equal(remainingTeams.length, 1);
  assert.equal(remainingTeams[0].id, 'team_genuine_user_01');
});

test('VISIBILITY-003: isAccountAuthorizedForMatch enforces complete relationship matrix', () => {
  const baseInn = createInitialInnings(1, 'team_alpha', 'team_beta', 'p_alpha_1', undefined, 'p_beta_1');
  baseInn.totalRuns = 45;
  baseInn.totalWickets = 1;
  baseInn.legalBallsBowled = 24;
  baseInn.oversFormatted = '4.0';
  baseInn.batterStats['p_stat_player'] = {
    playerId: 'p_stat_player',
    runs: 30,
    ballsFaced: 15,
    fours: 4,
    sixes: 1,
    strikeRate: 200,
    isOut: false,
    battingOrder: 1,
  };

  const matchBase: Match = {
    id: 'match_matrix_test',
    title: 'Championship Match',
    format: 't20',
    venue: 'Metro Ground',
    date: '2026-10-13',
    status: 'live',
    isSynced: false,
    lastUpdated: Date.now(),
    rules: SAMPLE_RULES,
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 'team_alpha',
    tossDecision: 'bat',
    organizerUserId: 'user_organizer',
    assignedScorerAccountId: 'user_scorer',
    team1: {
      id: 'team_alpha',
      name: 'Alpha Stars',
      shortName: 'AST',
      primaryColor: '#000',
      captainPlayerId: 'p_captain_alpha',
      managerUserId: 'user_manager_alpha',
      players: [
        {
          id: 'p_alpha_1',
          name: 'Player One',
          claimedByUserId: 'user_player_one',
          role: 'batter',
          battingHand: 'right',
        },
      ],
    },
    team2: {
      id: 'team_beta',
      name: 'Beta Warriors',
      shortName: 'BWA',
      primaryColor: '#FFF',
      players: [
        {
          id: 'p_beta_1',
          name: 'Player Two',
          role: 'bowler',
          battingHand: 'right',
        },
      ],
    },
    innings: [baseInn],
  };

  // 1. Organizer is authorized
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_organizer', matchBase),
    true,
    'Organizer must be authorized'
  );

  // 2. Assigned Scorer is authorized
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_scorer', matchBase),
    true,
    'Assigned scorer must be authorized'
  );

  // 3. Lineup participant (linked by claimedByUserId) is authorized
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_player_one', matchBase),
    true,
    'Lineup player must be authorized'
  );

  // 4. Lineup participant (linked by linkedPlayerIds) is authorized
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_linked_pbeta', matchBase, [], [], ['p_beta_1']),
    true,
    'Player linked via linkedPlayerIds must be authorized'
  );

  // 5. In-match stats player is authorized
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_stat', matchBase, [], [], ['p_stat_player']),
    true,
    'Player with recorded stats must be authorized'
  );

  // 6. Team Manager of participating team is authorized
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_manager_alpha', matchBase),
    true,
    'Team manager must be authorized'
  );

  // 7. Team Captain of participating team is authorized
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_cap_alpha', matchBase, [], [], ['p_captain_alpha']),
    true,
    'Team captain must be authorized'
  );

  // 8. Tournament Organizer is authorized
  const tourneyMatch: Match = {
    ...matchBase,
    tournamentId: 'tourney_elite_cup',
  };
  const tourneys = [
    {
      id: 'tourney_elite_cup',
      name: 'Elite Cup',
      creatorUserId: 'user_tourney_host',
      teams: [],
    },
  ];
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_tourney_host', tourneyMatch, [], tourneys),
    true,
    'Tournament creator must be authorized'
  );

  // 9. Public broadcast match is authorized for any user
  const broadcastMatch: Match = {
    ...matchBase,
    isPublicBroadcast: true,
  };
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_stranger', broadcastMatch),
    true,
    'Public broadcast match must be viewable by any user'
  );

  // 10. Untouched sample match is strictly denied for other accounts
  const sampleMatch = createSampleMatch();
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_stranger', sampleMatch),
    false,
    'Untouched sample match must be denied for unrelated user'
  );

  // 11. Unrelated user is strictly denied
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('user_unrelated_stranger', matchBase),
    false,
    'Unrelated user must be denied'
  );
});

test('VISIBILITY-004: PlayerPerformanceService.getFilteredMatchesForUser strictly partitions all, your, played, and network', () => {
  const currentUserId = 'user_ashish';

  const matchYour: Match = {
    id: 'm_your',
    title: 'My Organized Match',
    format: 't20',
    venue: 'Home Ground',
    date: '2026-10-13',
    status: 'live',
    isSynced: false,
    lastUpdated: Date.now(),
    organizerUserId: currentUserId,
    team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
    team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#FFF', players: [] },
    rules: SAMPLE_RULES,
    innings: [createInitialInnings(1, 't1', 't2')],
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 't1',
    tossDecision: 'bat',
  };

  const matchPlayed: Match = {
    id: 'm_played',
    title: 'Match I Played In',
    format: 't20',
    venue: 'Away Ground',
    date: '2026-10-13',
    status: 'completed',
    isSynced: false,
    lastUpdated: Date.now(),
    organizerUserId: 'other_organizer',
    team1: {
      id: 't3',
      name: 'T3',
      shortName: 'T3',
      primaryColor: '#000',
      players: [
        {
          id: 'p_ashish_player',
          name: 'Ashish',
          claimedByUserId: currentUserId,
          role: 'all-rounder',
          battingHand: 'right',
        },
      ],
    },
    team2: { id: 't4', name: 'T4', shortName: 'T4', primaryColor: '#FFF', players: [] },
    rules: SAMPLE_RULES,
    innings: [createInitialInnings(1, 't3', 't4')],
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 't3',
    tossDecision: 'bat',
  };

  const matchNetwork: Match = {
    id: 'm_network',
    title: 'Club League Fixture',
    format: 't20',
    venue: 'Club Ground',
    date: '2026-10-13',
    status: 'scheduled',
    isSynced: false,
    lastUpdated: Date.now(),
    organizerUserId: 'club_admin',
    team1: {
      id: 'my_club_team',
      name: 'My Club Team',
      shortName: 'MCT',
      primaryColor: '#000',
      managerUserId: currentUserId,
      players: [],
    },
    team2: { id: 't5', name: 'T5', shortName: 'T5', primaryColor: '#FFF', players: [] },
    rules: SAMPLE_RULES,
    innings: [createInitialInnings(1, 'my_club_team', 't5')],
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 'my_club_team',
    tossDecision: 'bat',
  };

  const matchUnrelated: Match = {
    id: 'm_unrelated',
    title: 'Secret Tournament',
    format: 't20',
    venue: 'Private Ground',
    date: '2026-10-13',
    status: 'live',
    isSynced: false,
    lastUpdated: Date.now(),
    organizerUserId: 'unknown_host',
    team1: { id: 't_unrelated_1', name: 'Foreign 1', shortName: 'F1', primaryColor: '#000', players: [] },
    team2: { id: 't_unrelated_2', name: 'Foreign 2', shortName: 'F2', primaryColor: '#FFF', players: [] },
    rules: SAMPLE_RULES,
    innings: [createInitialInnings(1, 't_unrelated_1', 't_unrelated_2')],
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 't_unrelated_1',
    tossDecision: 'bat',
  };

  const allMatches = [matchYour, matchPlayed, matchNetwork, matchUnrelated];

  // 'all' filter must return the union of authorized matches and NEVER leak m_unrelated
  const allFiltered = PlayerPerformanceService.getFilteredMatchesForUser(
    currentUserId,
    'all',
    allMatches
  );
  assert.equal(allFiltered.length, 3, "'all' filter returns exactly the 3 authorized matches");
  assert.equal(allFiltered.some((m) => m.id === 'm_unrelated'), false, 'm_unrelated must be denied');

  // 'your' filter
  const yourFiltered = PlayerPerformanceService.getFilteredMatchesForUser(
    currentUserId,
    'your',
    allMatches
  );
  assert.equal(yourFiltered.some((m) => m.id === 'm_your'), true);
  assert.equal(yourFiltered.some((m) => m.id === 'm_played'), false);
  assert.equal(yourFiltered.some((m) => m.id === 'm_unrelated'), false);

  // 'played' filter
  const playedFiltered = PlayerPerformanceService.getFilteredMatchesForUser(
    currentUserId,
    'played',
    allMatches
  );
  assert.equal(playedFiltered.some((m) => m.id === 'm_played'), true);
  assert.equal(playedFiltered.some((m) => m.id === 'm_your'), false);
  assert.equal(playedFiltered.some((m) => m.id === 'm_unrelated'), false);

  // 'network' filter
  const networkFiltered = PlayerPerformanceService.getFilteredMatchesForUser(
    currentUserId,
    'network',
    allMatches
  );
  assert.equal(networkFiltered.some((m) => m.id === 'm_network'), true);
  assert.equal(networkFiltered.some((m) => m.id === 'm_unrelated'), false);
});

test('VISIBILITY-005: SQLiteMatchRepository accurately classifies demo fixtures and supports accountId filtering', async () => {
  const repo = new SQLiteMatchRepository();
  const db = await getDatabase();

  const demoMatch = createSampleMatch();
  await repo.saveMatch(demoMatch);

  const userMatch1: Match = {
    id: 'm_sqlite_user_1',
    title: 'Ashish Trophy Match',
    format: 't20',
    venue: 'Oval',
    date: '2026-10-13',
    status: 'completed',
    isSynced: false,
    lastUpdated: Date.now(),
    organizerUserId: 'user_sqlite_ashish',
    team1: { id: 'team_s1', name: 'S1', shortName: 'S1', primaryColor: '#000', players: [] },
    team2: { id: 'team_s2', name: 'S2', shortName: 'S2', primaryColor: '#FFF', players: [] },
    rules: SAMPLE_RULES,
    innings: [createInitialInnings(1, 'team_s1', 'team_s2')],
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 'team_s1',
    tossDecision: 'bat',
  };
  await repo.saveMatch(userMatch1);

  const otherUserMatch: Match = {
    id: 'm_sqlite_user_2',
    title: 'Bob Trophy Match',
    format: 't20',
    venue: 'Lords',
    date: '2026-10-13',
    status: 'live',
    isSynced: false,
    lastUpdated: Date.now(),
    organizerUserId: 'user_sqlite_bob',
    team1: { id: 'team_s3', name: 'S3', shortName: 'S3', primaryColor: '#000', players: [] },
    team2: { id: 'team_s4', name: 'S4', shortName: 'S4', primaryColor: '#FFF', players: [] },
    rules: SAMPLE_RULES,
    innings: [createInitialInnings(1, 'team_s3', 'team_s4')],
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 'team_s3',
    tossDecision: 'bat',
  };
  await repo.saveMatch(otherUserMatch);

  // 1. Verify demo classification column in SQLite
  const demoRow = await db.getFirstAsync<{ is_demo: number; account_owner_id: string | null }>(
    'SELECT is_demo, account_owner_id FROM local_matches WHERE id = ?',
    [demoMatch.id]
  );
  assert.ok(demoRow);
  assert.equal(demoRow.is_demo, 1, 'Sample match must have is_demo = 1');

  // 2. Verify account_owner_id column in SQLite
  const user1Row = await db.getFirstAsync<{ is_demo: number; account_owner_id: string | null }>(
    'SELECT is_demo, account_owner_id FROM local_matches WHERE id = ?',
    [userMatch1.id]
  );
  assert.ok(user1Row);
  assert.equal(user1Row.is_demo, 0);
  assert.equal(user1Row.account_owner_id, 'user_sqlite_ashish');

  // 3. listMatches with excludeDemo filter
  const nonDemoMatches = await repo.listMatches({ excludeDemo: true });
  assert.equal(nonDemoMatches.some((m) => m.id === demoMatch.id), false, 'excludeDemo removes sample match');

  // 4. listMatches scoped by accountId
  const ashishMatches = await repo.listMatches({ accountId: 'user_sqlite_ashish' });
  assert.equal(ashishMatches.length, 1);
  assert.equal(ashishMatches[0].id, 'm_sqlite_user_1');
});

test('VISIBILITY-006: Scorer authorization checks strictly reject loose substring matches', () => {
  const match: Match = {
    id: 'match_loose_sub_check',
    title: 'Tight Scorer Check Match',
    format: 't20',
    venue: 'Ground',
    date: '2026-10-13',
    status: 'live',
    isSynced: false,
    lastUpdated: Date.now(),
    rules: SAMPLE_RULES,
    currentInningsIndex: 0,
    playingXITeam1: [],
    playingXITeam2: [],
    tossWinnerId: 't1',
    tossDecision: 'bat',
    organizerUserId: 'organizer_99',
    scorerName: 'User 123456 (Senior Official)',
    assignedScorerAccountId: 'acc_official_12',
    team1: { id: 't1', name: 'T1', shortName: 'T1', primaryColor: '#000', players: [] },
    team2: { id: 't2', name: 'T2', shortName: 'T2', primaryColor: '#FFF', players: [] },
    innings: [createInitialInnings(1, 't1', 't2')],
  };

  // Substring "12" in "123456" must NOT authorize account "12"
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('12', match),
    false,
    'Loose substring match on scorerName must be rejected'
  );

  // Exact match on assignedScorerAccountId succeeds
  assert.equal(
    PlayerPerformanceService.isAccountAuthorizedForMatch('acc_official_12', match),
    true,
    'Exact match on assignedScorerAccountId is authorized'
  );
});
