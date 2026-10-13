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

import { PlayerPerformanceService } from '../../services/playerPerformanceService';
import { NavigationDrawerModal } from '../../components/navigation/NavigationDrawerModal';

export default function MatchesScreen() {
  const { matches, refreshMatches, tournaments, refreshTournaments, userProfile, teams } = useCricket();
  const [filter, setFilter] = useState<'all' | 'live' | 'completed'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshMatches(), refreshTournaments()]);
    setRefreshing(false);
  };

  const authorizedMatches = userProfile?.id
    ? PlayerPerformanceService.getFilteredMatchesForUser(
        userProfile.id,
        'all',
        matches,
        teams,
        tournaments,
        userProfile.claimedPlayerId ? [userProfile.claimedPlayerId] : []
      )
    : [];

  const filteredMatches = authorizedMatches.filter((m) => {
    if (filter === 'live') return m.status === 'live' || m.status === 'innings_break';
    if (filter === 'completed') return m.status === 'completed';
    return true;
  });

  const liveMatch = authorizedMatches.find((m) => m.status === 'live' || m.status === 'innings_break');

  // Stage 3: Resolve current player's live performance across ongoing authorized matches
  const myLiveFigure = userProfile?.id
    ? PlayerPerformanceService.getLiveFiguresForPlayer(
        userProfile.claimedPlayerId || userProfile.id,
        authorizedMatches
      )
    : null;

  const renderMatchCard = ({ item }: { item: Match }) => {
    const inn1 = item.innings[0];
    const inn2 = item.innings[1];

    const team1BattingFirst =
      (item.tossWinnerId === item.team1.id && item.tossDecision === 'bat') ||
      (item.tossWinnerId === item.team2.id && item.tossDecision === 'bowl');

    const firstTeam = team1BattingFirst ? item.team1 : item.team2;
    const secondTeam = team1BattingFirst ? item.team2 : item.team1;

    // Scorer permission boundary check
    const isAuthorizedScorer =
      userProfile?.role === 'scorer' ||
      item.scorerPlayerId === userProfile?.id ||
      (!item.tournamentId && !item.isSynced);

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

        {/* Deep Action Links: Insights, Table, Leaderboard */}
        <View style={styles.deepActionLinksRow}>
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => router.push(`/match/${item.id}`)}
          >
            <Ionicons name="stats-chart" size={12} color="#00E5FF" />
            <Text style={styles.actionChipText}>Insights</Text>
          </TouchableOpacity>

          {item.tournamentId && (
            <>
              <TouchableOpacity
                style={styles.actionChip}
                onPress={() => router.push(`/tournament/${item.tournamentId}`)}
              >
                <Ionicons name="grid-outline" size={12} color="#00E676" />
                <Text style={styles.actionChipText}>Table</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionChip}
                onPress={() => router.push('/leaderboards')}
              >
                <Ionicons name="podium-outline" size={12} color="#FFB300" />
                <Text style={styles.actionChipText}>Leaderboard</Text>
              </TouchableOpacity>
            </>
          )}

          {item.status !== 'completed' && (
            isAuthorizedScorer ? (
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: '#0284C7', marginLeft: 'auto' }]}
                onPress={() => router.push(`/match/${item.id}/scorer`)}
              >
                <Ionicons name="flash" size={12} color="#FFF" />
                <Text style={[styles.actionChipText, { color: '#FFF' }]}>Score</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: '#1E2C4F', marginLeft: 'auto' }]}
                onPress={() => router.push(`/match/${item.id}`)}
              >
                <Ionicons name="eye" size={12} color="#FFF" />
                <Text style={[styles.actionChipText, { color: '#FFF' }]}>Follow</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top App Bar with Navigation Drawer Toggle, Search, Inbox, Notifications */}
      <View style={styles.appHeaderBar}>
        <TouchableOpacity style={styles.drawerToggleBtn} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.appHeaderTitle}>CRIC</Text>
        <View style={styles.headerIconsRow}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/search')}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/inbox')}>
            <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

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

      {/* Stage 3: My Live Performance Card */}
      {myLiveFigure && (
        <TouchableOpacity
          style={styles.myLiveCard}
          onPress={() => router.push(`/match/${myLiveFigure.matchId}`)}
          activeOpacity={0.88}
        >
          <View style={styles.myLiveHeaderRow}>
            <View style={styles.myLivePulseDot} />
            <Text style={styles.myLiveHeaderTitle}>MY LIVE PERFORMANCE</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.myLiveBadgeText}>{myLiveFigure.isCloudSynced ? 'CLOUD LIVE' : 'PROVISIONAL'}</Text>
          </View>

          <Text style={styles.myLiveMatchTitle} numberOfLines={1}>
            {myLiveFigure.matchTitle} • {myLiveFigure.battingTeamName} {myLiveFigure.totalTeamScore}
          </Text>

          <View style={styles.myLiveStatsRow}>
            {myLiveFigure.batting && (
              <View style={styles.myLiveStatBox}>
                <Text style={styles.myLiveStatLabel}>
                  Batting {myLiveFigure.batting.isOnStrike ? '🏏 (Strike)' : myLiveFigure.batting.isNonStriker ? '(Non-Strike)' : ''}
                </Text>
                <Text style={styles.myLiveStatScore}>
                  {myLiveFigure.batting.runs}* ({myLiveFigure.batting.ballsFaced}b)
                </Text>
                <Text style={styles.myLiveStatSub}>
                  SR: {myLiveFigure.batting.strikeRate.toFixed(1)} • {myLiveFigure.batting.fours}x4 • {myLiveFigure.batting.sixes}x6
                </Text>
              </View>
            )}

            {myLiveFigure.bowling && (
              <View style={styles.myLiveStatBox}>
                <Text style={styles.myLiveStatLabel}>
                  Bowling {myLiveFigure.bowling.isCurrentBowler ? '🎯 (Bowling)' : ''}
                </Text>
                <Text style={styles.myLiveStatScore}>
                  {myLiveFigure.bowling.wickets}/{myLiveFigure.bowling.runsConceded} ({myLiveFigure.bowling.oversFormatted} ov)
                </Text>
                <Text style={styles.myLiveStatSub}>
                  Econ: {myLiveFigure.bowling.economy.toFixed(1)} • {myLiveFigure.bowling.maidens} maidens
                </Text>
              </View>
            )}
          </View>

          {myLiveFigure.isDelayed && (
            <View style={styles.delayedScoreNotice}>
              <Ionicons name="time-outline" size={13} color="#F59E0B" />
              <Text style={styles.delayedScoreNoticeText}>
                Scorer recording offline. Showing last synchronized cloud update.
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Scorer Quick Resume Header (Shown only to authorized scorers) */}
      {liveMatch && (userProfile?.role === 'scorer' || liveMatch.scorerPlayerId === userProfile?.id) && (
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

      {/* Navigation Drawer Modal */}
      <NavigationDrawerModal
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  appHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#070D1E',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  drawerToggleBtn: {
    padding: 6,
  },
  appHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#00E676',
    letterSpacing: 1.5,
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: 6,
    marginLeft: 8,
  },
  deepActionLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E2C4F',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C142B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
    marginLeft: 4,
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
  myLiveCard: {
    backgroundColor: '#0F172A',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  myLiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  myLivePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  myLiveHeaderTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  myLiveBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myLiveMatchTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  myLiveStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  myLiveStatBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  myLiveStatLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  myLiveStatScore: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  myLiveStatSub: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  delayedScoreNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 10,
    gap: 6,
  },
  delayedScoreNoticeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
});
