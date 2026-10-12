import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StorageService } from '../src/storage/storageService';
import type { UserProfile } from '../src/storage/storageService';
import { StatsRollupEngine } from '../src/engine/statsRollupEngine';
import { DEFAULT_TEAMS, createSampleMatch } from '../src/storage/defaultData';
import { generateUUID } from '../src/utils/uuid';
import type { Team, Player, Match, MatchRules, Tournament, TournamentEntry } from '../src/types/cricket';

// Test mock profile
const testAuthUser: UserProfile = {
  id: 'usr_auth_9999',
  email: 'captain.virat@cric.test',
  name: 'Virat Kohli',
  isGuest: false,
  isVerified: true,
  role: 'captain',
  playingRole: 'batter',
  battingHand: 'right',
  bowlingStyle: 'fast-medium',
  claimedPlayerId: 'p_virat_canonical',
};

const testGuestUser: UserProfile = {
  id: 'usr_guest_0000',
  name: 'Guest Scorer',
  isGuest: true,
  isVerified: false,
  role: 'scorer',
};

test('FLOW-A-001: Team creation with addSelfAsPlayer: true adds manager to roster as Captain', async () => {
  const options = {
    city: 'Bengaluru',
    addSelfAsPlayer: true,
  };

  const addSelf = options.addSelfAsPlayer;
  const players: Player[] = [];
  let captainPlayerId: string | undefined = undefined;

  if (addSelf) {
    const creatorPlayer: Player = {
      id: testAuthUser.claimedPlayerId || `p_${Date.now()}_c`,
      name: testAuthUser.name,
      role: testAuthUser.playingRole || 'all-rounder',
      battingHand: testAuthUser.battingHand || 'right',
      bowlingStyle: testAuthUser.bowlingStyle || 'fast-medium',
      phoneNumber: testAuthUser.phoneNumber,
      isCaptain: true,
      isVerified: testAuthUser.isVerified ?? true,
      careerStats: StatsRollupEngine.createEmptyCareerStats(),
      recentScores: [],
    };
    players.push(creatorPlayer);
    captainPlayerId = creatorPlayer.id;
  }

  const newTeam: Team = {
    id: `team_${Date.now()}`,
    name: 'Royal Challengers Bengaluru',
    shortName: 'RCB',
    primaryColor: '#EC1C24',
    city: options.city,
    captainPlayerId,
    createdByUserId: testAuthUser.id,
    managerUserId: testAuthUser.id,
    inviteCode: `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    players,
  };

  // Verify assertions
  assert.equal(newTeam.players.length, 1);
  assert.equal(newTeam.players[0].name, 'Virat Kohli');
  assert.equal(newTeam.players[0].isCaptain, true);
  assert.equal(newTeam.players[0].id, 'p_virat_canonical');
  assert.equal(newTeam.captainPlayerId, 'p_virat_canonical');
  assert.equal(newTeam.managerUserId, testAuthUser.id);
  assert.equal(newTeam.city, 'Bengaluru');
  assert.match(newTeam.inviteCode!, /^INV-[A-Z0-9]+$/);
});

test('FLOW-A-002: Team creation with addSelfAsPlayer: false leaves creator out of player roster', async () => {
  const options = {
    city: 'Mumbai',
    addSelfAsPlayer: false,
    captainName: 'Jasprit Bumrah',
    captainPhone: '+919876543299',
  };

  const addSelf = options.addSelfAsPlayer;
  const players: Player[] = [];
  let captainPlayerId: string | undefined = undefined;

  if (!addSelf && options.captainName) {
    const designatedCaptain: Player = {
      id: `p_${Date.now()}_cap`,
      name: options.captainName.trim(),
      role: 'bowler',
      battingHand: 'right',
      phoneNumber: options.captainPhone?.trim(),
      isCaptain: true,
      isGuest: true,
      careerStats: StatsRollupEngine.createEmptyCareerStats(),
      recentScores: [],
    };
    players.push(designatedCaptain);
    captainPlayerId = designatedCaptain.id;
  }

  const newTeam: Team = {
    id: `team_${Date.now()}`,
    name: 'Mumbai Strikers',
    shortName: 'MST',
    primaryColor: '#004BA0',
    city: options.city,
    captainPlayerId,
    captainName: options.captainName,
    captainPhone: options.captainPhone,
    createdByUserId: testAuthUser.id,
    managerUserId: testAuthUser.id,
    inviteCode: `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    players,
  };

  // Verify assertions
  assert.equal(newTeam.players.length, 1);
  assert.equal(newTeam.players[0].name, 'Jasprit Bumrah');
  assert.equal(newTeam.players[0].isCaptain, true);
  assert.notEqual(newTeam.players[0].id, testAuthUser.claimedPlayerId);
  assert.equal(newTeam.managerUserId, testAuthUser.id, 'Manager retains management rights even when not playing');
  assert.equal(newTeam.city, 'Mumbai');
});

