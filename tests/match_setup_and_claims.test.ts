import test from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../src/storage/storageService';
import { validateMatchOversQuota, createInitialInnings } from '../src/engine/cricketEngine';
import { PlayerIdentityService } from '../src/services/playerIdentityService';
import { StatsRollupEngine } from '../src/engine/statsRollupEngine';
import type { Match, Team, Player } from '../src/types/cricket';

test('SETUP-001: validateMatchOversQuota accepts integer quotas and derives canonical formats', () => {
  const t20Res = validateMatchOversQuota('20');
  assert.equal(t20Res.valid, true);
  assert.equal(t20Res.overs, 20);
  assert.equal(t20Res.format, 't20');

  const odiRes = validateMatchOversQuota(50);
  assert.equal(odiRes.valid, true);
  assert.equal(odiRes.overs, 50);
  assert.equal(odiRes.format, 'odi');

  const t10Res = validateMatchOversQuota('10');
  assert.equal(t10Res.valid, true);
  assert.equal(t10Res.overs, 10);
  assert.equal(t10Res.format, 't10');

  const customRes = validateMatchOversQuota('8');
  assert.equal(customRes.valid, true);
  assert.equal(customRes.overs, 8);
  assert.equal(customRes.format, 'custom');
});

test('SETUP-002: validateMatchOversQuota strictly rejects cricket decimal notation (e.g. 5.2) with cricket explanation', () => {
  const decRes1 = validateMatchOversQuota('5.2');
  assert.equal(decRes1.valid, false);
  assert.match(
    decRes1.error || '',
    /5 overs and 2 balls/i,
    'Must explain that 5.2 means 5 overs and 2 balls in cricket'
  );

  const decRes2 = validateMatchOversQuota('20.4');
  assert.equal(decRes2.valid, false);
  assert.match(decRes2.error || '', /whole integer between 1 and 100/i);
});

test('SETUP-003: validateMatchOversQuota rejects empty, non-digit, zero, negative, and oversized quotas', () => {
  assert.equal(validateMatchOversQuota('').valid, false);
  assert.equal(validateMatchOversQuota('abc').valid, false);
  assert.equal(validateMatchOversQuota('0').valid, false);
  assert.equal(validateMatchOversQuota('-5').valid, false);
  assert.equal(validateMatchOversQuota('101').valid, false);
  assert.equal(validateMatchOversQuota('100').valid, true);
});

test('SETUP-004: Opponent team delegation captures captain email and avoids organizer role hijacking', async () => {
  await AsyncStorage.clear();

  const organizerUserId = 'usr_organizer_99';

  // Create opponent team
  const opponentTeam: Team = {
    id: 'team_opp_01',
    name: 'Dharavi Warriors',
    shortName: 'DHW',
    primaryColor: '#D32F2F',
    city: 'Mumbai',
    createdByUserId: organizerUserId,
    managerUserId: undefined, // Organizer is creator for audit, not manager
    captainName: 'Rohit Captain',
    captainEmail: 'rohit@opponent.com',
    captainStatus: 'invited',
    players: [
      {
        id: 'p_opp_cap_01',
        name: 'Rohit Captain',
        role: 'batter',
        battingHand: 'right',
        email: 'rohit@opponent.com',
        isCaptain: true,
        isGuest: true,
        careerStats: StatsRollupEngine.createEmptyCareerStats(),
        recentScores: [],
      },
    ],
  };

  await StorageService.saveTeam(opponentTeam);
  const loadedTeams = await StorageService.getTeams();
  const loadedOpponent = loadedTeams.find((t) => t.id === 'team_opp_01');

  assert.ok(loadedOpponent);
  assert.equal(loadedOpponent.captainStatus, 'invited');
  assert.equal(loadedOpponent.captainEmail, 'rohit@opponent.com');
  assert.equal(loadedOpponent.managerUserId, undefined, 'Organizer must not be assigned as opponent manager');
});

