import type {
  Delivery,
  DismissalType,
  ExtraType,
  Innings,
  Match,
  MatchRules,
  BatterStats,
  BowlerStats,
  FallOfWicket,
  InningsExtras,
  BowlingSide,
  ShotSector,
  PitchLength,
  PitchLine,
  PitchCoordinate,
} from '../types/cricket';

export interface BallInput {
  runsBat: number;
  extraType: ExtraType;
  runsExtra: number;
  isBoundary: boolean;
  isSix: boolean;
  isWicket: boolean;
  dismissalType?: DismissalType;
  dismissedPlayerId?: string;
  fielderId?: string;
  commentary?: string;
  bowlingSide?: BowlingSide;
  shotArea?: ShotSector;
  pitchLength?: PitchLength;
  pitchLine?: PitchLine;
  pitchCoord?: PitchCoordinate;
}

export interface CommentaryContext {
  strikerName?: string;
  bowlerName?: string;
  fielderName?: string;
  bowlerStats?: BowlerStats;
  strikerStats?: BatterStats;
  previousStrikerRuns?: number;
  currentPartnershipRuns?: number;
  previousPartnershipRuns?: number;
  partnershipBalls?: number;
  ballsSinceLastBoundary?: number;
  isMaidenOverJustCompleted?: boolean;
  targetRuns?: number;
  inningsTotalRuns?: number;
}

/**
 * Automatically derives cricket pitch length and line coordinates from the shot area and runs scored.
 * Useful for 1-touch Auto Mode in grassroots scoring.
 */
export function derivePitchMapping(
  shotArea?: ShotSector,
  runsBat: number = 0,
  isBoundary: boolean = false,
  isSix: boolean = false
): {
  pitchLength: PitchLength;
  pitchLine: PitchLine;
  pitchCoord: PitchCoordinate;
} {
  switch (shotArea) {
    case 'Point':
    case 'Third Man':
      // Cut / upper cut / edge: short or good length, outside off
      return {
        pitchLength: 'short',
        pitchLine: 'outside_off',
        pitchCoord: { x: 30, y: 35 },
      };

    case 'Cover':
      // Cover drive / lofted cover drive: full length, outside off
      return {
        pitchLength: 'full',
        pitchLine: 'outside_off',
        pitchCoord: { x: 35, y: 76 },
      };

    case 'Mid-Off':
      // Off drive: full / good length, outside off
      return {
        pitchLength: 'full',
        pitchLine: 'outside_off',
        pitchCoord: { x: 42, y: 78 },
      };

    case 'Long-Off':
      // Lofted straight drive over mid-off: full / slot ball outside off
      return {
        pitchLength: 'full',
        pitchLine: 'outside_off',
        pitchCoord: { x: 40, y: 82 },
      };

    case 'Long-On':
      // Lofted drive down the ground: full / slot ball on middle-off
      return {
        pitchLength: 'full',
        pitchLine: 'on_stumps',
        pitchCoord: { x: 50, y: 80 },
      };

    case 'Mid-Wicket':
      // Pull / flick / slog: short or good length on middle/leg
      return {
        pitchLength: runsBat >= 4 ? 'short' : 'good_length',
        pitchLine: 'on_stumps',
        pitchCoord: { x: 50, y: runsBat >= 4 ? 38 : 58 },
      };

    case 'Square Leg':
      // Pull / hook / glancing off hip: short or back of a length on leg
      return {
        pitchLength: 'short',
        pitchLine: 'down_leg',
        pitchCoord: { x: 65, y: 34 },
      };

    case 'Fine Leg':
      // Glance / sweep / hook behind square: full on pads or short down leg
      return {
        pitchLength: runsBat >= 4 ? 'full' : 'good_length',
        pitchLine: 'down_leg',
        pitchCoord: { x: 68, y: runsBat >= 4 ? 80 : 60 },
      };

    case 'Behind Keeper':
      // Scoop / ramp: yorker or very full on stumps
      return {
        pitchLength: 'yorker',
        pitchLine: 'on_stumps',
        pitchCoord: { x: 50, y: 92 },
      };

    default:
      if (isSix) {
        return {
          pitchLength: 'full',
          pitchLine: 'on_stumps',
          pitchCoord: { x: 50, y: 80 },
        };
      }
      if (isBoundary) {
        return {
          pitchLength: 'full',
          pitchLine: 'outside_off',
          pitchCoord: { x: 38, y: 75 },
        };
      }
      return {
        pitchLength: 'good_length',
        pitchLine: 'on_stumps',
        pitchCoord: { x: 50, y: 60 },
      };
  }
}

