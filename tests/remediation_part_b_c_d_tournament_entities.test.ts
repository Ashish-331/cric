import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StorageService } from '../src/storage/storageService';
import { CricketEngine, createInitialInnings } from '../src/engine/cricketEngine';
import type { Team, Tournament, Match, MatchRules, Delivery } from '../src/types/cricket';

test('Parts B, C, D: Canonical squad snapshot, entry review, and roster freezing', async () => {
  // 1. Setup permanent club team with 11 players
  const initialPlayers = Array.from({ length: 11 }, (_, i) => ({
    id: `player_${i + 1}`,
    name: `Player ${i + 1}`,
    role: (i === 0 ? 'batter' : i === 1 ? 'wicketkeeper' : i < 6 ? 'all-rounder' : 'bowler') as any,
    battingHand: 'right' as const,
    careerStats: {
      matches: 0,
      inningsBatted: 0,
      runs: 0,
      highestScore: 0,
      average: 0,
      strikeRate: 0,
      fifties: 0,
      hundreds: 0,
      fours: 0,
      sixes: 0,
      wickets: 0,
      oversBowled: 0,
      maidens: 0,
      runsConceded: 0,
      bowlingAverage: 0,
      bowlingEconomy: 0,
      bestBowling: '0/0',
      catches: 0,
      stumpings: 0,
      runOuts: 0,
    },
  }));

  const clubTeam: Team = {
    id: 'club_royal_challengers',
    name: 'Royal Challengers Club',
    shortName: 'RCC',
    primaryColor: '#DC2626',
    players: initialPlayers,
  };
  await StorageService.saveTeam(clubTeam);

  // 2. Create a tournament
  const tournament: Tournament = {
    id: 'tourn_premier_2026',
    name: 'Premier League 2026',
    format: 't20',
    totalOvers: 20,
    ballType: 'leather',
    creatorUserId: 'organizer_1',
    creatorName: 'Tournament Admin',
    teams: [],
    matches: [],
    status: 'registration_open',
    createdAt: Date.now(),
  };
  await StorageService.saveTournament(tournament);

  // 3. Captain submits tournament entry with current squad snapshot
  const entry = await StorageService.submitTournamentEntry(
    tournament.id,
    clubTeam,
    { id: 'user_captain_1', name: 'Player 1', role: 'captain', isGuest: false, isVerified: true }
  );

  assert.equal(entry.status, 'submitted');
  assert.equal(entry.squad.length, 11);
  assert.equal(entry.squad[0].playerId, 'player_1');

  // 4. Club adds a 12th and 13th player to permanent club roster
  const updatedClub = await StorageService.getTeamById(clubTeam.id);
  assert(updatedClub);
  updatedClub.players.push({
    id: 'player_12_new_signing',
    name: 'New Signing Player 12',
    role: 'all-rounder',
    battingHand: 'left',
    careerStats: { ...initialPlayers[0].careerStats },
  });
  updatedClub.players.push({
    id: 'player_13_new_signing',
    name: 'New Signing Player 13',
    role: 'bowler',
    battingHand: 'right',
    careerStats: { ...initialPlayers[0].careerStats },
  });
  await StorageService.saveTeam(updatedClub);

  // Verify permanent club now has 13 players
  const verifiedClub = await StorageService.getTeamById(clubTeam.id);
  assert.equal(verifiedClub?.players.length, 13);

  // Verify submitted tournament entry's squad was NOT mutated by permanent club changes
  const storedEntry = await StorageService.getTournamentEntryById(entry.id);
  assert(storedEntry);
  assert.equal(storedEntry.squad.length, 11, 'Tournament entry squad must remain frozen at 11');

  // 5. Organizer reviews and approves the entry
  const reviewed = await StorageService.reviewTournamentEntry(
    entry.id,
    'approved',
    'organizer_1',
    'Squad verified and approved'
  );
  assert.equal(reviewed.status, 'approved');

  // 6. Verify tournament teams now includes clubTeam with FROZEN 11 players, NOT 13!
  const updatedTournament = await StorageService.getTournamentById(tournament.id);
  assert(updatedTournament);
  assert.equal(updatedTournament.teams.length, 1);
  const enrolledTeam = updatedTournament.teams[0];
  assert.equal(enrolledTeam.id, clubTeam.id);
  assert.equal(enrolledTeam.players.length, 11, 'Approved tournament team roster must be frozen to 11 players');
  assert(!enrolledTeam.players.some((p) => p.id === 'player_12_new_signing'));

  // 7. Organizer locks the tournament squad
  const lockedTournament = await StorageService.lockTournamentSquad(tournament.id);
  assert(lockedTournament);
  assert.equal(lockedTournament.isSquadLocked, true);
});

test('Part E: Custom match sizes (6-a-side) enforce all-out at 5 wickets (playersPerTeam - 1)', () => {
  const sixSideRules: MatchRules = {
    totalOvers: 5,
    playersPerTeam: 6, // 6 players per team -> all out at 5 wickets
    wideValue: 1,
    noBallValue: 1,
    freeHitOnNoBall: true,
  };

  let inn = createInitialInnings(1, 'teamA', 'teamB', 'bat1', 'bat2', 'bowl1');

  // Bowler takes 4 wickets
  for (let w = 1; w <= 4; w++) {
    inn = CricketEngine.applyDelivery(
      inn,
      {
        id: `del_${w}`,
        ballNumberInMatch: w,
        ballInOver: w,
        overIndex: 0,
        strikerId: inn.currentStrikerId || `bat${w + 2}`,
        nonStrikerId: inn.currentNonStrikerId || 'bat2',
        bowlerId: 'bowl1',
        runsBat: 0,
        runsExtra: 0,
        extraType: 'none',
        isLegalDelivery: true,
        isBoundary: false,
        isSix: false,
        isWicket: true,
        wicketDetails: {
          dismissalType: 'bowled',
          playerDismissedId: inn.currentStrikerId || `bat${w + 2}`,
        },
        commentary: 'Bowled!',
        timestamp: Date.now(),
      },
      sixSideRules
    );
    // Not all out yet at 4 wickets for 6-a-side
    assert.equal(inn.totalWickets, w);
    assert.equal(inn.isCompleted, false, `Should not be completed at ${w} wickets`);

    // Assign next batter
    inn.currentStrikerId = `bat${w + 2}`;
  }

  // 5th wicket falls
  inn = CricketEngine.applyDelivery(
    inn,
    {
      id: 'del_5',
      ballNumberInMatch: 5,
      ballInOver: 5,
      overIndex: 0,
      strikerId: inn.currentStrikerId || 'bat6',
      nonStrikerId: inn.currentNonStrikerId || 'bat2',
      bowlerId: 'bowl1',
      runsBat: 0,
      runsExtra: 0,
      extraType: 'none',
      isLegalDelivery: true,
      isBoundary: false,
      isSix: false,
      isWicket: true,
      wicketDetails: {
        dismissalType: 'bowled',
        playerDismissedId: inn.currentStrikerId || 'bat6',
      },
      commentary: 'Bowled!',
      timestamp: Date.now(),
    },
    sixSideRules
  );

  // 5 wickets in 6-a-side = All Out!
  assert.equal(inn.totalWickets, 5);
  assert.equal(inn.isCompleted, true, '6-a-side match must be completed at 5 wickets');
  assert.equal(inn.completedReason, 'All Out');
});
