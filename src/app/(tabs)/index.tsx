import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Match } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { Badge } from '../../components/common/Badge';

export default function MatchesScreen() {
  const { matches, refreshMatches, tournaments, refreshTournaments, userProfile } = useCricket();
  const [filter, setFilter] = useState<'all' | 'live' | 'completed'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshMatches(), refreshTournaments()]);
    setRefreshing(false);
  };

  const filteredMatches = matches.filter((m) => {
    if (filter === 'live') return m.status === 'live' || m.status === 'innings_break';
    if (filter === 'completed') return m.status === 'completed';
    return true;
  });

  const liveMatch = matches.find((m) => m.status === 'live' || m.status === 'innings_break');

  const renderMatchCard = ({ item }: { item: Match }) => {
    const inn1 = item.innings[0];
    const inn2 = item.innings[1];

    const team1BattingFirst =
      (item.tossWinnerId === item.team1.id && item.tossDecision === 'bat') ||
      (item.tossWinnerId === item.team2.id && item.tossDecision === 'bowl');

    const firstTeam = team1BattingFirst ? item.team1 : item.team2;
    const secondTeam = team1BattingFirst ? item.team2 : item.team1;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.card}
        onPress={() => router.push(`/match/${item.id}`)}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.venueText} numberOfLines={1}>
            {item.venue} • {item.format.toUpperCase()} ({item.rules.totalOvers} ov)
          </Text>
          <View style={styles.badgeRow}>
            {item.ballType && (
              <View style={styles.ballTag}>
                <Text style={styles.ballTagText}>{item.ballType.toUpperCase()}</Text>
              </View>
            )}
            <Badge
              label={item.status === 'live' ? 'LIVE' : item.status === 'completed' ? 'FINAL' : 'BREAK'}
              variant={item.status === 'live' ? 'live' : item.status === 'completed' ? 'completed' : 'break'}
              size="sm"
            />
            <Badge
              label={item.isSynced ? 'Synced' : 'Local'}
              variant={item.isSynced ? 'synced' : 'local'}
              size="sm"
              style={{ marginLeft: 6 }}
            />
          </View>
        </View>

        {/* Teams and Scores */}
        <View style={styles.teamsSection}>
          {/* Innings 1 Team */}
          <View style={styles.teamScoreRow}>
            <View style={styles.teamNameBox}>
              <View style={[styles.teamColorBar, { backgroundColor: firstTeam.primaryColor }]} />
              <Text style={styles.teamName}>{firstTeam.name}</Text>
            </View>
            <Text style={styles.scoreText}>
              {inn1 ? `${inn1.totalRuns}/${inn1.totalWickets} (${inn1.oversFormatted})` : 'Yet to bat'}
            </Text>
          </View>

          {/* Innings 2 Team */}
          <View style={[styles.teamScoreRow, { marginTop: 6 }]}>
            <View style={styles.teamNameBox}>
              <View style={[styles.teamColorBar, { backgroundColor: secondTeam.primaryColor }]} />
              <Text style={styles.teamName}>{secondTeam.name}</Text>
            </View>
            <Text style={styles.scoreText}>
              {inn2
                ? `${inn2.totalRuns}/${inn2.totalWickets} (${inn2.oversFormatted})`
                : item.status === 'live' && inn1
                ? `Target: ${inn1.totalRuns + 1}`
                : 'Yet to bat'}
            </Text>
          </View>
        </View>

        {/* Result or Live Status */}
        <View style={styles.cardFooter}>
          <Text style={styles.resultText} numberOfLines={1}>
            {item.result ||
              (item.status === 'live'
                ? `Innings ${item.currentInningsIndex + 1} in progress`
                : 'Innings Break')}
          </Text>

          {item.status !== 'completed' && (
            <TouchableOpacity
              style={styles.scoreActionBtn}
              onPress={() => router.push(`/match/${item.id}/scorer`)}
            >
              <Ionicons name="flash" size={14} color="#FFF" />
              <Text style={styles.scoreActionText}>Score</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Current Persona Bar */}
      <View style={styles.userPerspectiveBar}>
        <View style={styles.perspectiveInfo}>
          <Text style={styles.perspectiveLabel}>Current Perspective:</Text>
          <Text style={styles.perspectiveName}>
            {userProfile?.name || 'Guest User'} ({userProfile?.role ? userProfile.role.toUpperCase() : 'PLAYER'})
          </Text>
        </View>
        <TouchableOpacity
          style={styles.switchPersonaBtn}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.switchPersonaText}>Switch User</Text>
        </TouchableOpacity>
      </View>

      {/* Offline Status & Quick Resume Header */}
      {liveMatch && (
        <View style={styles.liveBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.liveBannerTitle}>⚡ Ongoing Match Available</Text>
            <Text style={styles.liveBannerSubtitle}>
              {liveMatch.team1.shortName} vs {liveMatch.team2.shortName} — Resume ball-by-ball scoring
            </Text>
          </View>
          <TouchableOpacity
            style={styles.resumeBtn}
            onPress={() => router.push(`/match/${liveMatch.id}/scorer`)}
          >
            <Text style={styles.resumeBtnText}>Resume</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tournaments Hub Section */}
      <View style={styles.tournamentsSection}>
        <View style={styles.tournamentsSectionHeader}>
          <View style={styles.tournTitleRow}>
            <Ionicons name="trophy" size={16} color="#EAB308" />
            <Text style={styles.tournamentsSectionTitle}>Tournaments & Leagues</Text>
            {tournaments.length > 0 && (
              <View style={styles.tournCountBadge}>
                <Text style={styles.tournCountText}>{tournaments.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.createTournSmallBtn}
            onPress={() => router.push('/tournaments/create')}
          >
            <Ionicons name="add" size={14} color="#FFF" />
            <Text style={styles.createTournSmallBtnText}>Organize</Text>
          </TouchableOpacity>
        </View>

        {tournaments.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyTournCard}
            onPress={() => router.push('/tournaments/create')}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTournTitle}>Organize a Grassroots League</Text>
              <Text style={styles.emptyTournSubtitle}>
                Dynamic Points Table, NRR calculation & Fantasy MVP leaderboards
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tournScroll}
          >
            {tournaments.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.tournCard}
                onPress={() => router.push(`/tournament/${t.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.tournCardTop}>
                  <Text style={styles.tournName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: t.status === 'active' ? '#10B981' : '#F59E0B' },
                    ]}
                  />
                </View>
                <Text style={styles.tournFormat}>
                  {t.format.toUpperCase()} • {t.totalOvers} ov • {t.ballType.replace('_', ' ').toUpperCase()}
                </Text>
                <View style={styles.tournCardBottom}>
                  <Text style={styles.tournMeta}>
                    {t.teams.length} Teams • {t.matches.length} Matches
                  </Text>
                  <Ionicons name="arrow-forward" size={13} color="#00E676" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'live', 'completed'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterChip, filter === tab && styles.filterChipActive]}
            onPress={() => setFilter(tab)}
          >
            <Text
              style={[
                styles.filterText,
                filter === tab && styles.filterTextActive,
              ]}
            >
              {tab === 'all' ? 'All Matches' : tab === 'live' ? 'Live & Active' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Matches List */}
      <FlatList
        data={filteredMatches}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="baseball-outline" size={54} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptySubtitle}>
              Tap the "+ Start Match" tab below to create your first game.
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
    backgroundColor: Colors.background,
  },
  userPerspectiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  perspectiveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  perspectiveLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  perspectiveName: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  switchPersonaBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  switchPersonaText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  liveBanner: {
    backgroundColor: Colors.darkCard,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  liveBannerTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveBannerSubtitle: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
  },
  resumeBtn: {
    backgroundColor: Colors.accentAmber,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  resumeBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 13,
  },
  tournamentsSection: {
    marginTop: 12,
    marginHorizontal: 16,
  },
  tournamentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tournTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tournamentsSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  tournCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tournCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  createTournSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  createTournSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyTournCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
  },
  emptyTournTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyTournSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  tournScroll: {
    gap: 10,
    paddingRight: 16,
  },
  tournCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tournCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tournName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tournFormat: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  tournCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  tournMeta: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  venueText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ballTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  ballTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  teamsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  teamScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamNameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamColorBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  resultText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
    flex: 1,
  },
  scoreActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
    marginLeft: 8,
  },
  scoreActionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 32,
  },
});