export const formatOvers = (legalBalls: number): string => {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
};

export const calculateRunRate = (runs: number, legalBalls: number): number => {
  if (legalBalls === 0) return 0;
  const overs = legalBalls / 6;
  return Number((runs / overs).toFixed(2));
};

export const calculateRequiredRunRate = (
  runsNeeded: number,
  ballsRemaining: number
): number | null => {
  if (ballsRemaining <= 0) return runsNeeded <= 0 ? 0 : 99.99;
  if (runsNeeded <= 0) return 0;
  const oversRemaining = ballsRemaining / 6;
  return Number((runsNeeded / oversRemaining).toFixed(2));
};

export const createInitialInnings = (
  inningsNumber: number,
  battingTeamId: string,
  bowlingTeamId: string,
  strikerId?: string,
  nonStrikerId?: string,
  bowlerId?: string
): Innings => {
  const batterStats: Record<string, BatterStats> = {};
  if (strikerId) {
    batterStats[strikerId] = {
      playerId: strikerId,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      isOut: false,
      battingOrder: 1,
    };
  }
  if (nonStrikerId) {
    batterStats[nonStrikerId] = {
      playerId: nonStrikerId,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      isOut: false,
      battingOrder: 2,
    };
  }

  const bowlerStats: Record<string, BowlerStats> = {};
  if (bowlerId) {
    bowlerStats[bowlerId] = {
      playerId: bowlerId,
      legalBalls: 0,
      oversFormatted: '0.0',
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      economy: 0,
      wides: 0,
      noBalls: 0,
      dots: 0,
    };
  }

  return {
    inningsNumber,
    battingTeamId,
    bowlingTeamId,
    totalRuns: 0,
    totalWickets: 0,
    legalBallsBowled: 0,
    oversFormatted: '0.0',
    extras: {
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
      penalties: 0,
      total: 0,
    },
    deliveries: [],
    batterStats,
    bowlerStats,
    fallOfWickets: [],
    currentStrikerId: strikerId,
    currentNonStrikerId: nonStrikerId,
    currentBowlerId: bowlerId,
    bowlerSide: 'over',
    isFreeHit: false,
    isCompleted: false,
  };
};

export class CricketEngine {
  /**
   * Replays an entire sequence of deliveries to produce an immutable, pristine Innings state.
   * This guarantees 100% mathematical integrity for edits and undos.
   */
  static replayInnings(
    initialInnings: Innings,
    deliveries: Delivery[],
    rules: MatchRules,
    targetRuns?: number
  ): Innings {
    const fresh: Innings = {
      ...initialInnings,
      totalRuns: 0,
      totalWickets: 0,
      legalBallsBowled: 0,
      oversFormatted: '0.0',
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
      deliveries: [],
      batterStats: {},
      bowlerStats: {},
      fallOfWickets: [],
      isFreeHit: false,
      bowlerSide: initialInnings.bowlerSide || 'over',
      isCompleted: false,
      completedReason: undefined,
    };

    // Replay deliveries one-by-one
    let currentInnings = fresh;
    for (const d of deliveries) {
      currentInnings = CricketEngine.applyDelivery(currentInnings, d, rules, targetRuns);
    }

    // If replayed down to 0 deliveries, preserve opening batter & bowler slots at 0-stat baseline
    if (deliveries.length === 0) {
      if (currentInnings.currentStrikerId) {
        currentInnings.batterStats[currentInnings.currentStrikerId] = {
          playerId: currentInnings.currentStrikerId,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          isOut: false,
          battingOrder: 1,
        };
      }
      if (currentInnings.currentNonStrikerId) {
        currentInnings.batterStats[currentInnings.currentNonStrikerId] = {
          playerId: currentInnings.currentNonStrikerId,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          isOut: false,
          battingOrder: 2,
        };
      }
      if (currentInnings.currentBowlerId) {
        currentInnings.bowlerStats[currentInnings.currentBowlerId] = {
          playerId: currentInnings.currentBowlerId,
          legalBalls: 0,
          oversFormatted: '0.0',
          maidens: 0,
          runsConceded: 0,
          wickets: 0,
          economy: 0,
          wides: 0,
          noBalls: 0,
          dots: 0,
        };
      }
    }

    return currentInnings;
  }