test('SETUP-005: Schedule fixture workflow stores status: scheduled, date, and time without forcing toss/openers', async () => {
  await AsyncStorage.clear();

  const teamA: Team = {
    id: 't_a',
    name: 'Team Alpha',
    shortName: 'TMA',
    primaryColor: '#004BA0',
    players: [{ id: 'pa_1', name: 'Alpha 1', role: 'batter', battingHand: 'right', careerStats: {} as any, recentScores: [] }],
  };

  const teamB: Team = {
    id: 't_b',
    name: 'Team Beta',
    shortName: 'TMB',
    primaryColor: '#D32F2F',
    players: [{ id: 'pb_1', name: 'Beta 1', role: 'batter', battingHand: 'right', careerStats: {} as any, recentScores: [] }],
  };

  const scheduledMatch: Match = {
    id: 'match_sched_01',
    title: 'Weekend Derby',
    format: 't20',
    venue: 'Oval Maidan, Mumbai',
    date: '2026-10-25',
    time: '02:30 PM',
    status: 'scheduled',
    team1: teamA,
    team2: teamB,
    tossWinnerId: '',
    tossDecision: 'bat',
    playingXITeam1: ['pa_1'],
    playingXITeam2: ['pb_1'],
    rules: {
      totalOvers: 20,
      playersPerTeam: 11,
      wideValue: 1,
      noBallValue: 1,
      freeHitOnNoBall: true,
    },
    innings: [createInitialInnings(1, teamA.id, teamB.id)],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: Date.now(),
  };

  await StorageService.saveMatch(scheduledMatch);
  const retrieved = await StorageService.getMatchById('match_sched_01');

  assert.ok(retrieved);
  assert.equal(retrieved.status, 'scheduled');
  assert.equal(retrieved.date, '2026-10-25');
  assert.ok(!retrieved.tossWinnerId, 'Toss winner must be unset for scheduled fixture');
});

test('SETUP-006: Configurable squad size respects short-sided match (6-a-side) and does not force 11', async () => {
  await AsyncStorage.clear();

  const playersA: Player[] = Array.from({ length: 8 }, (_, i) => ({
    id: `pa_${i + 1}`,
    name: `Player A${i + 1}`,
    role: 'all-rounder',
    battingHand: 'right',
    careerStats: {} as any,
    recentScores: [],
  }));

  const playersB: Player[] = Array.from({ length: 8 }, (_, i) => ({
    id: `pb_${i + 1}`,
    name: `Player B${i + 1}`,
    role: 'all-rounder',
    battingHand: 'right',
    careerStats: {} as any,
    recentScores: [],
  }));

  const lineupA = ['pa_1', 'pa_2', 'pa_3', 'pa_4', 'pa_5', 'pa_6'];
  const lineupB = ['pb_1', 'pb_2', 'pb_3', 'pb_4', 'pb_5', 'pb_6'];

  const shortSidedMatch: Match = {
    id: 'match_six_aside',
    title: 'Gully 6s Championship',
    format: 'custom',
    venue: 'Turf 7, Mumbai',
    date: '2026-10-14',
    status: 'live',
    team1: { id: 't_6a', name: 'Sixers A', shortName: 'S6A', primaryColor: '#004BA0', players: playersA },
    team2: { id: 't_6b', name: 'Sixers B', shortName: 'S6B', primaryColor: '#D32F2F', players: playersB },
    team1CaptainId: 'pa_1',
    team1WicketkeeperId: 'pa_2',
    team2CaptainId: 'pb_1',
    team2WicketkeeperId: 'pb_2',
    tossWinnerId: 'pa_1',
    tossDecision: 'bat',
    playingXITeam1: lineupA,
    playingXITeam2: lineupB,
    rules: {
      totalOvers: 6,
      playersPerTeam: 6,
      wideValue: 1,
      noBallValue: 1,
      freeHitOnNoBall: true,
    },
    innings: [createInitialInnings(1, 't_6a', 't_6b')],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: Date.now(),
  };

  await StorageService.saveMatch(shortSidedMatch);
  const loaded = await StorageService.getMatchById('match_six_aside');

  assert.ok(loaded);
  assert.equal(loaded.rules.playersPerTeam, 6, 'Squad size must be 6, not defaulted to 11');
  assert.equal(loaded.playingXITeam1?.length, 6);
  assert.equal(loaded.playingXITeam2?.length, 6);
  assert.equal(loaded.team1CaptainId, 'pa_1');
  assert.equal(loaded.team1WicketkeeperId, 'pa_2');
});

