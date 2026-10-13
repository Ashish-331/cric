import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Match } from '../../types/cricket';
import { useTheme } from '../../theme/useTheme';
import { Badge } from '../../components/common/Badge';
import { MatchCard } from '../../components/common/MatchCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PlayerPerformanceService } from '../../services/playerPerformanceService';
import { NavigationDrawerModal } from '../../components/navigation/NavigationDrawerModal';

export default function MatchesScreen() {
  const { matches, refreshMatches, tournaments, refreshTournaments, userProfile, teams } = useCricket();
  const { theme } = useTheme();

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

  // Resolve current player's live performance across ongoing authorized matches
  const myLiveFigure = userProfile?.id
    ? PlayerPerformanceService.getLiveFiguresForPlayer(
        userProfile.claimedPlayerId || userProfile.id,
        authorizedMatches
      )
    : null;

  const renderMatchCard = ({ item }: { item: Match }) => {
    const isAuthorizedScorer =
      userProfile?.role === 'scorer' ||
      item.scorerPlayerId === userProfile?.id ||
      (!item.tournamentId && !item.isSynced);

    return (
      <MatchCard
        match={item}
        onPress={() => router.push(`/match/${item.id}`)}
        isAuthorizedScorer={isAuthorizedScorer}
        onScore={() => router.push(`/match/${item.id}/scorer`)}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Top App Bar with Navigation Drawer Toggle, Title, Search, Inbox, Notifications */}
      <View style={[styles.appHeaderBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.drawerToggleBtn} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.appHeaderTitle, { color: theme.brand }]}>Cric</Text>
          <Text style={[styles.appHeaderSubtitle, { color: theme.textSecondary }]}>Grassroots Scorebook</Text>
        </View>
        <View style={styles.headerIconsRow}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/search')}>
            <Ionicons name="search-outline" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/inbox')}>
            <Ionicons name="mail-outline" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Account Perspective Bar */}
      <View style={[styles.userPerspectiveBar, { backgroundColor: theme.raised, borderBottomColor: theme.borderSubdued }]}>
        <View style={styles.perspectiveInfo}>
          <Text style={[styles.perspectiveLabel, { color: theme.textSecondary }]}>Account:</Text>
          <Text style={[styles.perspectiveName, { color: theme.textPrimary }]} numberOfLines={1}>
            {userProfile?.name || 'Guest User'}
          </Text>
          <View style={[styles.roleChip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.roleChipText, { color: theme.textSecondary }]}>
              {userProfile?.role ? userProfile.role.toUpperCase() : 'SCORER'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.switchPersonaBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push('/settings')}
        >
          <Text style={[styles.switchPersonaText, { color: theme.textPrimary }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* My Live Performance Card */}
      {myLiveFigure && (
        <TouchableOpacity
          style={[styles.myLiveCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push(`/match/${myLiveFigure.matchId}`)}
          activeOpacity={0.85}
        >
          <View style={styles.myLiveHeaderRow}>
            <View style={[styles.liveDot, { backgroundColor: theme.statusLive }]} />
            <Text style={[styles.myLiveHeaderTitle, { color: theme.textPrimary }]}>YOUR LIVE STATUS</Text>
            <View style={{ flex: 1 }} />
            <Badge
              label={myLiveFigure.isCloudSynced ? 'Synced' : 'Local'}
              variant={myLiveFigure.isCloudSynced ? 'synced' : 'local'}
              size="sm"
            />
          </View>

          <Text style={[styles.myLiveMatchTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {myLiveFigure.matchTitle} • {myLiveFigure.battingTeamName} {myLiveFigure.totalTeamScore}
          </Text>

          <View style={styles.myLiveStatsRow}>
            {myLiveFigure.batting && (
              <View style={[styles.myLiveStatBox, { backgroundColor: theme.raised, borderColor: theme.borderSubdued }]}>
                <Text style={[styles.myLiveStatLabel, { color: theme.textSecondary }]}>
                  Batting {myLiveFigure.batting.isOnStrike ? '🏏 (Strike)' : myLiveFigure.batting.isNonStriker ? '(Non-Strike)' : ''}
                </Text>
                <Text style={[styles.myLiveStatScore, { color: theme.textPrimary }]}>
                  {myLiveFigure.batting.runs}* ({myLiveFigure.batting.ballsFaced}b)
                </Text>
                <Text style={[styles.myLiveStatSub, { color: theme.textSecondary }]}>
                  SR: {myLiveFigure.batting.strikeRate.toFixed(1)} • {myLiveFigure.batting.fours}x4 • {myLiveFigure.batting.sixes}x6
                </Text>
              </View>
            )}

            {myLiveFigure.bowling && (
              <View style={[styles.myLiveStatBox, { backgroundColor: theme.raised, borderColor: theme.borderSubdued }]}>
                <Text style={[styles.myLiveStatLabel, { color: theme.textSecondary }]}>
                  Bowling {myLiveFigure.bowling.isCurrentBowler ? '🎯 (Bowling)' : ''}
                </Text>
                <Text style={[styles.myLiveStatScore, { color: theme.textPrimary }]}>
                  {myLiveFigure.bowling.wickets}/{myLiveFigure.bowling.runsConceded} ({myLiveFigure.bowling.oversFormatted} ov)
                </Text>
                <Text style={[styles.myLiveStatSub, { color: theme.textSecondary }]}>
                  Econ: {myLiveFigure.bowling.economy.toFixed(1)} • {myLiveFigure.bowling.maidens}m
                </Text>
              </View>
            )}
          </View>

          {myLiveFigure.isDelayed && (
            <View style={[styles.delayedScoreNotice, { backgroundColor: theme.statusWarningBg }]}>
              <Ionicons name="time-outline" size={13} color={theme.statusWarning} />
              <Text style={[styles.delayedScoreNoticeText, { color: theme.statusWarning }]}>
                Scorer recording offline. Showing last synchronized cloud update.
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Scorer Quick Resume Header (Authorized Scorers) */}
      {liveMatch && (userProfile?.role === 'scorer' || liveMatch.scorerPlayerId === userProfile?.id) && (
        <View style={[styles.liveBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.liveBannerTitle, { color: theme.brand }]}>Live Match Scoring in Progress</Text>
            <Text style={[styles.liveBannerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {liveMatch.team1.shortName} vs {liveMatch.team2.shortName} • {liveMatch.venue}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.resumeBtn, { backgroundColor: theme.brand }]}
            onPress={() => router.push(`/match/${liveMatch.id}/scorer`)}
          >
            <Ionicons name="create-outline" size={14} color={theme.brandText} />
            <Text style={[styles.resumeBtnText, { color: theme.brandText }]}>Resume</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tournaments Hub Section */}
      <View style={styles.tournamentsSection}>
        <View style={styles.tournamentsSectionHeader}>
          <View style={styles.tournTitleRow}>
            <Ionicons name="trophy-outline" size={15} color={theme.textPrimary} />
            <Text style={[styles.tournamentsSectionTitle, { color: theme.textPrimary }]}>Tournaments</Text>
            {tournaments.length > 0 && (
              <View style={[styles.tournCountBadge, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                <Text style={[styles.tournCountText, { color: theme.textSecondary }]}>{tournaments.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.createTournSmallBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/tournaments/create')}
          >
            <Ionicons name="add" size={13} color={theme.textPrimary} />
            <Text style={[styles.createTournSmallBtnText, { color: theme.textPrimary }]}>Organize</Text>
          </TouchableOpacity>
        </View>

        {tournaments.length === 0 ? (
          <TouchableOpacity
            style={[styles.emptyTournCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/tournaments/create')}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.emptyTournTitle, { color: theme.textPrimary }]}>Organize a Tournament</Text>
              <Text style={[styles.emptyTournSubtitle, { color: theme.textSecondary }]}>
                Dynamic points table, NRR calculation & Fantasy MVP leaderboards
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
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
                style={[styles.tournCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push(`/tournament/${t.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.tournCardTop}>
                  <Text style={[styles.tournName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: t.status === 'active' ? theme.brand : theme.statusBreak },
                    ]}
                  />
                </View>
                <Text style={[styles.tournFormat, { color: theme.textSecondary }]}>
                  {t.format.toUpperCase()} • {t.totalOvers} ov • {t.ballType.replace('_', ' ').toUpperCase()}
                </Text>
                <View style={[styles.tournCardBottom, { borderTopColor: theme.borderSubdued }]}>
                  <Text style={[styles.tournMeta, { color: theme.textSecondary }]}>
                    {t.teams.length} Teams • {t.matches.length} Matches
                  </Text>
                  <Ionicons name="arrow-forward" size={13} color={theme.brand} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'live', 'completed'] as const).map((tab) => {
          const isActive = filter === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? theme.brand : theme.surface,
                  borderColor: isActive ? theme.brand : theme.border,
                },
              ]}
              onPress={() => setFilter(tab)}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: isActive ? theme.brandText : theme.textSecondary,
                  },
                ]}
              >
                {tab === 'all' ? 'All Matches' : tab === 'live' ? 'Live & Active' : 'Completed'}
              </Text>
            </TouchableOpacity>
          );
        })}
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
          <EmptyState
            icon="baseball-outline"
            title="No matches found"
            description="Matches you organize, score, or play in will appear here. Tap below to set up a new match."
            actionTitle="Setup New Match"
            onAction={() => router.push('/(tabs)/new-match')}
          />
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
  },
  appHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  drawerToggleBtn: {
    padding: 6,
  },
  titleContainer: {
    alignItems: 'center',
  },
  appHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  appHeaderSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: -2,
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  userPerspectiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  perspectiveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  perspectiveLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  perspectiveName: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 120,
  },
  roleChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  roleChipText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  switchPersonaBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  switchPersonaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  myLiveCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  myLiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  myLiveHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  myLiveMatchTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  myLiveStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  myLiveStatBox: {
    flex: 1,
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
  },
  myLiveStatLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  myLiveStatScore: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  myLiveStatSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  delayedScoreNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
    gap: 6,
  },
  delayedScoreNoticeText: {
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
  liveBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  liveBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  liveBannerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  resumeBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  tournamentsSection: {
    marginTop: 10,
    marginHorizontal: 16,
  },
  tournamentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tournTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tournamentsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tournCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
  },
  tournCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  createTournSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    gap: 2,
  },
  createTournSmallBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyTournCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
  },
  emptyTournTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTournSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  tournScroll: {
    gap: 8,
    paddingRight: 16,
  },
  tournCard: {
    width: 200,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
  },
  tournCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tournName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tournFormat: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 6,
  },
  tournCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 4,
  },
  tournMeta: {
    fontSize: 10,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
});