  /**
   * Processes a single delivery and returns the updated Innings state.
   */
  static applyDelivery(
    innings: Innings,
    delivery: Delivery,
    rules: MatchRules,
    targetRuns?: number,
    commentaryContext?: CommentaryContext
  ): Innings {
    const updated = JSON.parse(JSON.stringify(innings)) as Innings;

    // Preserve / update bowling side
    const bowlingSide: BowlingSide = delivery.bowlingSide || updated.bowlerSide || 'over';
    delivery.bowlingSide = bowlingSide;
    updated.bowlerSide = bowlingSide;

    // Free Hit state checking
    const wasFreeHit = Boolean(innings.isFreeHit);
    delivery.isFreeHit = wasFreeHit;

    let {
      runsBat,
      runsExtra,
      extraType,
      isLegalDelivery,
      isBoundary,
      isSix,
      isWicket,
      wicketDetails,
      strikerId,
      nonStrikerId,
      bowlerId,
      shotArea,
    } = delivery;

    // MCC Law 21.19 / Free Hit rule: On a Free Hit, batsman cannot be dismissed
    // bowled, caught, caught_and_bowled, lbw, stumped, or hit_wicket. Only run_out,
    // retired_hurt, retired_out, obstructing_field are permitted!
    if (wasFreeHit && isWicket && wicketDetails) {
      const allowedOnFreeHit: DismissalType[] = [
        'run_out',
        'retired_hurt',
        'retired_out',
        'obstructing_field',
        'hit_twice',
      ];
      if (!allowedOnFreeHit.includes(wicketDetails.dismissalType)) {
        // Negate the wicket on Free Hit
        isWicket = false;
        delivery.isWicket = false;
        delivery.wicketDetails = undefined;
        wicketDetails = undefined;
      }
    }

    const runsOnBall = runsBat + runsExtra;
    updated.totalRuns += runsOnBall;

    // Extras breakdown
    if (extraType === 'wide') {
      updated.extras.wides += runsExtra;
      updated.extras.total += runsExtra;
    } else if (extraType === 'noBall') {
      updated.extras.noBalls += runsExtra;
      updated.extras.total += runsExtra;
    } else if (extraType === 'bye') {
      updated.extras.byes += runsExtra;
      updated.extras.total += runsExtra;
    } else if (extraType === 'legBye') {
      updated.extras.legByes += runsExtra;
      updated.extras.total += runsExtra;
    } else if (extraType === 'penalty') {
      updated.extras.penalties += runsExtra;
      updated.extras.total += runsExtra;
    }

    // Legal ball count
    if (isLegalDelivery) {
      updated.legalBallsBowled += 1;
      updated.oversFormatted = formatOvers(updated.legalBallsBowled);
    }

    // Initialize stats if missing
    if (!updated.batterStats[strikerId]) {
      const order = Object.keys(updated.batterStats).length + 1;
      updated.batterStats[strikerId] = {
        playerId: strikerId,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOut: false,
        battingOrder: order,
      };
    }
    if (nonStrikerId && !updated.batterStats[nonStrikerId]) {
      const order = Object.keys(updated.batterStats).length + 1;
      updated.batterStats[nonStrikerId] = {
        playerId: nonStrikerId,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOut: false,
        battingOrder: order,
      };
    }
    if (!updated.bowlerStats[bowlerId]) {
      updated.bowlerStats[bowlerId] = {
        playerId: bowlerId,
        legalBalls: 0,
        oversFormatted: '0.0',
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        economy: 0,
        wides: 0,
        noBalls: 0,
        dots: 0,
      };
    }

    // Update Batter Stats
    const striker = updated.batterStats[strikerId];
    const prevStrikerRuns = striker.runs;
    striker.runs += runsBat;
    if (extraType !== 'wide') {
      striker.ballsFaced += 1;
    }
    if (isBoundary) striker.fours += 1;
    if (isSix) striker.sixes += 1;
    striker.strikeRate =
      striker.ballsFaced > 0 ? Number(((striker.runs / striker.ballsFaced) * 100).toFixed(1)) : 0;

    // Update Bowler Stats
    const bowler = updated.bowlerStats[bowlerId];
    if (isLegalDelivery) {
      bowler.legalBalls += 1;
      bowler.oversFormatted = formatOvers(bowler.legalBalls);
    }
    if (extraType === 'wide') {
      bowler.wides += 1;
    } else if (extraType === 'noBall') {
      bowler.noBalls += 1;
    }

    // Runs charged to bowler (byes, leg byes, and penalties do not count against bowler)
    const runsAgainstBowler =
      extraType === 'bye' || extraType === 'legBye' || extraType === 'penalty'
        ? runsBat
        : runsBat + runsExtra;

    bowler.runsConceded += runsAgainstBowler;
    if (isLegalDelivery && runsAgainstBowler === 0) {
      bowler.dots += 1;
    }

    // Wicket handling — with MCC Law 25.4 Retired Hurt Fix
    if (isWicket && wicketDetails) {
      const isRetiredHurt = wicketDetails.dismissalType === 'retired_hurt';
      const dismissedPlayer = updated.batterStats[wicketDetails.playerDismissedId];

      if (isRetiredHurt) {
        // MCC Law 25.4: Retired Hurt does NOT increment totalWickets, and batter is not out
        if (dismissedPlayer) {
          dismissedPlayer.isOut = false;
          dismissedPlayer.dismissalText = 'retired hurt (not out)';
        }
      } else {
        // Standard dismissal increments total wickets
        updated.totalWickets += 1;
        if (dismissedPlayer) {
          dismissedPlayer.isOut = true;
          dismissedPlayer.bowlerId = bowlerId;
          dismissedPlayer.fielderId = wicketDetails.fielderId;
          dismissedPlayer.dismissalText = CricketEngine.getDismissalDescription(
            wicketDetails.dismissalType
          );
        }

        // Check if bowler is credited with wicket
        if (
          wicketDetails.dismissalType !== 'run_out' &&
          wicketDetails.dismissalType !== 'retired_out' &&
          wicketDetails.dismissalType !== 'timed_out' &&
          wicketDetails.dismissalType !== 'obstructing_field'
        ) {
          bowler.wickets += 1;
        }

        // Record Fall of Wicket
        updated.fallOfWickets.push({
          wicketNumber: updated.totalWickets,
          score: updated.totalRuns,
          oversFormatted: updated.oversFormatted,
          playerDismissedId: wicketDetails.playerDismissedId,
        });
      }

      // In both cases (dismissed or retired hurt), clear the batsman from current crease slot
      if (updated.currentStrikerId === wicketDetails.playerDismissedId) {
        updated.currentStrikerId = undefined;
      } else if (updated.currentNonStrikerId === wicketDetails.playerDismissedId) {
        updated.currentNonStrikerId = undefined;
      }
    }

    // Calculate bowler economy
    const bowlerOvers = bowler.legalBalls / 6;
    bowler.economy = bowlerOvers > 0 ? Number((bowler.runsConceded / bowlerOvers).toFixed(2)) : 0;

    // Recalculate maidens for completed overs
    bowler.maidens = CricketEngine.calculateMaidensForBowler(bowlerId, [...updated.deliveries, delivery]);

    // Calculate partnership for milestone alerts
    const lastFowScore = updated.fallOfWickets.length > 0
      ? updated.fallOfWickets[updated.fallOfWickets.length - 1].score
      : 0;
    const currentPartnershipRuns = updated.totalRuns - lastFowScore;
    const prevPartnershipRuns = innings.totalRuns - lastFowScore;

    // Free Hit State Machine for NEXT ball:
    // 1. If this delivery was a No-Ball and rules enable Free Hit -> next ball is Free Hit
    // 2. If this delivery was already a Free Hit and was illegal (wide or no-ball) -> carry over!
    // 3. Otherwise Free Hit expires.
    if (extraType === 'noBall' && rules.freeHitOnNoBall) {
      updated.isFreeHit = true;
    } else if (wasFreeHit && !isLegalDelivery) {
      updated.isFreeHit = true; // Carry over on wide or no-ball
    } else {
      updated.isFreeHit = false;
    }

    // Pitch Length, Line & Coordinate mapping
    if (delivery.pitchLength) {
      delivery.pitchLine = delivery.pitchLine || 'on_stumps';
      if (!delivery.pitchCoord) {
        delivery.pitchCoord = derivePitchMapping(shotArea, runsBat, isBoundary, isSix).pitchCoord;
      }
    } else if (shotArea || isBoundary || isSix) {
      const autoMap = derivePitchMapping(shotArea, runsBat, isBoundary, isSix);
      delivery.pitchLength = autoMap.pitchLength;
      delivery.pitchLine = autoMap.pitchLine;
      delivery.pitchCoord = autoMap.pitchCoord;
    }

    // Calculate balls without boundary in current innings
    let ballsWithoutBoundary = 0;
    for (let i = updated.deliveries.length - 1; i >= 0; i--) {
      const d = updated.deliveries[i];
      if (d.isBoundary || d.isSix) break;
      if (d.isLegalDelivery) ballsWithoutBoundary++;
    }

    // Check if this delivery completes an over and if that over was a maiden
    const overJustFinished = isLegalDelivery && updated.legalBallsBowled % 6 === 0;
    let isMaidenOverJustCompleted = false;
    if (overJustFinished) {
      const overDeliveries = [...updated.deliveries, delivery].filter(
        (d) => d.overIndex === delivery.overIndex
      );
      if (overDeliveries.filter((d) => d.isLegalDelivery).length === 6) {
        const runsInOver = overDeliveries.reduce((sum, d) => {
          if (d.extraType === 'bye' || d.extraType === 'legBye' || d.extraType === 'penalty') {
            return sum + d.runsBat;
          }
          return sum + d.runsBat + d.runsExtra;
        }, 0);
        if (runsInOver === 0) {
          isMaidenOverJustCompleted = true;
        }
      }
    }

    // Generate Dynamic Contextual Commentary if not explicitly provided
    if (!delivery.commentary) {
      delivery.commentary = CricketEngine.generateDeliveryCommentary(delivery, {
        ...commentaryContext,
        bowlerStats: bowler,
        strikerStats: striker,
        previousStrikerRuns: prevStrikerRuns,
        currentPartnershipRuns,
        previousPartnershipRuns: prevPartnershipRuns,
        ballsSinceLastBoundary: ballsWithoutBoundary,
        isMaidenOverJustCompleted,
        targetRuns,
        inningsTotalRuns: updated.totalRuns,
      });
    }

    // Strike Rotation
    let nextStrikerId = updated.currentStrikerId;
    let nextNonStrikerId = updated.currentNonStrikerId;
    const overFinished = isLegalDelivery && updated.legalBallsBowled % 6 === 0;

    if (nextStrikerId && nextNonStrikerId) {
      // Rotate on odd runs running physically between wickets.
      // On boundaries (4 or 6), batters do not run physical runs between wickets.
      const physicalRuns =
        isBoundary || isSix
          ? 0
          : extraType === 'wide' || extraType === 'penalty'
          ? Math.max(0, runsExtra - 1)
          : runsBat + (extraType === 'bye' || extraType === 'legBye' ? runsExtra : 0);

      const rotateForRuns = physicalRuns % 2 === 1;
      if (rotateForRuns) {
        const temp = nextStrikerId;
        nextStrikerId = nextNonStrikerId;
        nextNonStrikerId = temp;
      }

      // Rotate at end of over (if over just ended with legal ball)
      if (overFinished) {
        const temp = nextStrikerId;
        nextStrikerId = nextNonStrikerId;
        nextNonStrikerId = temp;
      }
    } else if (overFinished) {
      // If a wicket fell on the 6th ball and one slot is vacant,
      // ends still swap for the new over: surviving partner rotates end!
      const temp = nextStrikerId;
      nextStrikerId = nextNonStrikerId;
      nextNonStrikerId = temp;
    }

    updated.currentStrikerId = nextStrikerId;
    updated.currentNonStrikerId = nextNonStrikerId;
    updated.deliveries.push(delivery);

    // Innings Completion Conditions
    const allOutWickets = rules.playersPerTeam - 1;
    const maxLegalBalls = rules.totalOvers * 6;

    if (updated.totalWickets >= allOutWickets) {
      updated.isCompleted = true;
      updated.completedReason = 'All Out';
    } else if (updated.legalBallsBowled >= maxLegalBalls) {
      updated.isCompleted = true;
      updated.completedReason = 'Overs Completed';
    } else if (targetRuns && updated.totalRuns >= targetRuns) {
      updated.isCompleted = true;
      updated.completedReason = 'Target Achieved';
    }

    return updated;
  }

