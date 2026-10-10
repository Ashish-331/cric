import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Match, Player } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { Badge } from '../common/Badge';
import { calculateRunRate, calculateRequiredRunRate } from '../../engine/cricketEngine';

interface ScoreboardBannerProps {
  match: Match;
  onPressBatters?: () => void;
  onPressBowler?: () => void;
}

export const ScoreboardBanner: React.FC<ScoreboardBannerProps> = ({ match }) => {
  const innIndex = match.currentInningsIndex;
  const currentInnings = match.innings[innIndex];
  if (!currentInnings) return null;

  const battingTeam = match.team1.id === currentInnings.battingTeamId ? match.team1 : match.team2;
  const bowlingTeam = match.team1.id === currentInnings.bowlingTeamId ? match.team1 : match.team2;

  const allPlayers: Player[] = [...match.team1.players, ...match.team2.players];
  const getPlayer = (id?: string) => allPlayers.find((p) => p.id === id);

  const striker = getPlayer(currentInnings.currentStrikerId);
  const nonStriker = getPlayer(currentInnings.currentNonStrikerId);
  const bowler = getPlayer(currentInnings.currentBowlerId);

  const strikerStats = currentInnings.currentStrikerId
    ? currentInnings.batterStats[currentInnings.currentStrikerId]
    : undefined;
  const nonStrikerStats = currentInnings.currentNonStrikerId
    ? currentInnings.batterStats[currentInnings.currentNonStrikerId]
    : undefined;
  const bowlerStats = currentInnings.currentBowlerId
    ? currentInnings.bowlerStats[currentInnings.currentBowlerId]
    : undefined;

  const crr = calculateRunRate(currentInnings.totalRuns, currentInnings.legalBallsBowled);
  const isChasing = innIndex === 1 && match.targetRuns !== undefined;
  const runsNeeded = isChasing ? match.targetRuns! - currentInnings.totalRuns : 0;
  const ballsRemaining = match.rules.totalOvers * 6 - currentInnings.legalBallsBowled;
  const rrr = isChasing ? calculateRequiredRunRate(runsNeeded, ballsRemaining) : null;

  return (
    <View style={styles.container}>
      {/* Top Header: Teams, Status, and Sync */}
      <View style={styles.headerRow}>
        <View style={styles.teamHeader}>
          <Text style={styles.teamTitle}>{battingTeam.name}</Text>
          <Text style={styles.vsText}>vs {bowlingTeam.shortName}</Text>
        </View>
        <View style={styles.badgeRow}>
          {match.ballType && (
            <View style={styles.ballTypeBadge}>
              <Text style={styles.ballTypeText}>
                {match.ballType === 'leather'
                  ? 'LEATHER'
                  : match.ballType === 'tennis'
                  ? 'TENNIS'
                  : 'TAPE'}
              </Text>
            </View>
          )}
          <Badge
            label={match.status === 'live' ? 'LIVE' : match.status.toUpperCase()}
            variant={match.status === 'live' ? 'live' : 'break'}
            size="sm"
            style={{ marginLeft: 4 }}
          />
          <Badge
            label={match.isSynced ? 'SYNCED' : 'LOCAL'}
            variant={match.isSynced ? 'synced' : 'local'}
            size="sm"
            style={{ marginLeft: 4 }}
          />
        </View>
      </View>

      {/* Main Score & Overs Display (Tabular Figures) */}
      <View style={styles.scoreRow}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreNumber}>
            {currentInnings.totalRuns}/{currentInnings.totalWickets}
          </Text>
          <Text style={styles.oversText}>
            ({currentInnings.oversFormatted} / {match.rules.totalOvers} ov)
          </Text>
        </View>
        <View style={styles.rateContainer}>
          <Text style={styles.rateLabel}>
            CRR: <Text style={styles.rateValue}>{crr}</Text>
          </Text>
          {rrr !== null && (
            <Text style={styles.rateLabel}>
              RRR: <Text style={styles.rateValue}>{rrr}</Text>
            </Text>
          )}
        </View>
      </View>

      {/* Target Status bar */}
      {isChasing && (
        <View style={styles.targetBar}>
          <Text style={styles.targetText}>
            {runsNeeded > 0
              ? `Need ${runsNeeded} runs in ${ballsRemaining} balls to win (Target: ${match.targetRuns})`
              : `Target achieved!`}
          </Text>
        </View>
      )}

      {/* Crease Status: Batters and Bowler */}
      <View style={styles.creaseGrid}>
        {/* Batters */}
        <View style={styles.playerBox}>
          <View style={styles.playerRow}>
            <Text style={styles.creaseRole}>⚡ STRIKER</Text>
            <Text style={styles.playerName} numberOfLines={1}>
              {striker ? striker.name : 'Choose Batter'}
            </Text>
            <Text style={styles.playerStats}>
              {strikerStats ? `${strikerStats.runs} (${strikerStats.ballsFaced}b)` : '-'}
            </Text>
          </View>

          <View style={[styles.playerRow, { marginTop: 6 }]}>
            <Text style={[styles.creaseRole, { color: '#94A3B8' }]}>NON-STRIKER</Text>
            <Text style={styles.playerName} numberOfLines={1}>
              {nonStriker ? nonStriker.name : 'Choose Batter'}
            </Text>
            <Text style={styles.playerStats}>
              {nonStrikerStats ? `${nonStrikerStats.runs} (${nonStrikerStats.ballsFaced}b)` : '-'}
            </Text>
          </View>
        </View>

        {/* Bowler */}
        <View style={styles.bowlerBox}>
          <Text style={styles.creaseRole}>BOWLER</Text>
          <Text style={styles.playerName} numberOfLines={1}>
            {bowler ? bowler.name : 'Choose Bowler'}
          </Text>
          <Text style={styles.bowlerStats}>
            {bowlerStats
              ? `${bowlerStats.oversFormatted}-${bowlerStats.maidens}-${bowlerStats.runsConceded}-${bowlerStats.wickets}`
              : '-'}
          </Text>
          {bowlerStats && (
            <Text style={styles.bowlerEconomy}>Econ: {bowlerStats.economy}</Text>
          )}
        </View>
      </View>

      {/* Match Context Footer */}
      {(match.scorerName || match.venue) && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            📍 {match.venue} • Scorer: {match.scorerName || 'Official'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.darkCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  teamTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  vsText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ballTypeBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ballTypeText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '800',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  scoreNumber: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  oversText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rateContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rateLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  rateValue: {
    color: '#38BDF8',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  targetBar: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentAmber,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginVertical: 8,
  },
  targetText: {
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '700',
  },
  creaseGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.darkCardSurface,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    gap: 12,
  },
  playerBox: {
    flex: 3,
    borderRightWidth: 1,
    borderRightColor: '#334155',
    paddingRight: 10,
  },
  playerRow: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  creaseRole: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playerName: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
  },
  playerStats: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  bowlerBox: {
    flex: 2,
    justifyContent: 'center',
  },
  bowlerStats: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bowlerEconomy: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  metaText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
});
