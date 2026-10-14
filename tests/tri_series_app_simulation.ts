import { getDatabase, resetDatabaseInstance } from '../src/repositories/sqlite/database';
import { SQLiteMatchRepository } from '../src/repositories/sqlite/sqliteMatchRepository';
import { SQLiteTeamRepository } from '../src/repositories/sqlite/sqliteTeamRepository';
import { SQLiteTournamentRepository } from '../src/repositories/sqlite/sqliteTournamentRepository';
import { CricketEngine } from '../src/engine/cricketEngine';
import { TournamentEngine } from '../src/engine/tournamentEngine';
import type { TournamentStanding } from '../src/engine/tournamentEngine';
import { StatsRollupEngine } from '../src/engine/statsRollupEngine';
import { generateUUID } from '../src/utils/uuid';
import type {
  Team,
  Player,
  Match,
  Innings,
  Delivery,
  Tournament,
  MatchRules,
  TossDecision,
  DismissalType,
  ExtraType,
} from '../src/types/cricket';
import fs from 'node:fs';
import path from 'node:path';

// --- Helper Functions to build players and teams ---
function makePlayer(
  id: string,
  name: string,
  role: Player['role'],
  battingHand: 'right' | 'left',
  bowlingStyle?: string,
  isCaptain = false,
  isWicketkeeper = false
): Player {
  return {
    id,
    name,
    role,
    battingStyle: battingHand === 'right' ? 'Right-hand bat' : 'Left-hand bat',
    bowlingStyle: bowlingStyle || (role === 'bowler' ? 'Right-arm medium' : undefined),
    isCaptain,
    isWicketkeeper,
    isGuest: false,
    phoneNumber: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@cricapp.internal`,
    careerStats: StatsRollupEngine.createEmptyCareerStats(),
    recentScores: [],
  };
}

export async function runTriSeriesSimulation() {
  console.log('=== STARTING CRIC APP 3-TEAM TRI-SERIES & 33-PLAYER QA SIMULATION ===');
  resetDatabaseInstance();
  const db = await getDatabase();
  const matchRepo = new SQLiteMatchRepository();
  const teamRepo = new SQLiteTeamRepository();
  const tourneyRepo = new SQLiteTournamentRepository();

  // 1. MANAGE 33 PLAYERS ACROSS 3 TEAMS
  console.log('\n--- PHASE 1: CREATING 3 TEAMS & 33 UNIQUE PLAYERS ---');

  // Team 1: Mumbai Strikers (MS)
  const team1Players: Player[] = [
    makePlayer('ms_01', 'Rohit Deshmukh', 'top-order-batter', 'right', undefined, true, false),
    makePlayer('ms_02', 'Varun Kulkarni', 'opening-batter', 'left', undefined, false, false),
    makePlayer('ms_03', 'Aryan Merchant', 'top-order-batter', 'right', undefined, false, false),
    makePlayer('ms_04', 'Aditya Rane', 'wicketkeeper', 'right', undefined, false, true),
    makePlayer('ms_05', 'Devendra Joshi', 'middle-order-batter', 'right', undefined, false, false),
    makePlayer('ms_06', 'Kabir Sawant', 'all-rounder', 'right', 'Right-arm fast-medium', false, false),
    makePlayer('ms_07', 'Pranav Nadkarni', 'all-rounder', 'left', 'Left-arm orthodox', false, false),
    makePlayer('ms_08', 'Samar Patel', 'bowler', 'right', 'Right-arm offbreak', false, false),
    makePlayer('ms_09', 'Chetan Shinde', 'bowler', 'right', 'Right-arm fast', false, false),
    makePlayer('ms_10', 'Imran Shaikh', 'bowler', 'left', 'Left-arm fast', false, false),
    makePlayer('ms_11', 'Mayank Vora', 'bowler', 'right', 'Right-arm legbreak', false, false),
  ];

  const team1: Team = {
    id: 'team_mumbai_strikers',
    name: 'Mumbai Strikers',
    shortName: 'MS',
    primaryColor: '#1A5336',
    captainPlayerId: 'ms_01',
    players: team1Players,
    createdAt: Date.now(),
  };

  // Team 2: Delhi Hawks (DH)
  const team2Players: Player[] = [
    makePlayer('dh_01', 'Shikhar Dhawanji', 'opening-batter', 'left', undefined, true, false),
    makePlayer('dh_02', 'Yashpal Sehrawat', 'opening-batter', 'right', undefined, false, false),
    makePlayer('dh_03', 'Rishabh Vats', 'wicketkeeper', 'left', undefined, false, true),
    makePlayer('dh_04', 'Gautam Bakshi', 'top-order-batter', 'left', undefined, false, false),
    makePlayer('dh_05', 'Kunal Chadha', 'middle-order-batter', 'right', undefined, false, false),
    makePlayer('dh_06', 'Hardik Oberoi', 'all-rounder', 'right', 'Right-arm medium-fast', false, false),
    makePlayer('dh_07', 'Manan Grover', 'all-rounder', 'right', 'Right-arm offbreak', false, false),
    makePlayer('dh_08', 'Tarun Kaushik', 'bowler', 'right', 'Right-arm legbreak', false, false),
    makePlayer('dh_09', 'Ankit Mishra', 'bowler', 'left', 'Left-arm orthodox', false, false),
    makePlayer('dh_10', 'Jaspreet Gill', 'bowler', 'right', 'Right-arm fast', false, false),
    makePlayer('dh_11', 'Deepak Tyagi', 'bowler', 'right', 'Right-arm fast-medium', false, false),
  ];

  const team2: Team = {
    id: 'team_delhi_hawks',
    name: 'Delhi Hawks',
    shortName: 'DH',
    primaryColor: '#825500',
    captainPlayerId: 'dh_01',
    players: team2Players,
    createdAt: Date.now(),
  };

  // Team 3: Bangalore Titans (BT)
  const team3Players: Player[] = [
    makePlayer('bt_01', 'Virat Kohliya', 'top-order-batter', 'right', 'Right-arm medium', true, false),
    makePlayer('bt_02', 'Faf Devadiga', 'opening-batter', 'right', undefined, false, false),
    makePlayer('bt_03', 'Glenn DSouza', 'all-rounder', 'right', 'Right-arm offbreak', false, false),
    makePlayer('bt_04', 'Dinesh Karthikrao', 'wicketkeeper', 'right', undefined, false, true),
    makePlayer('bt_05', 'Rajat Patidarappa', 'top-order-batter', 'right', undefined, false, false),
    makePlayer('bt_06', 'Mahipal Lomroran', 'all-rounder', 'left', 'Left-arm orthodox', false, false),
    makePlayer('bt_07', 'Shahbaz Ahmedkar', 'all-rounder', 'left', 'Left-arm orthodox', false, false),
    makePlayer('bt_08', 'Wanindu Hasarangaiah', 'bowler', 'right', 'Right-arm legbreak', false, false),
    makePlayer('bt_09', 'Harshal Pateliah', 'bowler', 'right', 'Right-arm medium', false, false),
    makePlayer('bt_10', 'Mohammed Sirajkar', 'bowler', 'right', 'Right-arm fast', false, false),
    makePlayer('bt_11', 'Vijaykumar Vyshak', 'bowler', 'right', 'Right-arm medium-fast', false, false),
  ];

  const team3: Team = {
    id: 'team_bangalore_titans',
    name: 'Bangalore Titans',
    shortName: 'BT',
    primaryColor: '#BA1A1A',
    captainPlayerId: 'bt_01',
    players: team3Players,
    createdAt: Date.now(),
  };

  await teamRepo.saveTeam(team1);
  await teamRepo.saveTeam(team2);
  await teamRepo.saveTeam(team3);

  console.log(`Saved Team 1: ${team1.name} (${team1.players.length} players, Captain: ${team1Players[0].name})`);
  console.log(`Saved Team 2: ${team2.name} (${team2.players.length} players, Captain: ${team2Players[0].name})`);
  console.log(`Saved Team 3: ${team3.name} (${team3.players.length} players, Captain: ${team3Players[0].name})`);
  console.log(`Total active players managed: ${team1.players.length + team2.players.length + team3.players.length}`);

  // 2. ORGANIZE TRI-SERIES TOURNAMENT
  console.log('\n--- PHASE 2: ORGANIZING TRI-SERIES TOURNAMENT ---');
  const tournamentId = 'tourn_grassroots_tri_series_2026';
  const tournament: Tournament = {
    id: tournamentId,
    name: 'Grassroots Tri-Series Championship 2026',
    format: 't20',
    status: 'active',
    teams: [team1, team2, team3],
    matches: [],
    rules: {
      totalOvers: 5, // 5-over Grassroots Sprint
      playersPerTeam: 11,
      wideValue: 1,
      noBallValue: 1,
      freeHitOnNoBall: true,
    },
    startDate: '2026-10-14',
    endDate: '2026-10-20',
    createdAt: Date.now(),
    creatorUserId: 'organizer_ashish_master',
  };

  await tourneyRepo.saveTournament(tournament);
  console.log(`Tournament created: "${tournament.name}" (Format: 5-over sprint, Teams: ${tournament.teams.length})`);

  // Helper to create an initialized match entity
  const matchRules: MatchRules = tournament.rules;

  function createMatch(
    matchId: string,
    title: string,
    t1: Team,
    t2: Team,
    tossWinnerId: string,
    tossDecision: TossDecision
  ): Match {
    const battingFirstTeam = tossDecision === 'bat'
      ? (tossWinnerId === t1.id ? t1 : t2)
      : (tossWinnerId === t1.id ? t2 : t1);
    const bowlingFirstTeam = battingFirstTeam.id === t1.id ? t2 : t1;

    const initialInnings: Innings = {
      id: `inn_${matchId}_1`,
      inningsNumber: 1,
      battingTeamId: battingFirstTeam.id,
      bowlingTeamId: bowlingFirstTeam.id,
      totalRuns: 0,
      totalWickets: 0,
      legalBallsBowled: 0,
      overs: '0.0',
      runRate: 0,
      isCompleted: false,
      currentStrikerId: battingFirstTeam.players[0].id,
      currentNonStrikerId: battingFirstTeam.players[1].id,
      currentBowlerId: bowlingFirstTeam.players[10].id, // Last bowler opens
      deliveries: [],
      batterStats: {},
      bowlerStats: {},
      fallOfWickets: [],
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
    };

    return {
      id: matchId,
      title,
      format: 't20',
      venue: 'Wankhede Community Oval, Mumbai',
      date: '2026-10-14',
      status: 'live',
      team1: t1,
      team2: t2,
      team1CaptainId: t1.captainPlayerId,
      team2CaptainId: t2.captainPlayerId,
      playingXITeam1: t1.players.map((p) => p.id),
      playingXITeam2: t2.players.map((p) => p.id),
      tossWinnerId,
      tossDecision,
      ballType: 'leather',
      scorerName: 'Ashish (Official Scorer)',
      organizerName: 'Tri-Series Organising Committee',
      organizerUserId: 'organizer_ashish_master',
      tournamentId,
      rules: matchRules,
      innings: [initialInnings],
      currentInningsIndex: 0,
      isSynced: false,
      lastUpdated: Date.now(),
    };
  }

  // Helper to record a delivery into a match using the app's real engine & persistence
  async function scoreBall(
    match: Match,
    options: {
      runsBat: number;
      runsExtra?: number;
      extraType?: ExtraType;
      isWicket?: boolean;
      dismissalType?: DismissalType;
      dismissedPlayerId?: string;
      fielderId?: string;
      shotArea?: string;
      commentary?: string;
    }
  ): Promise<{ result: any; isOverComplete: boolean; isInningsComplete: boolean }> {
    const innIndex = match.currentInningsIndex;
    const currentInnings = match.innings[innIndex]!;
    const strikerId = currentInnings.currentStrikerId!;
    const nonStrikerId = currentInnings.currentNonStrikerId!;
    const bowlerId = currentInnings.currentBowlerId!;

    const isLegal = options.extraType !== 'wide' && options.extraType !== 'noBall';
    const deliveryIndexInMatch = currentInnings.deliveries.length + 1;
    const overIndex = Math.floor(currentInnings.legalBallsBowled / 6);
    const ballInOver = (currentInnings.legalBallsBowled % 6) + (isLegal ? 1 : 0);

    const delivery: Delivery = {
      id: `del_${match.id}_${innIndex + 1}_${deliveryIndexInMatch}`,
      ballNumberInMatch: deliveryIndexInMatch,
      overIndex,
      ballInOver,
      isLegalDelivery: isLegal,
      strikerId,
      nonStrikerId,
      bowlerId,
      runsBat: options.runsBat,
      runsExtra: options.runsExtra || 0,
      extraType: options.extraType,
      isBoundary: options.runsBat === 4,
      isSix: options.runsBat === 6,
      isWicket: Boolean(options.isWicket),
      wicketDetails: options.isWicket
        ? {
            dismissalType: options.dismissalType || 'bowled',
            playerDismissedId: options.dismissedPlayerId || strikerId,
            bowlerId,
            fielderId: options.fielderId,
          }
        : undefined,
      commentary: options.commentary || '',
      shotArea: options.shotArea as any,
      timestamp: Date.now(),
    };

    if (!delivery.commentary) {
      delivery.commentary = CricketEngine.generateDeliveryCommentary(delivery);
    }

    const commandResult = CricketEngine.executeScoringCommand(
      currentInnings,
      delivery,
      match.rules,
      match.targetRuns
    );

    if (!commandResult.accepted) {
      throw new Error(`Delivery rejected by CricketEngine: ${commandResult.rejectionReason}`);
    }

    // Update match state
    match.innings[innIndex] = commandResult.innings;
    match.revision = (match.revision || 0) + 1;
    match.lastUpdated = Date.now();

    // Check innings / match completion
    if (innIndex === 1 && commandResult.innings.isCompleted) {
      match.status = 'completed';
      match.result = CricketEngine.evaluateMatchResult(match);
    } else if (innIndex === 0 && commandResult.innings.isCompleted) {
      match.status = 'innings_break';
    }

    // Record action into SQLite immutable ledger
    await matchRepo.appendAction(
      match.id,
      { type: 'DELIVERY', delivery },
      match.revision - 1,
      1,
      match,
      delivery.id
    );

    return {
      result: commandResult,
      isOverComplete: commandResult.isOverComplete,
      isInningsComplete: commandResult.isInningsComplete,
    };
  }

  // --- MATCH 1: Mumbai Strikers vs Delhi Hawks ---
  console.log('\n======================================================');
  console.log('--- PHASE 3: MATCH 1 — MUMBAI STRIKERS vs DELHI HAWKS ---');
  console.log('======================================================');

  const match1 = createMatch(
    'match_tri_01',
    'Tri-Series Match 1: MS vs DH',
    team1,
    team2,
    team1.id, // Mumbai Strikers win toss
    'bat'     // Choose to bat first
  );
  await matchRepo.saveMatch(match1);

  console.log(`Toss: ${team1.name} won the toss and elected to BAT first.`);
  console.log(`Openers: ${team1Players[0].name} (Striker) & ${team1Players[1].name} (Non-Striker)`);
  console.log(`Opening Bowler: ${team2Players[10].name} (Deepak Tyagi)`);

  const match1Log: any[] = [];

  // Function to set bowler
  function setBowler(match: Match, innIdx: number, bowlerId: string) {
    match.innings[innIdx]!.currentBowlerId = bowlerId;
  }
  function setStriker(match: Match, innIdx: number, strikerId: string) {
    match.innings[innIdx]!.currentStrikerId = strikerId;
  }

  // INNINGS 1: Mumbai Strikers Batting (5 Overs)
  console.log('\n>>> MATCH 1 — INNINGS 1: MUMBAI STRIKERS BATTING <<<');
  const dhBowlersM1 = ['dh_11', 'dh_10', 'dh_09', 'dh_08', 'dh_06']; // Tyagi, Gill, Mishra, Kaushik, Oberoi

  // Over 1 (Deepak Tyagi)
  setBowler(match1, 0, dhBowlersM1[0]);
  let b = await scoreBall(match1, { runsBat: 1, shotArea: 'cover', commentary: 'Pushed into covers for a quick single' }); match1Log.push({ ov: '0.1', ball: b });
  b = await scoreBall(match1, { runsBat: 4, shotArea: 'mid-wicket', commentary: 'CRACKED! Pulled through mid-wicket for FOUR' }); match1Log.push({ ov: '0.2', ball: b });
  b = await scoreBall(match1, { runsBat: 0, shotArea: 'point', commentary: 'Defended cleanly to backward point' }); match1Log.push({ ov: '0.3', ball: b });
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'long-on', commentary: 'Driven down to long-on for a brisk brace' }); match1Log.push({ ov: '0.4', ball: b });
  b = await scoreBall(match1, { runsBat: 0, runsExtra: 1, extraType: 'wide', commentary: 'Slightly down legside, called WIDE' }); match1Log.push({ ov: '0.4 (wd)', ball: b });
  b = await scoreBall(match1, { runsBat: 6, shotArea: 'long-off', commentary: 'LOFTED HIGH AND HANDSOME! Smoked over long-off for SIX!' }); match1Log.push({ ov: '0.5', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'square-leg', commentary: 'Tucked round the corner for one' }); match1Log.push({ ov: '0.6', ball: b });
  console.log(`End of Over 1: Score: ${match1.innings[0].totalRuns}/${match1.innings[0].totalWickets} (${match1.innings[0].overs} ov)`);

  // Over 2 (Jaspreet Gill)
  setBowler(match1, 0, dhBowlersM1[1]);
  b = await scoreBall(match1, { runsBat: 0, isWicket: true, dismissalType: 'bowled', dismissedPlayerId: match1.innings[0].currentStrikerId, commentary: 'CLEAN BOWLED! 140kph yorker shatters the off-stump!' }); match1Log.push({ ov: '1.1 (W)', ball: b });
  // Next Batter in: Aryan Merchant (ms_03)
  setStriker(match1, 0, 'ms_03');
  b = await scoreBall(match1, { runsBat: 0, shotArea: 'cover', commentary: 'Solid forward defensive stroke' }); match1Log.push({ ov: '1.2', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'third-man', commentary: 'Steered down to third man for a single' }); match1Log.push({ ov: '1.3', ball: b });
  b = await scoreBall(match1, { runsBat: 0, shotArea: 'mid-off', commentary: 'Punched firmly to mid-off, no run' }); match1Log.push({ ov: '1.4', ball: b });
  b = await scoreBall(match1, { runsBat: 4, shotArea: 'extra-cover', commentary: 'GLORIOUS COVER DRIVE! Pierces the ring for FOUR' }); match1Log.push({ ov: '1.5', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'fine-leg', commentary: 'Glanced fine to keep the strike' }); match1Log.push({ ov: '1.6', ball: b });
  console.log(`End of Over 2: Score: ${match1.innings[0].totalRuns}/${match1.innings[0].totalWickets} (${match1.innings[0].overs} ov)`);

  // Over 3 (Ankit Mishra - Spin)
  setBowler(match1, 0, dhBowlersM1[2]);
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'deep-mid-wicket', commentary: 'Worked away into the gap for two' }); match1Log.push({ ov: '2.1', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'long-off', commentary: 'Drives down to long-off' }); match1Log.push({ ov: '2.2', ball: b });
  b = await scoreBall(match1, { runsBat: 0, shotArea: 'point', commentary: 'Flatter delivery cut straight to point' }); match1Log.push({ ov: '2.3', ball: b });
  b = await scoreBall(match1, { runsBat: 6, shotArea: 'mid-wicket', commentary: 'INTO THE STANDS! Huge slog-sweep over deep mid-wicket for SIX!' }); match1Log.push({ ov: '2.4', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'cover', commentary: 'Pushed into the offside for a single' }); match1Log.push({ ov: '2.5', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'long-on', commentary: 'Single down to long-on to close the over' }); match1Log.push({ ov: '2.6', ball: b });
  console.log(`End of Over 3: Score: ${match1.innings[0].totalRuns}/${match1.innings[0].totalWickets} (${match1.innings[0].overs} ov)`);

  // Over 4 (Tarun Kaushik - Legbreak)
  setBowler(match1, 0, dhBowlersM1[3]);
  b = await scoreBall(match1, { runsBat: 4, shotArea: 'fine-leg', commentary: 'SWEPT DELICATELY! Races past short fine leg for FOUR' }); match1Log.push({ ov: '3.1', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'deep-cover', commentary: 'Lofted over cover point for a single' }); match1Log.push({ ov: '3.2', ball: b });
  b = await scoreBall(match1, { runsBat: 0, isWicket: true, dismissalType: 'caught', dismissedPlayerId: match1.innings[0].currentStrikerId, fielderId: 'dh_03', commentary: 'EDGED AND TAKEN! Rishabh Vats snaffles a sharp catch behind the stumps!' }); match1Log.push({ ov: '3.3 (W)', ball: b });
  // Next Batter in: Aditya Rane (ms_04)
  setStriker(match1, 0, 'ms_04');
  b = await scoreBall(match1, { runsBat: 0, shotArea: 'mid-on', commentary: 'Defended back down the track' }); match1Log.push({ ov: '3.4', ball: b });
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'third-man', commentary: 'Late cut runs down to third man for two' }); match1Log.push({ ov: '3.5', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'square-leg', commentary: 'Nudge to square leg retains the strike' }); match1Log.push({ ov: '3.6', ball: b });
  console.log(`End of Over 4: Score: ${match1.innings[0].totalRuns}/${match1.innings[0].totalWickets} (${match1.innings[0].overs} ov)`);

  // Over 5 (Hardik Oberoi - Death Overs)
  setBowler(match1, 0, dhBowlersM1[4]);
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'deep-mid-wicket', commentary: 'Drilled down to deep mid-wicket for two runs' }); match1Log.push({ ov: '4.1', ball: b });
  b = await scoreBall(match1, { runsBat: 4, shotArea: 'straight', commentary: 'BLUDGEONED! Smashes it straight back past the bowler for FOUR' }); match1Log.push({ ov: '4.2', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'cover', commentary: 'Slices away to deep point for one' }); match1Log.push({ ov: '4.3', ball: b });
  b = await scoreBall(match1, { runsBat: 6, shotArea: 'long-on', commentary: 'DISPATCHED! Full toss hammered over long-on for a colossal SIX!' }); match1Log.push({ ov: '4.4', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'mid-wicket', commentary: 'Pushed into the ring for a hasty single' }); match1Log.push({ ov: '4.5', ball: b });
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'deep-cover', commentary: 'Scampers back for the second run off the final ball!' }); match1Log.push({ ov: '4.6', ball: b });
  console.log(`End of Innings 1: Mumbai Strikers finish at ${match1.innings[0].totalRuns}/${match1.innings[0].totalWickets} in 5.0 overs (Run Rate: ${match1.innings[0].runRate.toFixed(2)})`);

  const m1Target = match1.innings[0].totalRuns + 1;
  match1.targetRuns = m1Target;
  match1.currentInningsIndex = 1;
  match1.status = 'live';

  // INNINGS 2: Delhi Hawks Chase (Target: m1Target)
  console.log(`\n>>> MATCH 1 — INNINGS 2: DELHI HAWKS CHASE (TARGET: ${m1Target} in 5 OVERS) <<<`);
  const inn2M1: Innings = {
    id: `inn_${match1.id}_2`,
    inningsNumber: 2,
    battingTeamId: team2.id,
    bowlingTeamId: team1.id,
    totalRuns: 0,
    totalWickets: 0,
    legalBallsBowled: 0,
    overs: '0.0',
    runRate: 0,
    isCompleted: false,
    currentStrikerId: team2Players[0].id, // Shikhar Dhawanji
    currentNonStrikerId: team2Players[1].id, // Yashpal Sehrawat
    currentBowlerId: team1Players[8].id, // Chetan Shinde opens bowling
    deliveries: [],
    batterStats: {},
    bowlerStats: {},
    fallOfWickets: [],
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
  };
  match1.innings.push(inn2M1);

  const msBowlersM1 = ['ms_09', 'ms_10', 'ms_08', 'ms_06', 'ms_11']; // Shinde, Shaikh, Patel, Sawant, Vora

  // Over 1 (Chetan Shinde)
  setBowler(match1, 1, msBowlersM1[0]);
  b = await scoreBall(match1, { runsBat: 4, shotArea: 'cover', commentary: 'CRACKING COVER DRIVE! Starts the chase in style with FOUR' }); match1Log.push({ ov: '0.1 (chase)', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'mid-wicket', commentary: 'Flicked off the pads for a single' }); match1Log.push({ ov: '0.2 (chase)', ball: b });
  b = await scoreBall(match1, { runsBat: 0, isWicket: true, dismissalType: 'lbw', dismissedPlayerId: match1.innings[1].currentStrikerId, commentary: 'APPEAL AND GIVEN! Plumb in front, LBW!' }); match1Log.push({ ov: '0.3 (W)', ball: b });
  // Next in: Rishabh Vats (dh_03)
  setStriker(match1, 1, 'dh_03');
  b = await scoreBall(match1, { runsBat: 0, shotArea: 'point', commentary: 'Beaten by the outswinger outside off' }); match1Log.push({ ov: '0.4 (chase)', ball: b });
  b = await scoreBall(match1, { runsBat: 6, shotArea: 'fine-leg', commentary: 'PICK-UP SHOT! Effortlessly whipped over deep square leg for SIX!' }); match1Log.push({ ov: '0.5 (chase)', ball: b });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'cover', commentary: 'Retains strike with a push to sweeper cover' }); match1Log.push({ ov: '0.6 (chase)', ball: b });
  console.log(`End of Over 1: Delhi Hawks ${match1.innings[1].totalRuns}/${match1.innings[1].totalWickets} (Target: ${m1Target})`);

  // Over 2 (Imran Shaikh - Left arm pace)
  setBowler(match1, 1, msBowlersM1[1]);
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'mid-off', commentary: 'Pushed to mid-off for a brisk single' });
  b = await scoreBall(match1, { runsBat: 4, shotArea: 'third-man', commentary: 'Edged but flies wide of slip for FOUR' });
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'deep-point', commentary: 'Cut away hard into the deep for two' });
  b = await scoreBall(match1, { runsBat: 0, shotArea: 'cover', commentary: 'Mistimed drive finds extra cover' });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'mid-wicket', commentary: 'Rotates strike with a push to mid-wicket' });
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'long-on', commentary: 'Punched down the ground for two' });
  console.log(`End of Over 2: Delhi Hawks ${match1.innings[1].totalRuns}/${match1.innings[1].totalWickets}`);

  // Over 3 (Samar Patel - Off spin)
  setBowler(match1, 1, msBowlersM1[2]);
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'long-off', commentary: 'Down to long-off for one' });
  b = await scoreBall(match1, { runsBat: 6, shotArea: 'mid-wicket', commentary: 'MASSIVE! Steps out and launches it over long-on for SIX!' });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'cover', commentary: 'Cover drive brings a single' });
  b = await scoreBall(match1, { runsBat: 0, isWicket: true, dismissalType: 'caught', dismissedPlayerId: match1.innings[1].currentStrikerId, fielderId: 'ms_04', commentary: 'OUT! Thick edge caught by keeper Aditya Rane!' });
  // Next in: Gautam Bakshi (dh_04)
  setStriker(match1, 1, 'dh_04');
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'point', commentary: 'Steered behind point for a single' });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'mid-wicket', commentary: 'Worked into legside' });
  console.log(`End of Over 3: Delhi Hawks ${match1.innings[1].totalRuns}/${match1.innings[1].totalWickets}`);

  // Over 4 (Kabir Sawant)
  setBowler(match1, 1, msBowlersM1[3]);
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'deep-mid-wicket', commentary: 'Good running between wickets for two' });
  b = await scoreBall(match1, { runsBat: 4, shotArea: 'cover', commentary: 'BEAUTIFULLY TIMED! Threaded through extra-cover for FOUR' });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'long-on', commentary: 'Down the pitch for a single' });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'deep-square-leg', commentary: 'Pulled into the deep for one' });
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'third-man', commentary: 'Upper cut lands safely for two' });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'cover', commentary: 'Single keeps the strike for the final over' });
  console.log(`End of Over 4: Delhi Hawks ${match1.innings[1].totalRuns}/${match1.innings[1].totalWickets} (Needs ${m1Target - match1.innings[1].totalRuns} runs to win off 6 balls)`);

  // Over 5 (Mayank Vora - Legbreak - Final Over Thriller)
  setBowler(match1, 1, msBowlersM1[4]);
  b = await scoreBall(match1, { runsBat: 2, shotArea: 'long-on', commentary: 'Driven into the deep for two runs' });
  b = await scoreBall(match1, { runsBat: 4, shotArea: 'mid-wicket', commentary: 'PULLED FEROCIOUSLY! Races away for FOUR!' });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'cover', commentary: 'Pushed into the gap for one' });
  b = await scoreBall(match1, { runsBat: 0, isWicket: true, dismissalType: 'bowled', dismissedPlayerId: match1.innings[1].currentStrikerId, commentary: 'BOWLED HIM! Wrong-un rips through the gate!' });
  // Next in: Kunal Chadha (dh_05)
  setStriker(match1, 1, 'dh_05');
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'third-man', commentary: 'Guarded dab to third man for one run' });
  b = await scoreBall(match1, { runsBat: 1, shotArea: 'mid-wicket', commentary: 'Full ball drilled to long-on; Mumbai Strikers win by 4 runs!' });

  match1.innings[1].isCompleted = true;
  match1.status = 'completed';
  match1.result = CricketEngine.evaluateMatchResult(match1);
  await matchRepo.saveMatch(match1);

  console.log(`\n>>> MATCH 1 RESULT: ${match1.result} <<<`);
  console.log(`Mumbai Strikers: ${match1.innings[0].totalRuns}/${match1.innings[0].totalWickets} (5.0 ov)`);
  console.log(`Delhi Hawks: ${match1.innings[1].totalRuns}/${match1.innings[1].totalWickets} (5.0 ov)`);

  // --- MATCH 2: Delhi Hawks vs Bangalore Titans ---
  console.log('\n======================================================');
  console.log('--- PHASE 4: MATCH 2 — DELHI HAWKS vs BANGALORE TITANS ---');
  console.log('======================================================');

  const match2 = createMatch(
    'match_tri_02',
    'Tri-Series Match 2: DH vs BT',
    team2,
    team3,
    team3.id, // Bangalore Titans win toss
    'bowl'    // Choose to BOWL first
  );
  await matchRepo.saveMatch(match2);

  console.log(`Toss: ${team3.name} won the toss and elected to BOWL first.`);
  console.log(`Delhi Hawks Batting First: ${team2Players[0].name} & ${team2Players[1].name}`);
  console.log(`Bangalore Titans Opening Bowler: ${team3Players[9].name} (Mohammed Sirajkar)`);

  // INNINGS 1: Delhi Hawks Batting (5 Overs)
  console.log('\n>>> MATCH 2 — INNINGS 1: DELHI HAWKS BATTING <<<');
  const btBowlersM2 = ['bt_10', 'bt_09', 'bt_08', 'bt_11', 'bt_03']; // Sirajkar, Pateliah, Hasarangaiah, Vyshak, DSouza

  // Over 1 (Mohammed Sirajkar)
  setBowler(match2, 0, btBowlersM2[0]);
  b = await scoreBall(match2, { runsBat: 0, shotArea: 'cover', commentary: 'Full outswinger beaten outside off' });
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'cover', commentary: 'STAND AND DELIVER! Dispatched through extra-cover for FOUR' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'mid-wicket', commentary: 'Tucked into legside for a single' });
  b = await scoreBall(match2, { runsBat: 0, shotArea: 'point', commentary: 'Defended to point' });
  b = await scoreBall(match2, { runsBat: 6, shotArea: 'fine-leg', commentary: 'PULLED OVER FINE LEG FOR SIX!' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'mid-off', commentary: 'Single down the pitch' });
  console.log(`End of Over 1: Score: ${match2.innings[0].totalRuns}/${match2.innings[0].totalWickets}`);

  // Over 2 (Harshal Pateliah - Dippers and cutters)
  setBowler(match2, 0, btBowlersM2[1]);
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'third-man', commentary: 'Steered to third man' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'deep-mid-wicket', commentary: 'Worked away for a couple' });
  b = await scoreBall(match2, { runsBat: 0, isWicket: true, dismissalType: 'caught', dismissedPlayerId: match2.innings[0].currentStrikerId, fielderId: 'bt_04', commentary: 'OUT! Slower ball deceives batter, caught behind!' });
  // Next in: Rishabh Vats (dh_03)
  setStriker(match2, 0, 'dh_03');
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'mid-wicket', commentary: 'Slog swept for FOUR' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'cover', commentary: 'Single to deep cover' });
  b = await scoreBall(match2, { runsBat: 0, shotArea: 'mid-on', commentary: 'Good slower ball finishes the over' });
  console.log(`End of Over 2: Score: ${match2.innings[0].totalRuns}/${match2.innings[0].totalWickets}`);

  // Over 3 (Wanindu Hasarangaiah - Leg spin)
  setBowler(match2, 0, btBowlersM2[2]);
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'long-on', commentary: 'Down to long-on' });
  b = await scoreBall(match2, { runsBat: 6, shotArea: 'straight', commentary: 'SMASHED OVER LONG-OFF FOR SIX!' });
  b = await scoreBall(match2, { runsBat: 0, isWicket: true, dismissalType: 'bowled', dismissedPlayerId: match2.innings[0].currentStrikerId, commentary: 'GOOGLY! Cleans him up through the gate!' });
  // Next in: Gautam Bakshi (dh_04)
  setStriker(match2, 0, 'dh_04');
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'point', commentary: 'Single to point' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'cover', commentary: 'Pushed into covers' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'deep-square-leg', commentary: 'Two runs to deep square' });
  console.log(`End of Over 3: Score: ${match2.innings[0].totalRuns}/${match2.innings[0].totalWickets}`);

  // Over 4 (Vijaykumar Vyshak)
  setBowler(match2, 0, btBowlersM2[3]);
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'third-man', commentary: 'Ramp shot flies over keeper for FOUR' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'mid-wicket', commentary: 'Single to mid-wicket' });
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'cover', commentary: 'Pierces the cover boundary for FOUR' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'long-off', commentary: 'Down to long-off' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'deep-point', commentary: 'Two runs to backward point' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'mid-on', commentary: 'Single to mid-on' });
  console.log(`End of Over 4: Score: ${match2.innings[0].totalRuns}/${match2.innings[0].totalWickets}`);

  // Over 5 (Glenn DSouza - Death overs)
  setBowler(match2, 0, btBowlersM2[4]);
  b = await scoreBall(match2, { runsBat: 6, shotArea: 'mid-wicket', commentary: 'MASSIVE SIX OVER COVERS!' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'cover', commentary: 'Single into the deep' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'long-on', commentary: 'Driven down the ground for two' });
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'fine-leg', commentary: 'Scooped past fine leg for FOUR' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'point', commentary: 'Single to point' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'deep-mid-wicket', commentary: 'Two runs to close the innings!' });
  console.log(`End of Innings 1: Delhi Hawks finish at ${match2.innings[0].totalRuns}/${match2.innings[0].totalWickets} in 5.0 ov`);

  const m2Target = match2.innings[0].totalRuns + 1;
  match2.targetRuns = m2Target;
  match2.currentInningsIndex = 1;
  match2.status = 'live';

  // INNINGS 2: Bangalore Titans Chase (Target: m2Target)
  console.log(`\n>>> MATCH 2 — INNINGS 2: BANGALORE TITANS CHASE (TARGET: ${m2Target} in 5 OVERS) <<<`);
  const inn2M2: Innings = {
    id: `inn_${match2.id}_2`,
    inningsNumber: 2,
    battingTeamId: team3.id,
    bowlingTeamId: team2.id,
    totalRuns: 0,
    totalWickets: 0,
    legalBallsBowled: 0,
    overs: '0.0',
    runRate: 0,
    isCompleted: false,
    currentStrikerId: team3Players[0].id, // Virat Kohliya
    currentNonStrikerId: team3Players[1].id, // Faf Devadiga
    currentBowlerId: team2Players[10].id, // Deepak Tyagi
    deliveries: [],
    batterStats: {},
    bowlerStats: {},
    fallOfWickets: [],
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
  };
  match2.innings.push(inn2M2);

  const dhBowlersM2 = ['dh_11', 'dh_10', 'dh_09', 'dh_08', 'dh_06'];

  // Over 1 (Deepak Tyagi)
  setBowler(match2, 1, dhBowlersM2[0]);
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'cover', commentary: 'VINTAGE COVER DRIVE FROM KOHLIYA! FOUR!' });
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'mid-wicket', commentary: 'WHIPPED OFF THE WRISTS! FOUR!' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'mid-off', commentary: 'Single to mid-off' });
  b = await scoreBall(match2, { runsBat: 6, shotArea: 'long-on', commentary: 'FAF DEVADIGA GOES BIG! SIX OVER LONG-ON!' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'cover', commentary: 'Push to cover for one' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'third-man', commentary: 'Steered behind square for two' });
  console.log(`End of Over 1: Bangalore Titans ${match2.innings[1].totalRuns}/${match2.innings[1].totalWickets}`);

  // Over 2 (Jaspreet Gill)
  setBowler(match2, 1, dhBowlersM2[1]);
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'point', commentary: 'Single to point' });
  b = await scoreBall(match2, { runsBat: 0, isWicket: true, dismissalType: 'bowled', dismissedPlayerId: match2.innings[1].currentStrikerId, commentary: 'CASTLED! Gill fires in a 145kph missile!' });
  // Next in: Glenn DSouza (bt_03)
  setStriker(match2, 1, 'bt_03');
  b = await scoreBall(match2, { runsBat: 6, shotArea: 'mid-wicket', commentary: 'FIRST BALL SIX! Glenn DSouza pulls it into orbit!' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'cover', commentary: 'Single to cover' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'long-on', commentary: 'Punched down to long-on for two' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'mid-wicket', commentary: 'Single retains the strike' });
  console.log(`End of Over 2: Bangalore Titans ${match2.innings[1].totalRuns}/${match2.innings[1].totalWickets}`);

  // Over 3 (Ankit Mishra - Spin)
  setBowler(match2, 1, dhBowlersM2[2]);
  b = await scoreBall(match2, { runsBat: 6, shotArea: 'straight', commentary: 'LOFTED STRAIGHT OVER THE SIGHTSCREEN FOR SIX!' });
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'cover', commentary: 'REVERSE SWEEP CRACKED FOR FOUR!' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'long-off', commentary: 'Down to long-off for one' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'deep-mid-wicket', commentary: 'Driven into the deep for two' });
  b = await scoreBall(match2, { runsBat: 1, shotArea: 'cover', commentary: 'Single to sweeper cover' });
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'fine-leg', commentary: 'PADDLE SWEPT FOR FOUR!' });
  console.log(`End of Over 3: Bangalore Titans ${match2.innings[1].totalRuns}/${match2.innings[1].totalWickets}`);

  // Over 4 (Tarun Kaushik - Spin)
  setBowler(match2, 1, dhBowlersM2[3]);
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'deep-cover', commentary: 'Pushed into the gap for two runs' });
  b = await scoreBall(match2, { runsBat: 6, shotArea: 'long-on', commentary: 'BANG! Dispatched for SIX over long-on!' });
  b = await scoreBall(match2, { runsBat: 2, shotArea: 'mid-wicket', commentary: 'Whipped away for a brace!' });
  b = await scoreBall(match2, { runsBat: 4, shotArea: 'cover', commentary: 'CRACKING COVER DRIVE FOR FOUR! Target achieved! Bangalore Titans win by 9 wickets!' });

  match2.status = 'completed';
  match2.result = CricketEngine.evaluateMatchResult(match2);
  await matchRepo.saveMatch(match2);

  console.log(`\n>>> MATCH 2 RESULT: ${match2.result} <<<`);
  console.log(`Delhi Hawks: ${match2.innings[0].totalRuns}/${match2.innings[0].totalWickets} (5.0 ov)`);
  console.log(`Bangalore Titans: ${match2.innings[1].totalRuns}/${match2.innings[1].totalWickets} (3.3 ov)`);

  // --- PHASE 5: TOURNAMENT STANDINGS & NET RUN RATE (NRR) ---
  console.log('\n======================================================');
  console.log('--- PHASE 5: TOURNAMENT POINTS TABLE & NET RUN RATE ---');
  console.log('======================================================');

  const tournamentTeams = [team1, team2, team3];
  const tournamentMatches = [match1, match2];
  const standings = TournamentEngine.calculateStandings(tournamentTeams, tournamentMatches);

  console.table(
    standings.map((s, idx) => ({
      Rank: idx + 1,
      Team: s.teamName,
      Played: s.played,
      Won: s.won,
      Lost: s.lost,
      Tied: s.tied,
      Points: s.points,
      NRR: s.nrr > 0 ? `+${s.nrr.toFixed(3)}` : s.nrr.toFixed(3),
      'Runs Scored/Ov': `${s.runsScored}/${s.oversFacedDecimal.toFixed(1)}`,
      'Runs Conceded/Ov': `${s.runsConceded}/${s.oversBowledDecimal.toFixed(1)}`,
    }))
  );

  // --- PHASE 6: TOURNAMENT LEADERBOARDS & FANTASY MVP CALCULATION ---
  console.log('\n======================================================');
  console.log('--- PHASE 6: TOURNAMENT LEADERBOARDS & MVP RANKINGS ---');
  console.log('======================================================');

  interface PlayerTournRecord {
    player: Player;
    team: Team;
    runs: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    strikeRate: number;
    wickets: number;
    oversBowled: number;
    runsConceded: number;
    maidens: number;
    economy: number;
    catches: number;
    stumpings: number;
    runOuts: number;
    mvpPoints: number;
  }

  const pRecordMap = new Map<string, PlayerTournRecord>();

  // Seed all 33 players
  for (const t of tournamentTeams) {
    for (const p of t.players) {
      pRecordMap.set(p.id, {
        player: p,
        team: t,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        wickets: 0,
        oversBowled: 0,
        runsConceded: 0,
        maidens: 0,
        economy: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
        mvpPoints: 0,
      });
    }
  }

  // Aggregate stats across match scorecards
  for (const m of tournamentMatches) {
    for (const inn of m.innings) {
      if (!inn) continue;
      // Batting
      for (const b of Object.values(inn.batterStats)) {
        const rec = pRecordMap.get(b.playerId);
        if (rec) {
          rec.runs += b.runs;
          rec.ballsFaced += b.ballsFaced;
          rec.fours += b.fours;
          rec.sixes += b.sixes;
        }
      }
      // Bowling
      for (const bw of Object.values(inn.bowlerStats)) {
        const rec = pRecordMap.get(bw.playerId);
        if (rec) {
          rec.wickets += bw.wickets;
          rec.oversBowled += bw.legalBalls / 6;
          rec.runsConceded += bw.runsConceded;
          rec.maidens += bw.maidens;
        }
      }
      // Fielding
      for (const del of inn.deliveries) {
        if (del.isWicket && del.wicketDetails?.fielderId) {
          const rec = pRecordMap.get(del.wicketDetails.fielderId);
          if (rec) {
            if (del.wicketDetails.dismissalType === 'caught') rec.catches += 1;
            if (del.wicketDetails.dismissalType === 'stumped') rec.stumpings += 1;
            if (del.wicketDetails.dismissalType === 'run_out') rec.runOuts += 1;
          }
        }
      }
    }
  }

  // Calculate Strike Rates, Economies, and MVP points
  // MVP Formula: Runs (1pt) + 4s (1pt bonus) + 6s (2pt bonus) + Wickets (25pt) + Maidens (8pt) + Catches (8pt) + Stumpings (12pt) + RunOuts (8pt)
  for (const rec of pRecordMap.values()) {
    if (rec.ballsFaced > 0) {
      rec.strikeRate = Number(((rec.runs / rec.ballsFaced) * 100).toFixed(1));
    }
    if (rec.oversBowled > 0) {
      rec.economy = Number((rec.runsConceded / rec.oversBowled).toFixed(2));
    }
    rec.mvpPoints =
      rec.runs * 1 +
      rec.fours * 1 +
      rec.sixes * 2 +
      rec.wickets * 25 +
      rec.maidens * 8 +
      rec.catches * 8 +
      rec.stumpings * 12 +
      rec.runOuts * 8;
  }

  const allRecords = Array.from(pRecordMap.values());
  const topMVPList = [...allRecords].sort((a, b) => b.mvpPoints - a.mvpPoints).slice(0, 10);
  const topBattersList = [...allRecords].filter((p) => p.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 5);
  const topBowlersList = [...allRecords].filter((p) => p.wickets > 0 || p.oversBowled > 0).sort((a, b) => b.wickets !== a.wickets ? b.wickets - a.wickets : a.economy - b.economy).slice(0, 5);

  console.log('\n--- TOP 10 TOURNAMENT FANTASY MVP LEADERBOARD ---');
  console.table(
    topMVPList.map((m, idx) => ({
      Rank: idx + 1,
      Player: m.player.name,
      Team: m.team.shortName,
      Role: m.player.role,
      Runs: m.runs,
      Wickets: m.wickets,
      Catches: m.catches,
      'MVP Pts': m.mvpPoints,
    }))
  );

  console.log('\n--- ORANGE CAP (TOP 5 RUN SCORERS) ---');
  console.table(
    topBattersList.map((b, idx) => ({
      Rank: idx + 1,
      Batter: b.player.name,
      Team: b.team.shortName,
      Runs: b.runs,
      Balls: b.ballsFaced,
      '4s': b.fours,
      '6s': b.sixes,
      SR: b.strikeRate,
    }))
  );

  console.log('\n--- PURPLE CAP (TOP 5 WICKET TAKERS) ---');
  console.table(
    topBowlersList.map((bw, idx) => ({
      Rank: idx + 1,
      Bowler: bw.player.name,
      Team: bw.team.shortName,
      Wickets: bw.wickets,
      Overs: bw.oversBowled.toFixed(1),
      Runs: bw.runsConceded,
      Econ: bw.economy,
    }))
  );

  // Return full data for structured report generation
  const simulationResults = {
    teams: [team1, team2, team3],
    totalPlayers: 33,
    tournament,
    matches: [match1, match2],
    standings,
    topMVPList,
    topBattersList,
    topBowlersList,
    allRecords,
  };

  const outputFilePath = path.resolve('./scratch/tri_series_results.json');
  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  fs.writeFileSync(outputFilePath, JSON.stringify(simulationResults, null, 2), 'utf8');
  console.log(`\nSimulation complete! Results stored at: ${outputFilePath}`);

  return simulationResults;
}

// Execute if run directly
runTriSeriesSimulation().catch((err) => {
  console.error('Simulation execution failed:', err);
  process.exit(1);
});