  static calculateMaidensForBowler(bowlerId: string, deliveries: Delivery[]): number {
    const oversMap: Record<number, Delivery[]> = {};
    for (const d of deliveries) {
      if (d.bowlerId === bowlerId) {
        if (!oversMap[d.overIndex]) {
          oversMap[d.overIndex] = [];
        }
        oversMap[d.overIndex].push(d);
      }
    }

    let maidens = 0;
    for (const overIndex in oversMap) {
      const overDeliveries = oversMap[overIndex];
      const legalCount = overDeliveries.filter((d) => d.isLegalDelivery).length;
      if (legalCount === 6) {
        const runsConcededInOver = overDeliveries.reduce((sum, d) => {
          if (d.extraType === 'bye' || d.extraType === 'legBye' || d.extraType === 'penalty') {
            return sum + d.runsBat;
          }
          return sum + d.runsBat + d.runsExtra;
        }, 0);
        if (runsConcededInOver === 0) {
          maidens += 1;
        }
      }
    }
    return maidens;
  }

  static getDismissalDescription(
    type: DismissalType,
    bowlerName?: string,
    fielderName?: string
  ): string {
    const bName = bowlerName || 'Bowler';
    switch (type) {
      case 'bowled':
        return bowlerName ? `b ${bowlerName}` : 'bowled';
      case 'caught':
        return fielderName
          ? `c ${fielderName} b ${bName}`
          : `c & b ${bName}`;
      case 'caught_and_bowled':
        return `c & b ${bName}`;
      case 'lbw':
        return bowlerName ? `lbw b ${bowlerName}` : 'lbw';
      case 'run_out':
        return fielderName ? `run out (${fielderName})` : 'run out';
      case 'stumped':
        return fielderName ? `st ${fielderName} b ${bName}` : `st b ${bName}`;
      case 'hit_wicket':
        return bowlerName ? `hit wicket b ${bowlerName}` : 'hit wicket';
      case 'retired_hurt':
        return 'retired hurt (not out)';
      case 'retired_out':
        return 'retired out';
      default:
        return 'out';
    }
  }

