import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Match, Player } from '../../types/cricket';
import { useTheme } from '../../theme/useTheme';
import { Badge } from '../common/Badge';
import { calculateRunRate, calculateRequiredRunRate } from '../../engine/cricketEngine';

interface ScoreboardBannerProps {
  match: Match;
  onPressBatters?: () => void;
  onPressBowler?: () => void;
}

export const ScoreboardBanner: React.FC<ScoreboardBannerProps> = ({ match }) => {
  const { theme } = useTheme();

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
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Top Header: Teams, Status, and Sync */}
      <View style={styles.headerRow}>
        <View style={styles.teamHeader}>
          <Text style={[styles.teamTitle, { color: theme.textPrimary }]}>{battingTeam.name}</Text>
          <Text style={[styles.vsText, { color: theme.textSecondary }]}>vs {bowlingTeam.shortName}</Text>
        </View>
        <View style={styles.badgeRow}>
          {match.ballType && (
            <View style={[styles.ballTypeBadge, { backgroundColor: theme.raised, borderColor: theme.border }]}>
              <Text style={[styles.ballTypeText, { color: theme.textSecondary }]}>
                {match.ballType === 'leather'
                  ? 'LEATHER'
                  : match.ballType === 'tennis'
                  ? 'TENNIS'
                  : 'TAPE'}
              </Text>
            </View>
          )}
          <Badge
            label={match.status === 'live' ? 'Live' : match.status.toUpperCase()}
            variant={match.status === 'live' ? 'live' : 'break'}
            size="sm"
            style={{ marginLeft: 6 }}
          />
          <Badge
            label={match.isSynced ? 'Synced' : 'Local'}
            variant={match.isSynced ? 'synced' : 'local'}
            size="sm"
            style={{ marginLeft: 6 }}
          />
        </View>
      </View>

      {/* Main Score & Overs Display (Tabular Figures) */}
      <View style={styles.scoreRow}>
        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreNumber, { color: theme.textPrimary }]}>
            {currentInnings.totalRuns}/{currentInnings.totalWickets}
          </Text>
          <Text style={[styles.oversText, { color: theme.textSecondary }]}>
            ({currentInnings.oversFormatted} / {match.rules.totalOvers} ov)
          </Text>
        </View>
        <View style={styles.rateContainer}>
          <Text style={[styles.rateLabel, { color: theme.textSecondary }]}>
            CRR: <Text style={[styles.rateValue, { color: theme.brand }]}>{crr}</Text>
          </Text>
          {rrr !== null && (
            <Text style={[styles.rateLabel, { color: theme.textSecondary }]}>
              RRR: <Text style={[styles.rateValue, { color: theme.brand }]}>{rrr}</Text>
            </Text>
          )}
        </View>
      </View>

      {/* Target Status bar */}
      {isChasing && (
        <View style={[styles.targetBar, { backgroundColor: theme.statusWarningBg, borderLeftColor: theme.statusWarning }]}>
          <Text style={[styles.targetText, { color: theme.statusWarning }]}>
            {runsNeeded > 0
              ? `Need ${runsNeeded} runs in ${ballsRemaining} balls (Target: ${match.targetRuns})`
              : `Target achieved`}
          </Text>
        </View>
      )}

      {/* Crease Status: Batters and Bowler */}
      <View style={[styles.creaseGrid, { backgroundColor: theme.raised, borderColor: theme.borderSubdued }]}>
        {/* Batters */}
        <View style={[styles.playerBox, { borderRightColor: theme.border }]}>
          <View style={styles.playerRow}>
            <View style={styles.roleRow}>
              <View style={[styles.strikeIndicator, { backgroundColor: theme.brand }]} />
              <Text style={[styles.creaseRole, { color: theme.brand }]}>STRIKER</Text>
            </View>
            <Text style={[styles.playerName, { color: theme.textPrimary }]} numberOfLines={1}>
              {striker ? striker.name : 'Choose Batter'}
            </Text>
            <Text style={[styles.playerStats, { color: theme.textSecondary }]}>
              {strikerStats ? `${strikerStats.runs} (${strikerStats.ballsFaced}b)` : '-'}
            </Text>
          </View>

          <View style={[styles.playerRow, { marginTop: 6 }]}>
            <Text style={[styles.creaseRole, { color: theme.textMuted, marginLeft: 10 }]}>NON-STRIKER</Text>
            <Text style={[styles.playerName, { color: theme.textPrimary }]} numberOfLines={1}>
              {nonStriker ? nonStriker.name : 'Choose Batter'}
            </Text>
            <Text style={[styles.playerStats, { color: theme.textSecondary }]}>
              {nonStrikerStats ? `${nonStrikerStats.runs} (${nonStrikerStats.ballsFaced}b)` : '-'}
            </Text>
          </View>
        </View>

        {/* Bowler */}
        <View style={styles.bowlerBox}>
          <Text style={[styles.creaseRole, { color: theme.textSecondary }]}>BOWLER</Text>
          <Text style={[styles.playerName, { color: theme.textPrimary }]} numberOfLines={1}>
            {bowler ? bowler.name : 'Choose Bowler'}
          </Text>
          <Text style={[styles.bowlerStats, { color: theme.textSecondary }]}>
            {bowlerStats
              ? `${bowlerStats.oversFormatted}-${bowlerStats.maidens}-${bowlerStats.runsConceded}-${bowlerStats.wickets}`
              : '-'}
          </Text>
          {bowlerStats && (
            <Text style={[styles.bowlerEconomy, { color: theme.textMuted }]}>
              Econ: {bowlerStats.economy.toFixed(1)}
            </Text>
          )}
        </View>
      </View>

      {/* Match Context Footer */}
      {(match.scorerName || match.venue) && (
        <View style={[styles.metaRow, { borderTopColor: theme.borderSubdued }]}>
          <Text style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
            {match.venue} • Scorer: {match.scorerName || 'Official'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
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
    flex: 1,
  },
  teamTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ballTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  ballTypeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  oversText: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rateContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rateLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  rateValue: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  targetBar: {
    borderLeftWidth: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginVertical: 8,
  },
  targetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  creaseGrid: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 12,
    borderWidth: 1,
  },
  playerBox: {
    flex: 3,
    borderRightWidth: 1,
    paddingRight: 10,
  },
  playerRow: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  strikeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  creaseRole: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  playerStats: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  bowlerBox: {
    flex: 2,
    justifyContent: 'center',
  },
  bowlerStats: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  bowlerEconomy: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  metaRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
