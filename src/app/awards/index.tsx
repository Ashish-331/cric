import React, { useState } from 'react';
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
          <Ionicons name="arrow-back" size={24} color="#FFF" />
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
                size={24}
                color={item.category === 'potm' ? '#FFD700' : '#00E676'}
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
            <Ionicons name="medal-outline" size={48} color="#475569" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#070D1E',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#0C142B',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1E2C4F',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterTextActive: {
    color: '#00E676',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  awardCard: {
    flexDirection: 'row',
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  awardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#070D1E',
    borderWidth: 1,
    borderColor: '#1E2C4F',
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
    fontSize: 14,
    fontWeight: '800',
    color: '#FFB300',
  },
  recipientNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  matchTitleText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  basisText: {
    fontSize: 12,
    color: '#E2E8F0',
    marginTop: 4,
    fontWeight: '600',
  },
  auditRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#121C38',
  },
  auditText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
});