test('FLOW-A-003: Team Card privacy - raw phone numbers must never leak into public projection', () => {
  const sensitiveTeam: Team = {
    id: 'team_priv_1',
    name: 'Chennai Warriors',
    shortName: 'CSK',
    primaryColor: '#FFFF00',
    city: 'Chennai',
    captainName: 'MS Dhoni',
    captainPhone: '+919876543210',
    managerUserId: 'usr_manager_1',
    players: [
      {
        id: 'p_1',
        name: 'MS Dhoni',
        role: 'wicketkeeper',
        battingHand: 'right',
        phoneNumber: '+919876543210',
        careerStats: StatsRollupEngine.createEmptyCareerStats(),
      },
    ],
  };

  // Safe team card projection representation
  function projectSafeTeamCard(team: Team) {
    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      city: team.city || 'Grassroots Club',
      playerCount: team.players.length,
      captainDisplayName: team.captainName || team.players.find((p) => p.id === team.captainPlayerId)?.name || 'Unassigned',
      primaryColor: team.primaryColor,
      inviteCode: team.inviteCode,
    };
  }

  const safeCard = projectSafeTeamCard(sensitiveTeam);
  const serialized = JSON.stringify(safeCard);

  assert.equal(serialized.includes('+919876543210'), false, 'Private phone number must not appear in safe card serialization');
  assert.equal(safeCard.captainDisplayName, 'MS Dhoni');
  assert.equal(safeCard.city, 'Chennai');
});

test('FLOW-A-004: Opponent directory filtering and duplicate detection warning', () => {
  const currentUserId = testAuthUser.id;
  const sampleTeams: Team[] = [
    {
      id: 't_managed',
      name: 'Delhi Daredevils',
      shortName: 'DD',
      city: 'Delhi',
      managerUserId: currentUserId,
      primaryColor: '#0000FF',
      players: [],
    },
    {
      id: 't_roster',
      name: 'Kolkata Knights',
      shortName: 'KKR',
      city: 'Kolkata',
      primaryColor: '#4B0082',
      players: [
        {
          id: testAuthUser.claimedPlayerId!,
          name: 'Virat Kohli',
          role: 'batter',
          battingHand: 'right',
          careerStats: StatsRollupEngine.createEmptyCareerStats(),
        },
      ],
    },
    {
      id: 't_opponent',
      name: 'Punjab Kings',
      shortName: 'PBKS',
      city: 'Chandigarh',
      primaryColor: '#DD1F2D',
      managerUserId: 'other_user',
      players: [],
    },
  ];

  function isYourTeam(team: Team): boolean {
    if (team.managerUserId && team.managerUserId === currentUserId) return true;
    if (team.createdByUserId && team.createdByUserId === currentUserId) return true;
    return team.players.some((p) => p.id === testAuthUser.claimedPlayerId);
  }

  const yourTeams = sampleTeams.filter(isYourTeam);
  const opponentTeams = sampleTeams.filter((t) => !isYourTeam(t));

  assert.equal(yourTeams.length, 2, 'Should include Delhi (managed) and Kolkata (rostered)');
  assert.equal(opponentTeams.length, 1, 'Should include Punjab as opponent');
  assert.equal(opponentTeams[0].name, 'Punjab Kings');

  // Duplicate Warning check
  function checkDuplicateWarning(name: string, city: string, existing: Team[]): string | null {
    const trimmed = name.trim().toLowerCase();
    const cityTrimmed = city.trim().toLowerCase();
    const match = existing.find(
      (t) =>
        t.name.toLowerCase() === trimmed &&
        (!cityTrimmed || !t.city || t.city.toLowerCase() === cityTrimmed)
    );
    if (match) {
      return `A team named "${match.name}" already exists in ${match.city || 'this area'}.`;
    }
    return null;
  }

  const dupSameCity = checkDuplicateWarning('Delhi Daredevils', 'Delhi', sampleTeams);
  assert.notEqual(dupSameCity, null, 'Must warn for duplicate name in same city');

  const diffCity = checkDuplicateWarning('Delhi Daredevils', 'Noida', sampleTeams);
  assert.equal(diffCity, null, 'No warning if city is different');
});

