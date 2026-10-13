import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Badge } from '../../components/common/Badge';
import { useTheme } from '../../theme';
import { ThemeColors } from '../../theme/tokens';

interface AwardItem {
  id: string;
  awardName: string;
  category: 'potm' | 'milestone' | 'mvp' | 'manual';
  recipientName: string;
  matchOrTournTitle: string;
  date: string;
  basis: string;
  formulaVersion?: string;
  issuerName?: string;
  isApproved: boolean;
}

export default function AwardsScreen() {
  const { theme, colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { matches, tournaments, teams } = useCricket();
  const [filter, setFilter] = useState<'all' | 'milestones' | 'potm' | 'mvp'>('all');

  // Derive awards from completed matches & player milestones
  const awardsList: AwardItem[] = React.useMemo(() => {
    const list: AwardItem[] = [];

    // 1. POTM from completed matches
    for (const match of matches) {
      if (match.status === 'completed') {
        // Find best batter and best bowler
        let topBatter = { name: '', runs: 0 };
        let topBowler = { name: '', wickets: 0 };

        for (const inn of match.innings) {
          if (!inn) continue;
          for (const pId of Object.keys(inn.batterStats || {})) {
            const b = inn.batterStats[pId];
            if (b && b.runs > topBatter.runs) {
              const p = match.team1.players.concat(match.team2.players).find((pl) => pl.id === pId);
              topBatter = { name: p?.name || 'Top Batter', runs: b.runs };
            }
          }
          for (const pId of Object.keys(inn.bowlerStats || {})) {
            const b = inn.bowlerStats[pId];
            if (b && b.wickets > topBowler.wickets) {
              const p = match.team1.players.concat(match.team2.players).find((pl) => pl.id === pId);
              topBowler = { name: p?.name || 'Top Bowler', wickets: b.wickets };
            }
          }
        }

        const potmName = topBatter.runs >= 40 ? topBatter.name : topBowler.name || topBatter.name || 'Star Player';
        const basis = topBatter.runs >= 40
          ? `Top score: ${topBatter.runs} runs in match`
          : topBowler.wickets > 0
          ? `Key bowling: ${topBowler.wickets} wickets in match`
          : 'Outstanding match contribution';

        list.push({
          id: `potm_${match.id}`,
          awardName: 'Player of the Match',
          category: 'potm',
          recipientName: potmName,
          matchOrTournTitle: match.title,
          date: match.date || 'Recent Match',
          basis,
          formulaVersion: 'v1.2-potm-impact',
          isApproved: match.approvalStatus === 'approved',
        });
      }
    }

    // 2. Milestones from player career statistics (50s, 100s, 5-wicket hauls)
    for (const team of teams) {
      for (const p of team.players) {
        if (p.careerStats?.hundreds && p.careerStats.hundreds > 0) {
          list.push({
            id: `cen_${p.id}`,
            awardName: 'Century Club 💯',
            category: 'milestone',
            recipientName: p.name,
            matchOrTournTitle: `${team.name} Career`,
            date: 'Career Milestone',
            basis: `${p.careerStats.hundreds} Century scored in official matches`,
            formulaVersion: 'v1.0-milestone',
            isApproved: true,
          });
        }
        if (p.careerStats?.fifties && p.careerStats.fifties > 0) {
          list.push({
            id: `half_${p.id}`,
            awardName: 'Half-Century Badge 🎖️',
            category: 'milestone',
            recipientName: p.name,
            matchOrTournTitle: `${team.name} Career`,
            date: 'Career Milestone',
            basis: `${p.careerStats.fifties} Half-centuries scored`,
            formulaVersion: 'v1.0-milestone',
            isApproved: true,
          });
        }
        if (p.careerStats?.wickets && p.careerStats.wickets >= 5) {
          list.push({
            id: `fifer_${p.id}`,
            awardName: 'Bowling Spearhead 🎳',
            category: 'milestone',
            recipientName: p.name,
            matchOrTournTitle: `${team.name} Career`,
            date: 'Career Milestone',
            basis: `${p.careerStats.wickets} Career wickets taken`,
            formulaVersion: 'v1.0-milestone',
            isApproved: true,
          });
        }
      }
    }

    return list;
  }, [matches, teams]);

  const filteredAwards = awardsList.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'potm') return a.category === 'potm';
    if (filter === 'milestones') return a.category === 'milestone';
    if (filter === 'mvp') return a.category === 'mvp';
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Awards & Honours</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'potm', 'milestones'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterChip, filter === tab && styles.filterChipActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab === 'all' ? 'All Honours' : tab === 'potm' ? 'Player of Match' : 'Milestone Badges'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredAwards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.awardCard}>
            <View style={styles.awardIconBox}>
              <Ionicons
                name={item.category === 'potm' ? 'trophy' : 'medal'}
                size={22}
                color={item.category === 'potm' ? '#D97706' : theme.brand}
              />
            </View>

            <View style={styles.awardInfoBox}>
              <View style={styles.awardHeaderRow}>
                <Text style={styles.awardNameText}>{item.awardName}</Text>
                <Badge
                  label={item.isApproved ? 'VERIFIED' : 'PROVISIONAL'}
                  variant={item.isApproved ? 'synced' : 'local'}
                  size="sm"
                />
              </View>

              <Text style={styles.recipientNameText}>{item.recipientName}</Text>
              <Text style={styles.matchTitleText}>{item.matchOrTournTitle}</Text>
              <Text style={styles.basisText}>Basis: {item.basis}</Text>

              {item.formulaVersion && (
                <View style={styles.auditRow}>
                  <Text style={styles.auditText}>Formula: {item.formulaVersion}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="medal-outline" size={48} color={theme.textTertiary} />
            <Text style={styles.emptyTitle}>No Awards Yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete official matches and hit scoring milestones to unlock community awards.
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
    filterRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      padding: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      marginRight: 8,
    },
    filterChipActive: {
      backgroundColor: theme.primarySubtle,
    },
    filterText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    filterTextActive: {
      color: theme.brand,
    },
    listContent: {
      padding: 16,
      paddingBottom: 32,
    },
    awardCard: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    awardIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    awardInfoBox: {
      flex: 1,
    },
    awardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    awardNameText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.brand,
    },
    recipientNameText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
      marginTop: 2,
    },
    matchTitleText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    basisText: {
      fontSize: 12,
      color: theme.textPrimary,
      marginTop: 4,
      fontWeight: '600',
    },
    auditRow: {
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    auditText: {
      fontSize: 10,
      color: theme.textSecondary,
      fontWeight: '600',
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
