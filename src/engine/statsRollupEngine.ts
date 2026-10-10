import type { Match, Player, CareerStats } from '../types/cricket';

/**
 * StatsRollupEngine
 * 
 * Aggregates career statistics for players across matches.
 * Deterministic and idempotent: can compute fresh rollup from all completed
 * matches or merge incrementally.
 */
export class StatsRollupEngine {
  /**
   * Initializes a zeroed CareerStats object
   */
  static createEmptyCareerStats(): CareerStats {
    return {
      matches: 0,
      inningsBatted: 0,
      runs: 0,
      highestScore: 0,
      highestScoreNotOut: false,
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
      bestBowlingWickets: 0,
      bestBowlingRuns: 999,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
    };
  }

  /**
   * Aggregates stats for all players across all completed matches.
   * Preserves baseline stats if player has historical stats seeded.
   */
  static rollupAllCareerStats(
    players: Player[],
    matches: Match[]
  ): Map<string, { careerStats: CareerStats; baselineStats: CareerStats; recentScores: number[]; baselineRecentScores: number[] }> {
    const resultMap = new Map<
      string,
      { careerStats: CareerStats; baselineStats: CareerStats; recentScores: number[]; baselineRecentScores: number[] }
    >();

    // 1. Initialize for each player using baselineStats to guarantee idempotency
    for (const player of players) {
      const base = player.baselineStats
        ? { ...player.baselineStats }
        : player.careerStats
        ? { ...player.careerStats }
        : StatsRollupEngine.createEmptyCareerStats();
      const recent = player.baselineRecentScores
        ? [...player.baselineRecentScores]
        : player.recentScores
        ? [...player.recentScores]
        : [];
      resultMap.set(player.id, {
        careerStats: { ...base },
        baselineStats: { ...base },
        recentScores: [...recent],
        baselineRecentScores: [...recent],
      });
    }

    // 2. Filter completed matches sorted chronologically
    const completedMatches = matches
      .filter((m) => m.status === 'completed')
      .sort((a, b) => a.lastUpdated - b.lastUpdated);

    // If there are no completed matches, return existing player baseline stats intact
    // (Crucial: prevents zeroing out averages, strike rates, overs bowled)
    if (completedMatches.length === 0) {
      return resultMap;
    }

    // Track internal counters for averages, integrating historical baseline if available
    const playerAccumulators = new Map<
      string,
      {
        timesOut: number;
        ballsFaced: number;
        legalBallsBowled: number;
        inningsScores: number[];
      }
    >();

    for (const player of players) {
      const base = player.baselineStats ?? player.careerStats;
      const baseTimesOut =
        base && base.average > 0 && base.runs > 0
          ? Math.max(1, Math.round(base.runs / base.average))
          : base?.inningsBatted || 0;
      const baseBallsFaced =
        base && base.strikeRate > 0 && base.runs > 0
          ? Math.max(1, Math.round((base.runs / base.strikeRate) * 100))
          : 0;
      const oversWhole = base ? Math.floor(base.oversBowled) : 0;
      const oversPart = base ? Math.round((base.oversBowled % 1) * 10) : 0;
      const baseLegalBalls = oversWhole * 6 + oversPart;

      playerAccumulators.set(player.id, {
        timesOut: baseTimesOut,
        ballsFaced: baseBallsFaced,
        legalBallsBowled: baseLegalBalls,
        inningsScores: [],
      });
    }

    // 3. Roll up each completed match
    for (const match of completedMatches) {
      const matchPlayerIds = new Set<string>();

      // Register participation from playing XIs
      if (match.playingXITeam1) {
        match.playingXITeam1.forEach((id) => matchPlayerIds.add(id));
      }
      if (match.playingXITeam2) {
        match.playingXITeam2.forEach((id) => matchPlayerIds.add(id));
      }

      // Process Innings
      for (const innings of match.innings) {
        if (!innings) continue;

        // Batting stats
        for (const [pId, bStat] of Object.entries(innings.batterStats)) {
          matchPlayerIds.add(pId);
          let record = resultMap.get(pId);
          if (!record) {
            record = {
              careerStats: StatsRollupEngine.createEmptyCareerStats(),
              baselineStats: StatsRollupEngine.createEmptyCareerStats(),
              recentScores: [],
              baselineRecentScores: [],
            };
            resultMap.set(pId, record);
          }
          let acc = playerAccumulators.get(pId);
          if (!acc) {
            acc = { timesOut: 0, ballsFaced: 0, legalBallsBowled: 0, inningsScores: [] };
            playerAccumulators.set(pId, acc);
          }

          if (bStat.ballsFaced > 0 || bStat.runs > 0 || bStat.isOut) {
            record.careerStats.inningsBatted += 1;
            record.careerStats.runs += bStat.runs;
            record.careerStats.fours += bStat.fours;
            record.careerStats.sixes += bStat.sixes;
            acc.ballsFaced += bStat.ballsFaced;

            if (bStat.isOut) {
              acc.timesOut += 1;
            }

            // High Score
            if (bStat.runs > record.careerStats.highestScore) {
              record.careerStats.highestScore = bStat.runs;
              record.careerStats.highestScoreNotOut = !bStat.isOut;
            }

            // Milestones
            if (bStat.runs >= 100) {
              record.careerStats.hundreds += 1;
            } else if (bStat.runs >= 50) {
              record.careerStats.fifties += 1;
            }

            acc.inningsScores.push(bStat.runs);
          }
        }

        // Bowling stats
        for (const [pId, bowlStat] of Object.entries(innings.bowlerStats)) {
          matchPlayerIds.add(pId);
          let record = resultMap.get(pId);
          if (!record) {
            record = {
              careerStats: StatsRollupEngine.createEmptyCareerStats(),
              baselineStats: StatsRollupEngine.createEmptyCareerStats(),
              recentScores: [],
              baselineRecentScores: [],
            };
            resultMap.set(pId, record);
          }
          let acc = playerAccumulators.get(pId);
          if (!acc) {
            acc = { timesOut: 0, ballsFaced: 0, legalBallsBowled: 0, inningsScores: [] };
            playerAccumulators.set(pId, acc);
          }

          if (bowlStat.legalBalls > 0) {
            acc.legalBallsBowled += bowlStat.legalBalls;
            record.careerStats.maidens += bowlStat.maidens;
            record.careerStats.runsConceded += bowlStat.runsConceded;
            record.careerStats.wickets += bowlStat.wickets;

            // Best Bowling Inning check
            const curBestWickets = record.careerStats.bestBowlingWickets ?? 0;
            const curBestRuns = record.careerStats.bestBowlingRuns ?? 999;

            if (
              bowlStat.wickets > curBestWickets ||
              (bowlStat.wickets === curBestWickets &&
                bowlStat.wickets > 0 &&
                bowlStat.runsConceded < curBestRuns)
            ) {
              record.careerStats.bestBowlingWickets = bowlStat.wickets;
              record.careerStats.bestBowlingRuns = bowlStat.runsConceded;
              record.careerStats.bestBowling = `${bowlStat.wickets}/${bowlStat.runsConceded}`;
            }
          }
        }

        // Fielding stats from deliveries
        for (const del of innings.deliveries) {
          if (del.isWicket && del.wicketDetails && del.wicketDetails.fielderId) {
            const fielderId = del.wicketDetails.fielderId;
            let record = resultMap.get(fielderId);
            if (!record) {
              record = {
                careerStats: StatsRollupEngine.createEmptyCareerStats(),
                baselineStats: StatsRollupEngine.createEmptyCareerStats(),
                recentScores: [],
                baselineRecentScores: [],
              };
              resultMap.set(fielderId, record);
            }

            const dismissal = del.wicketDetails.dismissalType;
            if (dismissal === 'caught' || dismissal === 'caught_and_bowled') {
              record.careerStats.catches += 1;
            } else if (dismissal === 'stumped') {
              record.careerStats.stumpings += 1;
            } else if (dismissal === 'run_out') {
              record.careerStats.runOuts += 1;
            }
          }
        }
      }

      // Increment matches played for all participants
      for (const pId of matchPlayerIds) {
        let record = resultMap.get(pId);
        if (record) {
          record.careerStats.matches += 1;
        }
      }
    }

    // 4. Compute Derived Rates and finalize with robust divide-by-zero guards
    for (const [pId, record] of resultMap.entries()) {
      const acc = playerAccumulators.get(pId);
      if (!acc) continue;

      // Batting Average
      if (acc.timesOut > 0) {
        record.careerStats.average = Number(
          (record.careerStats.runs / acc.timesOut).toFixed(2)
        );
      } else if (record.careerStats.inningsBatted > 0) {
        record.careerStats.average = record.careerStats.runs;
      } else {
        record.careerStats.average = 0;
      }

      // Strike Rate
      if (acc.ballsFaced > 0) {
        record.careerStats.strikeRate = Number(
          ((record.careerStats.runs / acc.ballsFaced) * 100).toFixed(2)
        );
      } else {
        record.careerStats.strikeRate = 0;
      }

      // Overs Bowled
      const oversInt = Math.floor(acc.legalBallsBowled / 6);
      const remainingBalls = acc.legalBallsBowled % 6;
      record.careerStats.oversBowled = Number(`${oversInt}.${remainingBalls}`);

      // Bowling Economy
      const oversDecimal = acc.legalBallsBowled / 6;
      if (oversDecimal > 0) {
        record.careerStats.bowlingEconomy = Number(
          (record.careerStats.runsConceded / oversDecimal).toFixed(2)
        );
      } else {
        record.careerStats.bowlingEconomy = 0;
      }

      // Bowling Average
      if (record.careerStats.wickets > 0) {
        record.careerStats.bowlingAverage = Number(
          (record.careerStats.runsConceded / record.careerStats.wickets).toFixed(2)
        );
      } else {
        record.careerStats.bowlingAverage = 0;
      }

      // Recent Scores (Last 5 innings)
      if (acc.inningsScores.length > 0) {
        const priorScores = record.baselineRecentScores || [];
        record.recentScores = [...priorScores, ...acc.inningsScores].slice(-5);
      } else {
        record.recentScores = [...(record.baselineRecentScores || [])];
      }
    }

    return resultMap;
  }
}