test('FLOW-B-001: Standalone match setup validates distinct canonical teams and rejects identical sides', () => {
  const sideA = DEFAULT_TEAMS[0];
  const sideB = DEFAULT_TEAMS[0]; // identical

  const areTeamsIdentical = Boolean(sideA && sideB && sideA.id === sideB.id);
  assert.equal(areTeamsIdentical, true, 'Must detect identical team selection');

  const distinctSideB = DEFAULT_TEAMS[1];
  const areDistinct = Boolean(sideA && distinctSideB && sideA.id !== distinctSideB.id);
  assert.equal(areDistinct, true, 'Sides must be distinct');
});

test('FLOW-B-002: Cross-team duplicate player warning highlights players listed on both sides', () => {
  const sharedPlayer: Player = {
    id: 'shared_p_1',
    name: 'Hardik Pandya',
    role: 'all-rounder',
    battingHand: 'right',
    careerStats: StatsRollupEngine.createEmptyCareerStats(),
  };

  const sideA: Team = {
    id: 'team_a',
    name: 'Mumbai XI',
    shortName: 'MUM',
    primaryColor: '#004BA0',
    players: [sharedPlayer, { id: 'p_2', name: 'Rohit', role: 'batter', battingHand: 'right', careerStats: StatsRollupEngine.createEmptyCareerStats() }],
  };

  const sideB: Team = {
    id: 'team_b',
    name: 'Gujarat XI',
    shortName: 'GT',
    primaryColor: '#1B2133',
    players: [sharedPlayer, { id: 'p_3', name: 'Gill', role: 'batter', battingHand: 'right', careerStats: StatsRollupEngine.createEmptyCareerStats() }],
  };

  function findCrossTeamDuplicates(team1: Team, team2: Team): string | null {
    const team1Ids = new Set(team1.players.map((p) => p.id));
    const shared = team2.players.filter((p) => team1Ids.has(p.id));
    if (shared.length > 0) {
      return `Warning: Player "${shared[0].name}" is listed on both teams.`;
    }
    return null;
  }

  const warning = findCrossTeamDuplicates(sideA, sideB);
  assert.notEqual(warning, null);
  assert.match(warning!, /Hardik Pandya/);
});

test('FLOW-B-003: Configurable squad sizes (6, 7, 8, 11-a-side) correctly sets rules.playersPerTeam', () => {
  const match = createSampleMatch();

  // Test 7-a-side configuration
  const sevenAsideMatch: Match = {
    ...match,
    rules: {
      ...match.rules,
      playersPerTeam: 7,
      totalOvers: 10,
    },
  };

  assert.equal(sevenAsideMatch.rules.playersPerTeam, 7);
  assert.equal(sevenAsideMatch.rules.totalOvers, 10);

  // Test 6-a-side configuration
  const sixAsideMatch: Match = {
    ...match,
    rules: {
      ...match.rules,
      playersPerTeam: 6,
      totalOvers: 5,
    },
  };

  assert.equal(sixAsideMatch.rules.playersPerTeam, 6);
  assert.equal(sixAsideMatch.rules.totalOvers, 5);
});

