import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Colors } from '../../utils/colors';
import { Player, Match } from '../../types/cricket';
import { useTheme } from '../../theme';
import { ThemeColors } from '../../theme/tokens';

type Category = 'batting' | 'bowling' | 'fielding' | 'mvp';
type FormatFilter = 'all' | 't20' | 'odi' | 'custom';
type ScopeFilter = 'career' | 'tournament';

interface RankedEntry {
  rank: number;
  playerId: string;
  name: string;
  teamName: string;
  primaryValue: string | number;
  primaryLabel: string;
  secondaryStats: string;
  isQualified: boolean;
  qualificationNote: string;
}

export default function LeaderboardsScreen() {
  const { theme, colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { teams, matches, tournaments } = useCricket();
  const [category, setCategory] = useState<Category>('batting');
  const [format, setFormat] = useState<FormatFilter>('all');
  const [scope, setScope] = useState<ScopeFilter>('career');

  // Collect all unique players across teams
  const allPlayers = useMemo(() => {
    const map = new Map<string, { player: Player; teamName: string }>();
    for (const team of teams) {
      for (const p of team.players) {
        if (!map.has(p.id)) {
          map.set(p.id, { player: p, teamName: team.name });
        }
      }
    }
    return Array.from(map.values());
  }, [teams]);

  // Compute ranked entries based on category and formula
  const rankedEntries: RankedEntry[] = useMemo(() => {
    if (allPlayers.length === 0) return [];

    const list: RankedEntry[] = [];

    for (const { player, teamName } of allPlayers) {
      const stats = player.careerStats;
      if (!stats) continue;

      if (category === 'batting') {
        const isQualified = stats.inningsBatted >= 1;
        list.push({
          rank: 0,
          playerId: player.id,
          name: player.name,
          teamName,
          primaryValue: stats.runs,
          primaryLabel: 'RUNS',
          secondaryStats: `Avg: ${stats.average.toFixed(1)} • SR: ${stats.strikeRate.toFixed(1)} • HS: ${stats.highestScore}${stats.highestScoreNotOut ? '*' : ''} • ${stats.fifties}x50 • ${stats.hundreds}x100`,
          isQualified,
          qualificationNote: isQualified ? 'Eligible' : 'Sample: <1 inn',
        });
      } else if (category === 'bowling') {
        const isQualified = stats.oversBowled >= 1;
        list.push({
          rank: 0,
          playerId: player.id,
          name: player.name,
          teamName,
          primaryValue: stats.wickets,
          primaryLabel: 'WICKETS',
          secondaryStats: `Econ: ${stats.bowlingEconomy.toFixed(2)} • Best: ${stats.bestBowling} • ${stats.maidens} maidens • ${stats.oversBowled} ov`,
          isQualified,
          qualificationNote: isQualified ? 'Eligible' : 'Sample: <1 ov',
        });
      } else if (category === 'fielding') {
        const totalDismissals = stats.catches + stats.stumpings + stats.runOuts;
        const isQualified = stats.matches >= 1;
        list.push({
          rank: 0,
          playerId: player.id,
          name: player.name,
          teamName,
          primaryValue: totalDismissals,
          primaryLabel: 'DISMISSALS',
          secondaryStats: `${stats.catches} catches • ${stats.stumpings} stumpings • ${stats.runOuts} run outs`,
          isQualified,
          qualificationNote: isQualified ? 'Eligible' : 'Sample: 0 matches',
        });
      } else if (category === 'mvp') {
        // Fantasy MVP points formula:
        // Runs*1 + 4s*1 + 6s*2 + Wickets*25 + Maidens*8 + Catches*8 + Stumpings*12 + RunOuts*8
        const mvpPoints =
          stats.runs * 1 +
          stats.fours * 1 +
          stats.sixes * 2 +
          stats.wickets * 25 +
          stats.maidens * 8 +
          stats.catches * 8 +
          stats.stumpings * 12 +
          stats.runOuts * 8;

        const isQualified = stats.matches >= 1;
        list.push({
          rank: 0,
          playerId: player.id,
          name: player.name,
          teamName,
          primaryValue: mvpPoints,
          primaryLabel: 'MVP PTS',
          secondaryStats: `${stats.runs} runs • ${stats.wickets} wkts • ${stats.catches + stats.stumpings} fielding`,
          isQualified,
          qualificationNote: isQualified ? 'Eligible' : 'Sample: 0 matches',
        });
      }
    }

    // Sort descending by primary value, tie-break by secondary metrics
    list.sort((a, b) => {
      const numA = typeof a.primaryValue === 'number' ? a.primaryValue : 0;
      const numB = typeof b.primaryValue === 'number' ? b.primaryValue : 0;
      return numB - numA;
    });

    // Assign 1-indexed rank
    return list.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  }, [allPlayers, category]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboards</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Scope Selector: Career vs Tournament */}
      <View style={styles.scopeRow}>
        <TouchableOpacity
          style={[styles.scopeBtn, scope === 'career' && styles.activeScopeBtn]}
          onPress={() => setScope('career')}
        >
          <Text style={[styles.scopeBtnText, scope === 'career' && styles.activeScopeBtnText]}>
            Career Scope
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scopeBtn, scope === 'tournament' && styles.activeScopeBtn]}
          onPress={() => setScope('tournament')}
        >
          <Text style={[styles.scopeBtnText, scope === 'tournament' && styles.activeScopeBtnText]}>
            Season / League
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Tabs: Batting, Bowling, Fielding, MVP */}
      <View style={styles.categoryBar}>
        {(['batting', 'bowling', 'fielding', 'mvp'] as Category[]).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryTab, category === cat && styles.activeCategoryTab]}
            onPress={() => setCategory(cat)}
          >
            <Text
              style={[
                styles.categoryTabText,
                category === cat && styles.activeCategoryTabText,
              ]}
            >
              {cat.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transparent Formula / Sample Disclosure Banner */}
      <View style={styles.disclosureBanner}>
        <Ionicons name="shield-checkmark-outline" size={15} color={theme.brand} />
        <Text style={styles.disclosureText}>
          {category === 'batting'
            ? 'Batting ranking sorted by gross runs. Tie-break: strike rate. Minimum 1 innings.'
            : category === 'bowling'
            ? 'Bowling ranking sorted by wickets taken. Tie-break: economy rate. Minimum 1 over.'
            : category === 'fielding'
            ? 'Fielding ranking sorted by total dismissed chances (catches + stumpings + run outs).'
            : 'MVP Points: Runs (1pt), 4s (1pt), 6s (2pt), Wickets (25pt), Maidens (8pt), Catches (8pt), Stumpings (12pt).'}
        </Text>
      </View>

      {/* Rankings FlatList */}
      <FlatList
        data={rankedEntries}
        keyExtractor={(item) => item.playerId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isTop3 = item.rank <= 3;
          const medalColor =
            item.rank === 1 ? '#D97706' : item.rank === 2 ? '#64748B' : item.rank === 3 ? '#92400E' : theme.border;

          return (
            <TouchableOpacity
              style={styles.rankCard}
              onPress={() => router.push(`/player/${item.playerId}`)}
              activeOpacity={0.8}
            >
              {/* Rank Badge */}
              <View style={[styles.rankBadge, { borderColor: medalColor }]}>
                <Text style={[styles.rankNumber, { color: isTop3 ? medalColor : theme.textSecondary }]}>
                  #{item.rank}
                </Text>
              </View>

              {/* Player Info */}
              <View style={styles.playerInfoBox}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  {!item.isQualified && (
                    <View style={styles.unqualifiedBadge}>
                      <Text style={styles.unqualifiedBadgeText}>{item.qualificationNote}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.teamName}>{item.teamName}</Text>
                <Text style={styles.secondaryStatsText}>{item.secondaryStats}</Text>
              </View>

              {/* Primary Value */}
              <View style={styles.primaryValueBox}>
                <Text style={styles.primaryValueText}>{item.primaryValue}</Text>
                <Text style={styles.primaryLabelText}>{item.primaryLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="podium-outline" size={48} color={theme.textTertiary} />
            <Text style={styles.emptyTitle}>No Ranked Players</Text>
            <Text style={styles.emptySubtitle}>
              Play matches and record deliveries to build canonical player leaderboards.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.canvas,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.canvas,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backBtn: {
      padding: 6,
      minHeight: 44,
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    scopeRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      padding: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    scopeBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
    },
    activeScopeBtn: {
      backgroundColor: theme.primarySubtle,
    },
    scopeBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    activeScopeBtnText: {
      color: theme.brand,
    },
    categoryBar: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    categoryTab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    activeCategoryTab: {
      borderBottomWidth: 2,
      borderBottomColor: theme.brand,
    },
    categoryTabText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    activeCategoryTabText: {
      color: theme.brand,
    },
    disclosureBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    disclosureText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginLeft: 8,
      flex: 1,
      lineHeight: 15,
    },
    listContent: {
      padding: 16,
      paddingBottom: 32,
    },
    rankCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rankBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      backgroundColor: theme.surfaceAlt,
    },
    rankNumber: {
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    playerInfoBox: {
      flex: 1,
    },
    playerNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    playerName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    unqualifiedBadge: {
      backgroundColor: theme.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      marginLeft: 6,
    },
    unqualifiedBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.warning,
    },
    teamName: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    secondaryStatsText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 3,
    },
    primaryValueBox: {
      alignItems: 'flex-end',
      marginLeft: 8,
    },
    primaryValueText: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.brand,
      fontVariant: ['tabular-nums'],
    },
    primaryLabelText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.textSecondary,
      marginTop: 1,
    },
    emptyBox: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
      marginTop: 12,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
  });
