import type { Team, Match, Innings, MatchRules } from '../types/cricket';

export interface TournamentStanding {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  runsScored: number;
  oversFacedDecimal: number;
  runsConceded: number;
  oversBowledDecimal: number;
  nrr: number; // Net Run Rate
}

export class TournamentEngine {
  /**
   * Helper to compute decimal overs taking into account the ICC/MCC All-Out Rule:
   * If a team is all out, the FULL quota of allotted overs is used as the divisor!
   */
  static getOversDecimal(legalBalls: number, isAllOut: boolean, quota: number): number {
    if (isAllOut) return quota;
    const completed = Math.floor(legalBalls / 6);
    const rem = legalBalls % 6;
    return completed + rem / 6;
  }

  /**
   * Pure mathematical calculation of tournament points and Net Run Rate (NRR)
   * across completed canonical matches.
   */
  static calculateStandings(teams: Team[], matches: Match[]): TournamentStanding[] {
    const standingsMap = new Map<string, TournamentStanding>();

    for (const team of teams) {
      standingsMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        runsScored: 0,
        oversFacedDecimal: 0,
        runsConceded: 0,
        oversBowledDecimal: 0,
        nrr: 0,
      });
    }

    const completedMatches = matches.filter(
      (m) => m.status === 'completed' || m.approvalStatus === 'approved'
    );

    for (const match of completedMatches) {
      const inn1 = match.innings[0];
      const inn2 = match.innings[1];
      if (!inn1 || !inn2) continue;

      const team1Stats = standingsMap.get(inn1.battingTeamId);
      const team2Stats = standingsMap.get(inn2.battingTeamId);
      if (!team1Stats || !team2Stats) continue;

      const totalQuota = match.rules?.totalOvers || 20;
      const allOutWickets = (match.rules?.playersPerTeam || 11) - 1;

      const inn1AllOut = inn1.totalWickets >= allOutWickets;
      const inn2AllOut = inn2.totalWickets >= allOutWickets;

      const inn1OversDecimal = this.getOversDecimal(inn1.legalBallsBowled, inn1AllOut, totalQuota);
      const inn2OversDecimal = this.getOversDecimal(inn2.legalBallsBowled, inn2AllOut, totalQuota);

      team1Stats.played += 1;
      team2Stats.played += 1;

      team1Stats.runsScored += inn1.totalRuns;
      team1Stats.oversFacedDecimal += inn1OversDecimal;
      team1Stats.runsConceded += inn2.totalRuns;
      team1Stats.oversBowledDecimal += inn2OversDecimal;

      team2Stats.runsScored += inn2.totalRuns;
      team2Stats.oversFacedDecimal += inn2OversDecimal;
      team2Stats.runsConceded += inn1.totalRuns;
      team2Stats.oversBowledDecimal += inn1OversDecimal;

      if (inn1.totalRuns > inn2.totalRuns) {
        team1Stats.won += 1;
        team1Stats.points += 2;
        team2Stats.lost += 1;
      } else if (inn2.totalRuns > inn1.totalRuns) {
        team2Stats.won += 1;
        team2Stats.points += 2;
        team1Stats.lost += 1;
      } else {
        team1Stats.tied += 1;
        team1Stats.points += 1;
        team2Stats.tied += 1;
        team2Stats.points += 1;
      }
    }

    // Compute NRR for each team
    const result: TournamentStanding[] = Array.from(standingsMap.values()).map((s) => {
      let nrr = 0;
      if (s.oversFacedDecimal > 0 && s.oversBowledDecimal > 0) {
        const forRate = s.runsScored / s.oversFacedDecimal;
        const againstRate = s.runsConceded / s.oversBowledDecimal;
        nrr = Number((forRate - againstRate).toFixed(3));
      }
      return {
        ...s,
        nrr,
      };
    });

    // Sort by Points (descending), then NRR (descending)
    return result.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return b.nrr - a.nrr;
    });
  }
}