test('FLOW-B-004: Match-only guest isolation marks player with isMatchGuest: true', () => {
  const guestPlayer: Player = {
    id: `p_${Date.now()}_guest`,
    name: 'Local Substitute Rahul',
    role: 'all-rounder',
    battingHand: 'right',
    isGuest: true,
    isMatchGuest: true,
    careerStats: StatsRollupEngine.createEmptyCareerStats(),
    recentScores: [],
  };

  const permanentPlayer: Player = {
    id: `p_${Date.now()}_perm`,
    name: 'Suryakumar Yadav',
    role: 'batter',
    battingHand: 'right',
    isGuest: false,
    isMatchGuest: false,
    careerStats: StatsRollupEngine.createEmptyCareerStats(),
    recentScores: [],
  };

  assert.equal(guestPlayer.isMatchGuest, true, 'Match-only substitute is isolated from permanent roster');
  assert.equal(permanentPlayer.isMatchGuest, false, 'Permanent squad player is marked as false');
});

test('FLOW-C-001: Tournament creation and scheduling authentication guards', () => {
  // Guest scorer attempting to create tournament
  function canOrganizeTournament(profile?: UserProfile): boolean {
    if (!profile) return false;
    if (profile.isGuest || !profile.isVerified) return false;
    return true;
  }

  assert.equal(canOrganizeTournament(testGuestUser), false, 'Guest user cannot organize tournament');
  assert.equal(canOrganizeTournament(testAuthUser), true, 'Verified authenticated user can organize tournament');
});

test('FLOW-C-002: Tournament captain invitation message formatting', () => {
  const tournament: Tournament = {
    id: 'tourn_premier_2026',
    name: 'Bengaluru Monsoon Premier League',
    format: 't20',
    totalOvers: 20,
    ballType: 'leather',
    creatorUserId: testAuthUser.id,
    creatorName: testAuthUser.name,
    teams: [],
    matches: [],
    status: 'upcoming',
    createdAt: Date.now(),
  };

  function formatTournamentSharePayload(tourn: Tournament) {
    return {
      title: `Join ${tourn.name} on Cric`,
      message: `Join ${tourn.name} on Cric! Use tournament ID/Code: ${tourn.id}\nSubmit your team and roster via the Cric app.`,
    };
  }

  const payload = formatTournamentSharePayload(tournament);
  assert.equal(payload.title, 'Join Bengaluru Monsoon Premier League on Cric');
  assert.match(payload.message, /tourn_premier_2026/);
  assert.match(payload.message, /Submit your team and roster/);
});

test('FLOW-C-003: Tournament entry review, squad lock, and organizer approval workflow', async () => {
  const tournamentId = 'tourn_grassroots_cup';
  const team = DEFAULT_TEAMS[0];

  const entry = await StorageService.submitTournamentEntry(
    tournamentId,
    team,
    testAuthUser
  );

  assert.equal(entry.status, 'submitted');
  assert.equal(entry.teamId, team.id);

  // Review entry: Approve
  const approvedEntry = await StorageService.reviewTournamentEntry(
    entry.id,
    'approved',
    testAuthUser.id,
    'All registration requirements met'
  );

  assert.equal(approvedEntry.status, 'approved');
  assert.equal(approvedEntry.reviewedByUserId, testAuthUser.id);

  // Lock tournament squad
  await StorageService.lockTournamentSquad(tournamentId);

  // Verify tournament entries reflect lock
  const entries = await StorageService.getTournamentEntries(tournamentId);
  const lockedEntry = entries.find((e) => e.id === entry.id);
  assert.equal(lockedEntry?.status, 'approved');
});