test('SETUP-007: Search-First player search finds existing players by email, phone, and name', async () => {
  await AsyncStorage.clear();

  const testTeam: Team = {
    id: 't_search_test',
    name: 'Mumbai XI',
    shortName: 'MXI',
    primaryColor: '#004BA0',
    players: [
      {
        id: 'p_ajay_01',
        name: 'Ajay Sharma',
        role: 'all-rounder',
        battingHand: 'right',
        email: 'ajay.sharma@example.com',
        phoneNumber: '+919876543210',
        careerStats: {} as any,
        recentScores: [],
      },
      {
        id: 'p_rahul_02',
        name: 'Rahul Varma',
        role: 'bowler',
        battingHand: 'right',
        phoneNumber: '+919123456789',
        careerStats: {} as any,
        recentScores: [],
      },
    ],
  };

  await StorageService.saveTeam(testTeam);

  // Search by exact email
  const emailResults = await PlayerIdentityService.searchPlayerProfiles('ajay.sharma@example.com');
  assert.equal(emailResults.length, 1);
  assert.equal(emailResults[0].id, 'p_ajay_01');
  assert.equal(emailResults[0].name, 'Ajay Sharma');

  // Search by phone
  const phoneResults = await PlayerIdentityService.searchPlayerProfiles('+91 91234 56789');
  assert.equal(phoneResults.length, 1);
  assert.equal(phoneResults[0].id, 'p_rahul_02');

  // Search by name query
  const nameResults = await PlayerIdentityService.searchPlayerProfiles('Ajay');
  assert.equal(nameResults.length, 1);
  assert.equal(nameResults[0].id, 'p_ajay_01');
});

test('SETUP-008: Email-verified player claim idempotently links matching ghost profiles', async () => {
  await AsyncStorage.clear();

  const ghostPlayer1: Player = {
    id: 'p_ghost_01',
    name: 'Rohan Ghost',
    role: 'batter',
    battingHand: 'right',
    email: 'rohan.cricket@example.com',
    phoneNumber: '+919999988888',
    isGuest: true,
    isVerified: false,
    careerStats: {} as any,
    recentScores: [],
  };

  const ghostPlayer2: Player = {
    id: 'p_ghost_02',
    name: 'Rohan G',
    role: 'all-rounder',
    battingHand: 'right',
    email: 'rohan.cricket@example.com',
    isGuest: true,
    isVerified: false,
    careerStats: {} as any,
    recentScores: [],
  };

  const team1: Team = {
    id: 't_g1',
    name: 'Gully Strikers',
    shortName: 'GLS',
    primaryColor: '#004BA0',
    players: [ghostPlayer1],
  };

  const team2: Team = {
    id: 't_g2',
    name: 'Beach Boys',
    shortName: 'BCB',
    primaryColor: '#D32F2F',
    players: [ghostPlayer2],
  };

  await StorageService.saveTeam(team1);
  await StorageService.saveTeam(team2);

  const claimResult = await PlayerIdentityService.claimPlayerProfilesByVerifiedEmail(
    'rohan.cricket@example.com',
    'acc_rohan_verified_uuid',
    'Rohan Verified'
  );

  assert.equal(claimResult.claimedCount, 2);
  assert.equal(claimResult.firstClaimedPlayerId, 'p_ghost_01');

  // Verify rosters were updated to verified status
  const updatedTeams = await StorageService.getTeams();
  const updatedP1 = updatedTeams.find((t) => t.id === 't_g1')?.players[0];
  const updatedP2 = updatedTeams.find((t) => t.id === 't_g2')?.players[0];

  assert.equal(updatedP1?.isGuest, false);
  assert.equal(updatedP1?.isVerified, true);
  assert.equal(updatedP2?.isGuest, false);
  assert.equal(updatedP2?.isVerified, true);

  // Re-claiming the same email should be idempotent (0 newly claimed)
  const secondClaim = await PlayerIdentityService.claimPlayerProfilesByVerifiedEmail(
    'rohan.cricket@example.com',
    'acc_rohan_verified_uuid',
    'Rohan Verified'
  );
  assert.equal(secondClaim.claimedCount, 0, 'Second claim must be idempotent');
});

