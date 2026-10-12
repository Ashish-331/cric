export type PlayingRole = 'batter' | 'bowler' | 'all-rounder' | 'wicketkeeper';
export type BattingHand = 'right' | 'left';
export type BowlingStyle =
  | 'fast'
  | 'fast-medium'
  | 'medium'
  | 'spin-off'
  | 'spin-leg'
  | 'orthodox'
  | 'spin-left-arm';
export type BowlingSide = 'over' | 'round';
export type MatchFormat = 't20' | 't10' | 'odi' | 'custom';
export type MatchStatus =
  | 'setup'
  | 'scheduled'
  | 'live'
  | 'innings_break'
  | 'delayed'
  | 'completed'
  | 'abandoned'
  | 'tied';
export type TossDecision = 'bat' | 'bowl';
export type BallType = 'leather' | 'tennis' | 'tape';
export type ExtraType = 'none' | 'wide' | 'noBall' | 'bye' | 'legBye' | 'penalty';
export type DismissalType =
  | 'bowled'
  | 'caught'
  | 'caught_and_bowled'
  | 'lbw'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'
  | 'retired_hurt'
  | 'retired_out'
  | 'timed_out'
  | 'obstructing_field'
  | 'hit_twice';

export type ShotSector =
  | 'Third Man'
  | 'Point'
  | 'Cover'
  | 'Mid-Off'
  | 'Long-Off'
  | 'Long-On'
  | 'Mid-Wicket'
  | 'Square Leg'
  | 'Fine Leg'
  | 'Behind Keeper';

export type PitchLength = 'short' | 'good_length' | 'full' | 'yorker';
export type PitchLine = 'outside_off' | 'on_stumps' | 'down_leg';
export interface PitchCoordinate {
  x: number;
  y: number;
}

export type AvatarPreset =
  | 'helmet'
  | 'cap'
  | 'red-ball'
  | 'white-ball'
  | 'stumps'
  | 'gloves';

export interface CareerStats {
  matches: number;
  inningsBatted: number;
  runs: number;
  highestScore: number;
  highestScoreNotOut?: boolean;
  average: number;
  strikeRate: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  wickets: number;
  oversBowled: number;
  maidens: number;
  runsConceded: number;
  bowlingAverage: number;
  bowlingEconomy: number;
  bestBowling: string;
  bestBowlingWickets?: number;
  bestBowlingRuns?: number;
  catches: number;
  stumpings: number;
  runOuts: number;
}

export interface Player {
  id: string;
  name: string;
  role: PlayingRole;
  battingHand: BattingHand;
  bowlingStyle?: BowlingStyle;
  teamId?: string;
  phoneNumber?: string;
  isVerified?: boolean;
  isGuest?: boolean;
  isClaimed?: boolean;
  claimedByUserId?: string;
  isCaptain?: boolean;
  isWicketkeeper?: boolean;
  avatarUrl?: string;
  avatarPreset?: AvatarPreset;
  jerseyNumber?: number;
  city?: string;
  clubName?: string;
  careerStats?: CareerStats;
  baselineStats?: CareerStats;
  baselineRecentScores?: number[];
  recentScores?: number[];
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  logoUrl?: string;
  captainPlayerId?: string;
  createdByUserId?: string;
  players: Player[];
}

export interface JoinRequest {
  id: string;
  teamId: string;
  playerId: string;
  playerName: string;
  playerRole: PlayingRole;
  playerPhone?: string;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: number;
}

export interface DeliveryExtrasDetail {
  noBall?: number;
  wide?: number;
  bye?: number;
  legBye?: number;
  penalty?: number;
}

export interface WicketDetails {
  dismissalType: DismissalType;
  playerDismissedId: string;
  bowlerId?: string;
  fielderId?: string;
  commentary?: string;
}

export interface Delivery {
  id: string;
  ballNumberInMatch: number;
  overIndex: number; // 0-based over count (e.g. 0 for 1st over)
  ballInOver: number; // 1 to 6 (for legal balls)
  isLegalDelivery: boolean;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runsBat: number;
  runsExtra: number;
  extraType: ExtraType;
  extrasDetail?: DeliveryExtrasDetail;
  physicalRunsRan?: number; // Exact runs physically run between wickets
  isBoundary: boolean;
  isSix: boolean;
  isWicket: boolean;
  wicketDetails?: WicketDetails;
  commentary: string;
  timestamp: number;
  bowlingSide?: BowlingSide;
  shotArea?: ShotSector;
  isFreeHit?: boolean;
  pitchLength?: PitchLength;
  pitchLine?: PitchLine;
  pitchCoord?: PitchCoordinate;
  pitchProvenance?: PitchProvenance;
}

export type PitchProvenance = 'observed' | 'estimated' | 'unknown';

export type InningsAction =
  | { type: 'DELIVERY'; delivery: Delivery }
  | { type: 'RETIRE_BATTER'; playerId: string; dismissalType: 'retired_hurt' | 'retired_out'; timestamp: number }
  | { type: 'RETURN_BATTER'; playerId: string; slot: 'striker' | 'nonStriker'; timestamp: number }
  | { type: 'SELECT_BOWLER'; bowlerId: string; timestamp: number }
  | { type: 'SELECT_BATTER'; slot: 'striker' | 'nonStriker'; playerId: string; timestamp: number }
  | { type: 'SWAP_ENDS'; timestamp: number }
  | { type: 'UNDO'; timestamp: number }
  | {
      type: 'END_INNINGS';
      timestamp: number;
      strikerId?: string;
      nonStrikerId?: string;
      bowlerId?: string;
    };

