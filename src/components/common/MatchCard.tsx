import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Match } from '../../types/cricket';
import { useTheme } from '../../theme/useTheme';
import { Badge } from './Badge';

export interface MatchCardProps {
  match: Match;
  onPress: () => void;
  isAuthorizedScorer?: boolean;
  onScore?: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onPress,
  isAuthorizedScorer = false,
  onScore,
}) => {
  const { theme } = useTheme();

  const inn1 = match.innings[0];
  const inn2 = match.innings[1];

  const team1BattingFirst =
    (match.tossWinnerId === match.team1.id && match.tossDecision === 'bat') ||
    (match.tossWinnerId === match.team2.id && match.tossDecision === 'bowl');

  const firstTeam = team1BattingFirst ? match.team1 : match.team2;
  const secondTeam = team1BattingFirst ? match.team2 : match.team1;

  const isLive = match.status === 'live';
  const isBreak = match.status === 'innings_break';
  const isCompleted = match.status === 'completed';

  const statusLabel = isLive ? 'Live' : isBreak ? 'Innings Break' : isCompleted ? 'Final' : 'Scheduled';
  const statusVariant = isLive ? 'live' : isBreak ? 'break' : isCompleted ? 'completed' : 'neutral';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
      onPress={onPress}
    >
      {/* Top Header Row: Match Context & Status Badges */}
      <View style={styles.headerRow}>
        <Text style={[styles.contextText, { color: theme.textSecondary }]} numberOfLines={1}>
          {match.venue} • {match.format.toUpperCase()} ({match.rules.totalOvers} ov)
        </Text>
        <View style={styles.badgeRow}>
          {match.ballType && (
            <View style={[styles.tag, { backgroundColor: theme.raised, borderColor: theme.border }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>
                {match.ballType.toUpperCase()}
              </Text>
            </View>
          )}
          <Badge label={statusLabel} variant={statusVariant} size="sm" />
          <Badge
            label={match.isSynced ? 'Synced' : 'Local'}
            variant={match.isSynced ? 'synced' : 'local'}
            size="sm"
            style={{ marginLeft: 6 }}
          />
        </View>
      </View>

      {/* Innings Scores Section */}
      <View style={[styles.teamsBox, { backgroundColor: theme.raised, borderColor: theme.borderSubdued }]}>
        {/* Innings 1 Team */}
        <View style={styles.teamRow}>
          <View style={styles.teamIdentity}>
            <View style={[styles.teamSwatch, { backgroundColor: firstTeam.primaryColor || theme.brand }]} />
            <Text style={[styles.teamName, { color: theme.textPrimary }]} numberOfLines={1}>
              {firstTeam.name}
            </Text>
          </View>
          <Text style={[styles.scoreText, { color: theme.textPrimary }]}>
            {inn1 ? `${inn1.totalRuns}/${inn1.totalWickets} (${inn1.oversFormatted})` : 'Yet to bat'}
          </Text>
        </View>

        {/* Innings 2 Team */}
        <View style={[styles.teamRow, { marginTop: 8 }]}>
          <View style={styles.teamIdentity}>
            <View style={[styles.teamSwatch, { backgroundColor: secondTeam.primaryColor || theme.brand }]} />
            <Text style={[styles.teamName, { color: theme.textPrimary }]} numberOfLines={1}>
              {secondTeam.name}
            </Text>
          </View>
          <Text style={[styles.scoreText, { color: theme.textPrimary }]}>
            {inn2
              ? `${inn2.totalRuns}/${inn2.totalWickets} (${inn2.oversFormatted})`
              : (isLive || isBreak) && inn1
              ? `Target: ${inn1.totalRuns + 1}`
              : 'Yet to bat'}
          </Text>
        </View>
      </View>

      {/* Result / Status Note */}
      {match.result ? (
        <Text style={[styles.resultText, { color: theme.brand }]} numberOfLines={1}>
          {match.result}
        </Text>
      ) : isLive && inn1 && !inn2 ? (
        <Text style={[styles.statusNoteText, { color: theme.textSecondary }]}>
          {firstTeam.shortName} batting • {inn1.oversFormatted} overs bowled
        </Text>
      ) : null}

      {/* Bottom Action Row */}
      <View style={[styles.footerRow, { borderTopColor: theme.borderSubdued }]}>
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={onPress}
        >
          <Ionicons name="document-text-outline" size={13} color={theme.textSecondary} />
          <Text style={[styles.chipText, { color: theme.textSecondary }]}>Scorecard</Text>
        </TouchableOpacity>

        {match.tournamentId && (
          <View style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="trophy-outline" size={13} color={theme.textSecondary} />
            <Text style={[styles.chipText, { color: theme.textSecondary }]}>Tournament</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {isAuthorizedScorer && !isCompleted ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.brand }]}
            onPress={onScore || onPress}
          >
            <Ionicons name="create-outline" size={14} color={theme.brandText} />
            <Text style={[styles.actionBtnText, { color: theme.brandText }]}>Score</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.raised, borderColor: theme.border, borderWidth: 1 }]}
            onPress={onPress}
          >
            <Ionicons name="eye-outline" size={14} color={theme.textPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>
              {isCompleted ? 'View' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  contextText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  teamsBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  teamSwatch: {
    width: 3,
    height: 14,
    borderRadius: 2,
    marginRight: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  resultText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusNoteText: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