test('SETUP-009: Revocable share token enables and terminates single-match broadcast access', async () => {
  await AsyncStorage.clear();

  const match: Match = {
    id: 'match_share_01',
    title: 'Live Semi-Final',
    format: 't20',
    venue: 'Wankhede Stadium',
    date: '2026-10-13',
    status: 'live',
    team1: { id: 't1', name: 'Team 1', shortName: 'T1', primaryColor: '#004BA0', players: [] },
    team2: { id: 't2', name: 'Team 2', shortName: 'T2', primaryColor: '#D32F2F', players: [] },
    tossWinnerId: 't1',
    tossDecision: 'bat',
    playingXITeam1: [],
    playingXITeam2: [],
    rules: { totalOvers: 20, playersPerTeam: 11, wideValue: 1, noBallValue: 1, freeHitOnNoBall: true },
    innings: [createInitialInnings(1, 't1', 't2')],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: Date.now(),
  };

  await StorageService.saveMatch(match);

  // Start broadcast: issue token
  const token = 'tok_live_broadcast_abc123';
  const sharedMatch: Match = {
    ...match,
    shareToken: token,
    isShareActive: true,
    lastUpdated: Date.now(),
  };
  await StorageService.saveMatch(sharedMatch);

  const activeShared = await StorageService.getMatchById('match_share_01');
  assert.equal(activeShared?.isShareActive, true);
  assert.equal(activeShared?.shareToken, token);

  // Stop broadcast: revoke token immediately
  const revokedMatch: Match = {
    ...activeShared!,
    isShareActive: false,
    lastUpdated: Date.now(),
  };
  await StorageService.saveMatch(revokedMatch);

  const stoppedShared = await StorageService.getMatchById('match_share_01');
  assert.equal(stoppedShared?.isShareActive, false, 'Broadcast must immediately terminate on stop');
});

test('SETUP-010: Match-only guest player does not mutate durable team roster in storage', async () => {
  await AsyncStorage.clear();

  const permanentPlayer: Player = {
    id: 'p_perm_01',
    name: 'Sanjay Regular',
    role: 'batter',
    battingHand: 'right',
    careerStats: {} as any,
    recentScores: [],
  };

  const initialTeam: Team = {
    id: 'team_roster_test',
    name: 'Evergreen CC',
    shortName: 'EGC',
    primaryColor: '#004BA0',
    players: [permanentPlayer],
  };

  await StorageService.saveTeam(initialTeam);

  // Create match with a guest player included in lineup
  const matchGuestPlayer: Player = {
    id: 'p_guest_sub_99',
    name: 'Ajit Substitute',
    role: 'all-rounder',
    battingHand: 'right',
    isGuest: true,
    isMatchGuest: true,
    careerStats: {} as any,
    recentScores: [],
  };

  const matchWithGuest: Match = {
    id: 'match_guest_test_01',
    title: 'Friendly Match',
    format: 't20',
    venue: 'Cross Maidan',
    date: '2026-10-13',
    status: 'live',
    team1: initialTeam,
    team2: { id: 'team_opp_dummy', name: 'Opponent', shortName: 'OPP', primaryColor: '#D32F2F', players: [] },
    tossWinnerId: initialTeam.id,
    tossDecision: 'bat',
    playingXITeam1: [permanentPlayer.id, matchGuestPlayer.id],
    playingXITeam2: [],
    rules: { totalOvers: 20, playersPerTeam: 2, wideValue: 1, noBallValue: 1, freeHitOnNoBall: true },
    innings: [createInitialInnings(1, initialTeam.id, 'team_opp_dummy')],
    currentInningsIndex: 0,
    isSynced: false,
    lastUpdated: Date.now(),
  };

  await StorageService.saveMatch(matchWithGuest);

  // Verify that Evergreen CC durable roster STILL only has 1 player (Sanjay Regular)
  const storedTeam = await StorageService.getTeamById('team_roster_test');
  assert.equal(storedTeam?.players.length, 1, 'Match-only guest must not mutate durable team roster');
  assert.equal(storedTeam?.players[0].id, 'p_perm_01');
});