export interface BatterStats {
  playerId: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalText?: string;
  bowlerId?: string;
  fielderId?: string;
  battingOrder: number;
}

export interface BowlerStats {
  playerId: string;
  legalBalls: number;
  oversFormatted: string; // e.g. "3.4"
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
  dots: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  score: number;
  oversFormatted: string;
  playerDismissedId: string;
}

export interface InningsExtras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalties: number;
  total: number;
}

export interface Innings {
  inningsNumber: number; // 1 or 2
  battingTeamId: string;
  bowlingTeamId: string;
  totalRuns: number;
  totalWickets: number;
  legalBallsBowled: number;
  oversFormatted: string; // e.g. "4.2"
  extras: InningsExtras;
  deliveries: Delivery[];
  actions?: InningsAction[];
  batterStats: Record<string, BatterStats>;
  bowlerStats: Record<string, BowlerStats>;
  fallOfWickets: FallOfWicket[];
  // Initial line-up origin (immutable replay origin)
  initialStrikerId?: string;
  initialNonStrikerId?: string;
  initialBowlerId?: string;
  // Current active crease positions
  currentStrikerId?: string;
  currentNonStrikerId?: string;
  currentBowlerId?: string;
  bowlerSide?: BowlingSide;
  isFreeHit?: boolean; // True when next ball must be bowled under Free Hit conditions
  isCompleted: boolean;
  completedReason?: string;
}

export interface MatchRules {
  totalOvers: number;
  maxOversPerBowler?: number;
  playersPerTeam: number;
  wideValue: number;
  noBallValue: number;
  freeHitOnNoBall: boolean;
}

export interface Match {
  id: string;
  title: string;
  format: MatchFormat;
  venue: string;
  date: string;
  status: MatchStatus;
  team1: Team;
  team2: Team;
  playingXITeam1: string[]; // Player IDs
  playingXITeam2: string[]; // Player IDs
  tossWinnerId: string;
  tossDecision: TossDecision;
  rules: MatchRules;
  innings: [Innings, Innings?];
  currentInningsIndex: number; // 0 or 1
  targetRuns?: number;
  result?: string;
  isSynced: boolean;
  lastUpdated: number;
  notes?: string;
  ballType?: BallType;
  scorerName?: string;
  scorerPlayerId?: string;
  organizerName?: string;
  organizerUserId?: string;
  delayNotes?: string;
  tournamentId?: string;
  revision?: number;
  authorityEpoch?: number;
  approvalStatus?: MatchApprovalStatus;
  resultDetails?: MatchResultDetails;
}

export interface ScoringCommandResult {
  accepted: boolean;
  rejectionReason?: string;
  innings: Innings;
  isWicket: boolean;
  wicketValid: boolean;
  dismissedPlayerId?: string;
  vacantSlot: 'striker' | 'nonStriker' | null;
  needsNewBowler: boolean;
  isOverComplete: boolean;
  isInningsComplete: boolean;
  isMatchComplete?: boolean;
  milestone?: string;
  warning?: string;
}

export type TournamentStatus =
  | 'draft'
  | 'registration_open'
  | 'registration_closed'
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'archived';

export type TournamentEntryStatus =
  | 'draft'
  | 'submitted'
  | 'changes_requested'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'waitlisted'
  | 'withdrawn'
  | 'disqualified';

export interface TournamentSquadMember {
  playerId: string;
  playerName: string;
  role: PlayingRole;
  battingHand: BattingHand;
  isCaptain?: boolean;
  isWicketkeeper?: boolean;
  jerseyNumber?: number;
  phoneNumber?: string;
  status: 'eligible' | 'replacement' | 'suspended' | 'withdrawn';
  addedAt: number;
  replacementReason?: string;
}

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  teamId: string;
  teamName: string;
  shortName: string;
  primaryColor: string;
  captainUserId?: string;
  captainName?: string;
  captainPhone?: string;
  status: TournamentEntryStatus;
  rejectionReason?: string;
  changesRequestedReason?: string;
  submittedAt: number;
  reviewedAt?: number;
  squad: TournamentSquadMember[];
}

export interface MatchLineup {
  matchId: string;
  teamId: string;
  playingPlayerIds: string[];
  captainPlayerId?: string;
  wicketkeeperPlayerId?: string;
  submittedAt?: number;
  isLocked: boolean;
}

export type MatchApprovalStatus = 'provisional' | 'submitted' | 'approved' | 'disputed' | 'reopened';

export interface MatchResultDetails {
  winnerTeamId?: string;
  winnerTeamName?: string;
  winMarginRuns?: number;
  winMarginWickets?: number;
  outcomeType: 'win' | 'tie' | 'draw' | 'no_result' | 'abandoned' | 'super_over';
  summary: string;
  approvalStatus: MatchApprovalStatus;
  disputeReason?: string;
  reviewedByUserId?: string;
  revisedTargetMethod?: string;
}

export interface Tournament {
  id: string;
  name: string;
  format: MatchFormat;
  totalOvers: number;
  ballType: BallType;
  creatorUserId: string;
  creatorName: string;
  teams: Team[];
  matches: Match[];
  status: TournamentStatus | 'upcoming' | 'active' | 'completed';
  createdAt: number;
  location?: string;
  dates?: string;
  registrationDeadline?: string;
  squadLockDeadline?: string;
  isSquadLocked?: boolean;
  maxTeams?: number;
  minSquadSize?: number;
  maxSquadSize?: number;
  pointsForWin?: number;
  pointsForTie?: number;
  pointsForNoResult?: number;
  isPublic?: boolean;
  registrationCode?: string;
  rulesText?: string;
}
