import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Match, Team, Tournament } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { Badge } from '../../components/common/Badge';
import { PlayerPerformanceService } from '../../services/playerPerformanceService';
import { NavigationDrawerModal } from '../../components/navigation/NavigationDrawerModal';

type SubSection = 'matches' | 'tournaments' | 'teams' | 'stats' | 'highlights';
type MatchFilter = 'your' | 'played' | 'network' | 'all';

export default function MyCricketScreen() {
  const {
    matches,
    teams,
    tournaments,
    userProfile,
    refreshMatches,
    refreshTournaments,
  } = useCricket();

  const [activeSection, setActiveSection] = useState<SubSection>('matches');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('your');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshMatches(), refreshTournaments()]);
    setRefreshing(false);
  };

  const currentUserId = userProfile?.id || '';

  // Canonical filtering powered by PlayerPerformanceService
  const filteredMatches = PlayerPerformanceService.getFilteredMatchesForUser(
    currentUserId,
    matchFilter,
    matches,
    teams,
    tournaments
  );

  const userTeams = teams.filter(
    (t) =>
      t.captainPlayerId === currentUserId ||
      t.createdByUserId === currentUserId ||
      t.players?.some((p) => p.id === currentUserId || p.claimedByUserId === currentUserId)
  );

  const userTournaments = tournaments.filter(
    (tr) =>
      tr.creatorUserId === currentUserId ||
      tr.teams?.some((t) => userTeams.some((ut) => ut.id === t.id))
  );

  const renderMatchCard = ({ item }: { item: Match }) => {
    const inn1 = item.innings[0];
    const inn2 = item.innings[1];

    const team1BattingFirst =
      (item.tossWinnerId === item.team1.id && item.tossDecision === 'bat') ||
      (item.tossWinnerId === item.team2.id && item.tossDecision === 'bowl');

    const firstTeam = team1BattingFirst ? item.team1 : item.team2;
    const secondTeam = team1BattingFirst ? item.team2 : item.team1;

    const hasTournament = Boolean(item.tournamentId);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.matchCard}
        onPress={() => router.push(`/match/${item.id}`)}
      >
        {/* Header: Stage, Venue, Status */}
        <View style={styles.cardHeader}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.venueText} numberOfLines={1}>
              {item.venue} • {item.format.toUpperCase()} ({item.rules.totalOvers} ov)
            </Text>
            {item.ballType && (
              <View style={styles.ballTag}>
                <Text style={styles.ballTagText}>{item.ballType.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.badgeRow}>
            <Badge
              label={item.status === 'live' ? 'LIVE' : item.status === 'completed' ? 'FINAL' : 'SCHEDULED'}
              variant={item.status === 'live' ? 'live' : item.status === 'completed' ? 'completed' : 'break'}
              size="sm"
            />
            {item.approvalStatus && item.status === 'completed' && (
              <Badge
                label={item.approvalStatus.toUpperCase()}
                variant={item.approvalStatus === 'approved' ? 'synced' : 'local'}
                size="sm"
                style={{ marginLeft: 6 }}
              />
            )}
          </View>
        </View>

        {/* Teams and Scores */}
        <View style={styles.teamsBox}>
          <View style={styles.scoreRow}>
            <View style={styles.teamBadge}>
              <View style={[styles.colorDot, { backgroundColor: firstTeam.primaryColor }]} />
              <Text style={styles.teamNameText} numberOfLines={1}>
                {firstTeam.name}
              </Text>
            </View>
            <Text style={styles.scoreNum}>
              {inn1 ? `${inn1.totalRuns}/${inn1.totalWickets} (${inn1.oversFormatted})` : 'Yet to bat'}
            </Text>
          </View>

          <View style={[styles.scoreRow, { marginTop: 8 }]}>
            <View style={styles.teamBadge}>
              <View style={[styles.colorDot, { backgroundColor: secondTeam.primaryColor }]} />
              <Text style={styles.teamNameText} numberOfLines={1}>
                {secondTeam.name}
              </Text>
            </View>
            <Text style={styles.scoreNum}>
              {inn2
                ? `${inn2.totalRuns}/${inn2.totalWickets} (${inn2.oversFormatted})`
                : item.status === 'live' && inn1
                ? `Target: ${inn1.totalRuns + 1}`
                : 'Yet to bat'}
            </Text>
          </View>
        </View>

        {/* Result summary */}
        <View style={styles.resultBox}>
          <Text style={styles.resultSummaryText} numberOfLines={1}>
            {item.result ||
              (item.status === 'live'
                ? `Innings ${item.currentInningsIndex + 1} ongoing`
                : 'Scheduled match')}
          </Text>
        </View>

        {/* Deep Action Links: Insights, Table, Leaderboard */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => router.push(`/match/${item.id}`)}
          >
            <Ionicons name="stats-chart" size={13} color="#00E5FF" />
            <Text style={styles.actionChipText}>Insights</Text>
          </TouchableOpacity>

          {hasTournament && (
            <>
              <TouchableOpacity
                style={styles.actionChip}
                onPress={() => router.push(`/tournament/${item.tournamentId}`)}
              >
                <Ionicons name="grid-outline" size={13} color="#00E676" />
                <Text style={styles.actionChipText}>Table</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionChip}
                onPress={() => router.push('/leaderboards')}
              >
                <Ionicons name="podium-outline" size={13} color="#FFB300" />
                <Text style={styles.actionChipText}>Leaderboard</Text>
              </TouchableOpacity>
            </>
          )}

          {item.status !== 'completed' && (
            <TouchableOpacity
              style={styles.scoreChip}
              onPress={() => router.push(`/match/${item.id}/scorer`)}
            >
              <Ionicons name="flash" size={13} color="#FFF" />
              <Text style={styles.scoreChipText}>Score</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar matching reference */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>My Cricket</Text>
        <TouchableOpacity
          style={styles.startMatchBtn}
          onPress={() => router.push('/(tabs)/new-match')}
        >
          <Ionicons name="add" size={18} color="#070D1E" />
          <Text style={styles.startMatchBtnText}>Start Match</Text>
        </TouchableOpacity>
      </View>

      {/* 5 Sub-Section Navigation Tabs */}
      <View style={styles.subSectionBar}>
        {(['matches', 'tournaments', 'teams', 'stats', 'highlights'] as SubSection[]).map((section) => (
          <TouchableOpacity
            key={section}
            style={[
              styles.subSectionTab,
              activeSection === section && styles.activeSubSectionTab,
            ]}
            onPress={() => setActiveSection(section)}
          >
            <Text
              style={[
                styles.subSectionTabText,
                activeSection === section && styles.activeSubSectionTabText,
              ]}
            >
              {section.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub-Section 1: MATCHES */}
      {activeSection === 'matches' && (
        <View style={styles.sectionBody}>
          {/* Matches Filter Chips: Your | Played | Network | All */}
          <View style={styles.filterChipRow}>
            {(['your', 'played', 'network', 'all'] as MatchFilter[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  matchFilter === f && styles.activeFilterChip,
                ]}
                onPress={() => setMatchFilter(f)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    matchFilter === f && styles.activeFilterChipText,
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filteredMatches}
            keyExtractor={(item) => item.id}
            renderItem={renderMatchCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E676" />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="tennisball-outline" size={48} color="#475569" />
                <Text style={styles.emptyTitle}>No {matchFilter} matches found</Text>
                <Text style={styles.emptySubtitle}>
                  {matchFilter === 'your'
                    ? 'Matches you organize or score will appear here.'
                    : matchFilter === 'played'
                    ? 'Matches where your player identity participates will appear here.'
                    : matchFilter === 'network'
                    ? 'Matches within your clubs and entered tournaments.'
                    : 'No public matches found.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => router.push('/(tabs)/new-match')}
                >
                  <Text style={styles.emptyActionBtnText}>Organize a Match</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      )}

      {/* Sub-Section 2: TOURNAMENTS */}
      {activeSection === 'tournaments' && (
        <ScrollView
          style={styles.sectionBody}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E676" />
          }
        >
          <View style={styles.subHeaderRow}>
            <Text style={styles.subSectionHeaderTitle}>Your Series & Leagues ({userTournaments.length})</Text>
            <TouchableOpacity
              style={styles.addSmallBtn}
              onPress={() => router.push('/tournaments/create')}
            >
              <Ionicons name="add" size={14} color="#FFF" />
              <Text style={styles.addSmallBtnText}>Create Series</Text>
            </TouchableOpacity>
          </View>

          {userTournaments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={48} color="#475569" />
              <Text style={styles.emptyTitle}>No Tournaments Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create or register your team into community cricket leagues.
              </Text>
            </View>
          ) : (
            userTournaments.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.matchCard}
                onPress={() => router.push(`/tournament/${t.id}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.venueText}>{t.format.toUpperCase()} • {t.totalOvers} Overs</Text>
                  <Badge label={t.status.toUpperCase()} variant="synced" size="sm" />
                </View>
                <Text style={styles.tournNameText}>{t.name}</Text>
                <Text style={styles.tournDetailText}>
                  {t.teams.length} Teams registered • {t.matches.length} Fixtures
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Sub-Section 3: TEAMS */}
      {activeSection === 'teams' && (
        <ScrollView
          style={styles.sectionBody}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E676" />
          }
        >
          <View style={styles.subHeaderRow}>
            <Text style={styles.subSectionHeaderTitle}>Your Registered Teams ({userTeams.length})</Text>
            <TouchableOpacity
              style={styles.addSmallBtn}
              onPress={() => router.push('/(tabs)/teams')}
            >
              <Ionicons name="add" size={14} color="#FFF" />
              <Text style={styles.addSmallBtnText}>Manage Teams</Text>
            </TouchableOpacity>
          </View>

          {userTeams.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#475569" />
              <Text style={styles.emptyTitle}>No Teams Associated</Text>
              <Text style={styles.emptySubtitle}>
                Join a club or create your own cricket team.
              </Text>
            </View>
          ) : (
            userTeams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={styles.matchCard}
                onPress={() => router.push(`/teams/${team.id}`)}
              >
                <View style={styles.teamCardRow}>
                  <View style={[styles.teamAvatar, { backgroundColor: team.primaryColor }]}>
                    <Text style={styles.teamAvatarText}>{team.shortName}</Text>
                  </View>
                  <View style={styles.teamCardInfo}>
                    <Text style={styles.teamCardTitle}>{team.name}</Text>
                    <Text style={styles.teamCardSub}>{team.players.length} Players on roster</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Sub-Section 4: STATS */}
      {activeSection === 'stats' && (
        <ScrollView style={styles.sectionBody} contentContainerStyle={styles.listContent}>
          <View style={styles.statsPromoCard}>
            <Ionicons name="analytics" size={40} color="#00E676" />
            <Text style={styles.statsPromoTitle}>Player Career Figures</Text>
            <Text style={styles.statsPromoSubtitle}>
              View your canonical batting, bowling, wagon wheel shot charts, and personal milestones.
            </Text>
            <TouchableOpacity
              style={styles.statsActionBtn}
              onPress={() => router.push('/performance')}
            >
              <Text style={styles.statsActionBtnText}>Open My Performance</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Sub-Section 5: HIGHLIGHTS */}
      {activeSection === 'highlights' && (
        <ScrollView style={styles.sectionBody} contentContainerStyle={styles.listContent}>
          <View style={styles.statsPromoCard}>
            <Ionicons name="film-outline" size={40} color="#00E5FF" />
            <Text style={styles.statsPromoTitle}>Key Event Timeline & Highlights</Text>
            <Text style={styles.statsPromoSubtitle}>
              Timeline of key match dismissals, boundary streaks, and certified milestones derived from authoritative ball-by-ball actions.
            </Text>
            <View style={styles.highlightNoticeBox}>
              <Ionicons name="information-circle-outline" size={18} color="#FFB300" />
              <Text style={styles.highlightNoticeText}>
                Free score-based highlights are active. Live video stream transport is gated by provider configuration.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

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
    backgroundColor: '#070D1E',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#070D1E',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  menuBtn: {
    padding: 6,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  startMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E676',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  startMatchBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#070D1E',
    marginLeft: 4,
  },
  subSectionBar: {
    flexDirection: 'row',
    backgroundColor: '#0C142B',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  subSectionTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeSubSectionTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00E676',
  },
  subSectionTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  activeSubSectionTabText: {
    color: '#00E676',
  },
  sectionBody: {
    flex: 1,
  },
  filterChipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#070D1E',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0C142B',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activeFilterChipText: {
    color: '#070D1E',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  matchCard: {
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  venueText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginRight: 6,
  },
  ballTag: {
    backgroundColor: '#1E2C4F',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ballTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFB300',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamsBox: {
    paddingVertical: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  teamNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scoreNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  resultBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#121C38',
  },
  resultSummaryText: {
    fontSize: 12,
    color: '#00E676',
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#121C38',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#121C38',
    borderRadius: 6,
    marginRight: 8,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
    marginLeft: 4,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    marginLeft: 4,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subSectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addSmallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    marginLeft: 4,
  },
  tournNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  tournDetailText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  teamCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  teamAvatarText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  teamCardInfo: {
    flex: 1,
  },
  teamCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  teamCardSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statsPromoCard: {
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginTop: 16,
  },
  statsPromoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
  },
  statsPromoSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  statsActionBtn: {
    backgroundColor: '#00E676',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 18,
  },
  statsActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#070D1E',
  },
  highlightNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121C38',
    padding: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  highlightNoticeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 8,
    flex: 1,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 16,
    backgroundColor: '#00E676',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#070D1E',
  },
});