  static generateDeliveryCommentary(
    delivery: Delivery,
    context?: CommentaryContext
  ): string {
    const {
      runsBat,
      runsExtra,
      extraType,
      isBoundary,
      isSix,
      isWicket,
      wicketDetails,
      bowlingSide,
      shotArea,
      isFreeHit,
    } = delivery;

    const bName = context?.bowlerName || 'Bowler';
    const sName = context?.strikerName || 'Batter';
    const spell = context?.bowlerStats
      ? ` (${context.bowlerStats.oversFormatted}-${context.bowlerStats.maidens}-${context.bowlerStats.runsConceded}-${context.bowlerStats.wickets})`
      : '';
    const batterInfo = context?.strikerStats
      ? ` (${context.strikerStats.runs}* off ${context.strikerStats.ballsFaced}b)`
      : '';
    const sideInfo = bowlingSide === 'round' ? 'from round the wicket' : 'from over the wicket';
    const prefix = `${bName}${spell} to ${sName}${batterInfo}, ${sideInfo}: `;

    let core = '';

    if (isFreeHit) {
      core += '⚡ FREE HIT! ';
    }

    if (isWicket && wicketDetails) {
      if (wicketDetails.dismissalType === 'retired_hurt') {
        core += `RETIRED HURT. Batter sustains an injury and walks off not out.`;
      } else {
        const desc = CricketEngine.getDismissalDescription(
          wicketDetails.dismissalType,
          context?.bowlerName,
          context?.fielderName
        );
        core += `OUT! WICKET FALLS! ${desc}.`;
        if (shotArea) {
          core += ` Chance taken at ${shotArea}.`;
        }
      }
    } else if (isSix) {
      core += shotArea
        ? `SIX! Smashed high and handsome over ${shotArea}! Magnificent maximum!`
        : 'SIX! Cleared the ropes with a colossal strike!';
    } else if (isBoundary) {
      core += shotArea
        ? `FOUR! Pierces the gap through ${shotArea} to the boundary rope!`
        : 'FOUR! Dispatched to the fence with authority!';
    } else if (extraType === 'wide') {
      core += runsExtra > 1
        ? `Wide ball down leg/outside off + ${runsExtra - 1} extra run(s)!`
        : 'Wide delivery called by the umpire.';
      if (isFreeHit) core += ' Free Hit carries over!';
    } else if (extraType === 'noBall') {
      core += runsBat > 0
        ? `NO BALL! Overstepping the crease, and batter scampers ${runsBat} run(s)! Free hit on the next ball!`
        : 'NO BALL! Overstepping! Next ball is a FREE HIT!';
    } else if (extraType === 'legBye') {
      core += `${runsExtra} Leg bye(s) off the pads${shotArea ? ` towards ${shotArea}` : ''}.`;
    } else if (extraType === 'bye') {
      core += `${runsExtra} Bye(s) missed by keeper${shotArea ? ` into ${shotArea}` : ''}.`;
    } else if (runsBat === 0) {
      core += shotArea
        ? `Dot ball. Defended watchfully towards ${shotArea}.`
        : 'Dot ball, solid defense, no run taken.';
    } else if (runsBat === 1) {
      core += shotArea
        ? `Single taken, driven gently into ${shotArea}.`
        : 'Single taken, rotating the strike cleanly.';
    } else {
      core += shotArea
        ? `${runsBat} runs worked into the gap at ${shotArea}, aggressive running!`
        : `${runsBat} runs scored cleanly.`;
    }

    let commentary = `${prefix}${core}`;

    // Automated Milestone Alerts
    if (context?.strikerStats && context.previousStrikerRuns !== undefined) {
      const curRuns = context.strikerStats.runs;
      const prevRuns = context.previousStrikerRuns;

      if (prevRuns < 50 && curRuns >= 50) {
        commentary += `\n🎉 FIFTY! A masterclass half-century for ${sName} off ${context.strikerStats.ballsFaced} balls (${context.strikerStats.fours}x4, ${context.strikerStats.sixes}x6)!`;
      } else if (prevRuns < 100 && curRuns >= 100) {
        commentary += `\n💯 HUNDRED! Roaring century for ${sName} off ${context.strikerStats.ballsFaced} balls! The crowd is on their feet!`;
      }
    }

    if (
      context?.currentPartnershipRuns !== undefined &&
      context.previousPartnershipRuns !== undefined
    ) {
      const curPart = context.currentPartnershipRuns;
      const prevPart = context.previousPartnershipRuns;

      if (prevPart < 50 && curPart >= 50) {
        commentary += `\n🤝 50-RUN PARTNERSHIP! Critical milestone reached between the batters!`;
      } else if (prevPart < 100 && curPart >= 100) {
        commentary += `\n🤝 100-RUN PARTNERSHIP! Century stand up between the crease partners!`;
      }
    }

    // Maiden over alert
    if (context?.isMaidenOverJustCompleted) {
      commentary += `\n🔥 MAIDEN OVER! Splendid maiden over bowled by ${bName}!`;
    }

    // 5-wicket haul alert
    if (isWicket && context?.bowlerStats && context.bowlerStats.wickets === 5) {
      commentary += `\n🌟 FIVE-WICKET HAUL (5-fer)! Sensational milestone for ${bName} (${context.bowlerStats.oversFormatted}-${context.bowlerStats.maidens}-${context.bowlerStats.runsConceded}-${context.bowlerStats.wickets})!`;
    }

    // Boundary drought trivia
    if (context?.ballsSinceLastBoundary !== undefined) {
      if ((isBoundary || isSix) && context.ballsSinceLastBoundary >= 12) {
        commentary += `\n💥 Pressure released! Boundary drought broken after ${context.ballsSinceLastBoundary} deliveries!`;
      } else if (!isBoundary && !isSix && context.ballsSinceLastBoundary >= 15 && context.ballsSinceLastBoundary % 6 === 0) {
        commentary += `\n⏳ Pressure mounting! ${context.ballsSinceLastBoundary} consecutive balls without a boundary!`;
      }
    }

    // Strike rate surge
    if (context?.strikerStats && context.strikerStats.runs >= 30 && context.strikerStats.ballsFaced >= 12) {
      const sr = context.strikerStats.strikeRate;
      if (sr >= 180 && (isBoundary || isSix)) {
        commentary += `\n⚡ Strike rate surge! ${sName} striking at an explosive ${sr.toFixed(0)} SR!`;
      }
    }

    return commentary;
  }

  static evaluateMatchResult(match: Match): string | undefined {
    const { innings, rules, team1, team2, tossWinnerId, tossDecision } = match;
    const inn1 = innings[0];
    const inn2 = innings[1];

    if (!inn1 || !inn2) return undefined;

    const team1BattingFirst =
      (tossWinnerId === team1.id && tossDecision === 'bat') ||
      (tossWinnerId === team2.id && tossDecision === 'bowl');

    const firstBatTeam = team1BattingFirst ? team1 : team2;
    const secondBatTeam = team1BattingFirst ? team2 : team1;

    // Target is inn1 total + 1
    const target = inn1.totalRuns + 1;

    // Has 2nd innings won?
    if (inn2.totalRuns >= target) {
      const wicketsLost = inn2.totalWickets;
      const wicketsLeft = rules.playersPerTeam - 1 - wicketsLost;
      const ballsLeft = rules.totalOvers * 6 - inn2.legalBallsBowled;
      return `${secondBatTeam.name} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'} (${ballsLeft} ball${ballsLeft === 1 ? '' : 's'} remaining)`;
    }

    // Has 2nd innings finished without reaching target?
    if (inn2.isCompleted) {
      if (inn2.totalRuns === inn1.totalRuns) {
        return 'Match Tied';
      }
      const margin = inn1.totalRuns - inn2.totalRuns;
      return `${firstBatTeam.name} won by ${margin} run${margin === 1 ? '' : 's'}`;
    }

    return undefined;
  }
}
