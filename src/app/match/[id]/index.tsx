import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../../context/CricketContext';
import { Match, Player, MatchStatus } from '../../../types/cricket';
import { Colors } from '../../../utils/colors';
import { ScoreboardBanner } from '../../../components/match/ScoreboardBanner';
import { ScorecardTable } from '../../../components/match/ScorecardTable';
import { WagonWheelSVG } from '../../../components/match/WagonWheelSVG';
import { PitchRadarSVG } from '../../../components/match/PitchRadarSVG';
import { SyncService } from '../../../services/syncService';
import { CanonicalMatchService } from '../../../services/canonicalMatchService';
import { PlayerPerformanceService } from '../../../services/playerPerformanceService';
import { useTheme, ThemeColors } from '../../../theme/useTheme';

export default function MatchCentreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const { loadMatchById, exportMatch, updateMatchStatus, userProfile, teams, tournaments } = useCricket();

  const [match, setMatch] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'commentary' | 'analytics' | 'info'>('scorecard');
  const [selectedInningsIndex, setSelectedInningsIndex] = useState<number>(0);

  // Analytics sub-view & filters
  const [analyticsView, setAnalyticsView] = useState<'wagon' | 'radar'>('wagon');
  const [selectedBatterId, setSelectedBatterId] = useState<string | undefined>(undefined);
  const [selectedBowlerId, setSelectedBowlerId] = useState<string | undefined>(undefined);

  // Status Change Modal (Organizer Tools)
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [newStatus, setNewStatus] = useState<MatchStatus>('delayed');
  const [statusNote, setStatusNote] = useState('');

  useEffect(() => {
    if (id) {
      loadMatchById(id).then((m) => {
        if (m) {
          setMatch(m);
          setSelectedInningsIndex(m.currentInningsIndex);
        }
      });
      // Fetch fresh canonical projection from cloud backend
      CanonicalMatchService.fetchCanonicalMatch(id).then((canonicalMatch) => {
        if (canonicalMatch) {
          setMatch(canonicalMatch);
          setSelectedInningsIndex(canonicalMatch.currentInningsIndex);
        }
      });
    }
  }, [id, loadMatchById]);

  // Realtime subscription to live match revision increments
  useEffect(() => {
    if (!id) return;
    const unsubscribe = SyncService.subscribeToMatchRevisions(id, async (_newRev) => {
      const canonicalMatch = await CanonicalMatchService.fetchCanonicalMatch(id);
      if (canonicalMatch) {
        setMatch(canonicalMatch);
      } else {
        const localMatch = await loadMatchById(id);
        if (localMatch) setMatch(localMatch);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [id, loadMatchById]);

  if (!match) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading match details...</Text>
      </View>
    );
  }

  const isAuthorized = PlayerPerformanceService.isAccountAuthorizedForMatch(
    userProfile?.id || '',
    match,
    teams,
    tournaments,
    userProfile?.claimedPlayerId ? [userProfile.claimedPlayerId] : []
  );

  if (!isAuthorized) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.canvas }]}>
        <Ionicons name="lock-closed-outline" size={56} color={theme.statusError} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 14 }}>
          Access Restricted
        </Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 18 }}>
          This match is private. Only authorized participants, scorers, organizers, and affiliated squad members can view it.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 13 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allPlayers: Player[] = [...match.team1.players, ...match.team2.players];
  const inn1 = match.innings[0];
  const inn2 = match.innings[1];
  const currentInnings = selectedInningsIndex === 0 ? inn1 : inn2;

  const team1BattingFirst =
    (match.tossWinnerId === match.team1.id && match.tossDecision === 'bat') ||
    (match.tossWinnerId === match.team2.id && match.tossDecision === 'bowl');

  const inn1BatTeam = team1BattingFirst ? match.team1 : match.team2;
  const inn1BowlTeam = team1BattingFirst ? match.team2 : match.team1;

  const inn2BatTeam = inn1BowlTeam;
  const inn2BowlTeam = inn1BatTeam;

  const displayedBatTeam = selectedInningsIndex === 0 ? inn1BatTeam : inn2BatTeam;
  const displayedBowlTeam = selectedInningsIndex === 0 ? inn1BowlTeam : inn2BowlTeam;

  const handleShareSummary = async () => {
    try {
      const summary = `🏏 ${match.title}\n${displayedBatTeam.name}: ${currentInnings ? currentInnings.totalRuns : 0}/${currentInnings ? currentInnings.totalWickets : 0} (${currentInnings ? currentInnings.oversFormatted : '0.0'} ov)\nVenue: ${match.venue}\n${match.result || 'Live Match in progress'}`;
      await Share.share({ message: summary });
    } catch {
      // ignore
    }
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportMatch(match.id);
      Alert.alert('Match JSON Export', 'Backup ready. You can copy the state.', [
        { text: 'Copy to Share', onPress: () => Share.share({ message: json }) },
        { text: 'OK' },
      ]);
    } catch (err: any) {
      Alert.alert('Export Failed', err.message);
    }
  };

  const handleSaveStatusChange = async () => {
    try {
      await updateMatchStatus(match.id, newStatus, statusNote.trim() || undefined);
      const updated = await loadMatchById(match.id);
      if (updated) setMatch(updated);
      setStatusModalVisible(false);
      setStatusNote('');
      Alert.alert('Status Updated', `Match status changed to ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message);
    }
  };

  // Extract batters and bowlers who participated in selected innings for filtering
  const inningsBatterIds = currentInnings ? Object.keys(currentInnings.batterStats) : [];
  const inningsBowlerIds = currentInnings ? Object.keys(currentInnings.bowlerStats) : [];

  // Authority & permission check
  const isAuthorizedScorer =
    userProfile?.role === 'scorer' ||
    match.scorerPlayerId === userProfile?.id ||
    (!match.tournamentId && !match.isSynced);

  // Cloud delay detection (offline scorer)
  const isCloudDelayed =
    (match.status === 'live' || match.status === 'innings_break') &&
    Date.now() - (match.lastUpdated || 0) > 120000;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Live Score Banner */}
        <ScoreboardBanner match={match} />

        {/* Offline Scorer Delayed Banner */}
        {isCloudDelayed && (
          <View style={styles.cloudDelayedBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cloudDelayedTitle}>SCORER RECORDING OFFLINE</Text>
              <Text style={styles.cloudDelayedSubtitle}>
                Scorecard reflects the last synchronized cloud state. Updates will resume automatically when scorer reconnects.
              </Text>
            </View>
          </View>
        )}

        {/* Interruption / Delay Banner */}
        {match.status === 'delayed' && (
          <View style={styles.statusAlertDelayed}>
            <Ionicons name="rainy" size={20} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusAlertDelayedTitle}>MATCH DELAYED / SUSPENDED</Text>
              <Text style={styles.statusAlertDelayedText}>
                {match.result || 'Play suspended due to rain or adverse weather conditions.'}
              </Text>
            </View>
          </View>
        )}

        {/* Abandoned Banner */}
        {match.status === 'abandoned' && (
          <View style={styles.statusAlertAbandoned}>
            <Ionicons name="close-circle" size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusAlertAbandonedTitle}>MATCH ABANDONED</Text>
              <Text style={styles.statusAlertAbandonedText}>
                {match.result || 'Match called off. No further play possible.'}
              </Text>
            </View>
          </View>
        )}

        {/* Tied Banner */}
        {match.status === 'tied' && (
          <View style={styles.statusAlertTied}>
            <Ionicons name="git-commit" size={20} color="#0284C7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusAlertTiedTitle}>MATCH TIED!</Text>
              <Text style={styles.statusAlertTiedText}>
                {match.result || 'Both teams scored equal runs.'}
              </Text>
            </View>
          </View>
        )}

        {/* Quick action: Open Scorer if authorized, otherwise show Spectator indicator */}
        {match.status !== 'completed' && match.status !== 'abandoned' && (
          isAuthorizedScorer ? (
            <TouchableOpacity
              style={styles.openScorerBtn}
              onPress={() => router.push(`/match/${match.id}/scorer`)}
            >
              <Ionicons name="flash" size={18} color="#FFF" />
              <Text style={styles.openScorerText}>OPEN LIVE SCORER CONSOLE</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.spectatorModeBanner}>
              <Ionicons name="eye" size={18} color="#0284C7" />
              <View style={{ flex: 1 }}>
                <Text style={styles.spectatorBannerTitle}>SPECTATOR MODE</Text>
                <Text style={styles.spectatorBannerSubtitle}>
                  Viewing official live scorecard. Scoring controls reserved for authorized match scorer.
                </Text>
              </View>
              <View style={styles.liveTagPulse}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveTagText}>LIVE</Text>
              </View>
            </View>
          )
        )}

        {/* Sub-Tabs: Scorecard | Commentary | Analytics | Info */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'scorecard' && styles.tabItemActive]}
            onPress={() => setActiveTab('scorecard')}
          >
            <Text
              style={[
                styles.tabItemText,
                activeTab === 'scorecard' && styles.tabItemTextActive,
              ]}
            >
              Scorecard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'commentary' && styles.tabItemActive]}
            onPress={() => setActiveTab('commentary')}
          >
            <Text
              style={[
                styles.tabItemText,
                activeTab === 'commentary' && styles.tabItemTextActive,
              ]}
            >
              Ball-by-Ball
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'analytics' && styles.tabItemActive]}
            onPress={() => setActiveTab('analytics')}
          >
            <Text
              style={[
                styles.tabItemText,
                activeTab === 'analytics' && styles.tabItemTextActive,
              ]}
            >
              Analytics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'info' && styles.tabItemActive]}
            onPress={() => setActiveTab('info')}
          >
            <Text
              style={[
                styles.tabItemText,
                activeTab === 'info' && styles.tabItemTextActive,
              ]}
            >
              Match Info
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Scorecard */}
        {activeTab === 'scorecard' && (
          <View>
            {/* Innings Switcher */}
            <View style={styles.inningsSwitcher}>
              <TouchableOpacity
                style={[
                  styles.inningsChip,
                  selectedInningsIndex === 0 && styles.inningsChipActive,
                ]}
                onPress={() => setSelectedInningsIndex(0)}
              >
                <Text
                  style={[
                    styles.inningsChipText,
                    selectedInningsIndex === 0 && styles.inningsChipTextActive,
                  ]}
                >
                  1st Innings ({inn1BatTeam.shortName})
                </Text>
              </TouchableOpacity>

              {inn2 && (
                <TouchableOpacity
                  style={[
                    styles.inningsChip,
                    selectedInningsIndex === 1 && styles.inningsChipActive,
                  ]}
                  onPress={() => setSelectedInningsIndex(1)}
                >
                  <Text
                    style={[
                      styles.inningsChipText,
                      selectedInningsIndex === 1 && styles.inningsChipTextActive,
                    ]}
                  >
                    2nd Innings ({inn2BatTeam.shortName})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {currentInnings ? (
              <ScorecardTable
                innings={currentInnings}
                battingTeam={displayedBatTeam}
                bowlingTeam={displayedBowlTeam}
                allPlayers={allPlayers}
              />
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Innings has not started yet.</Text>
              </View>
            )}
          </View>
        )}

        {/* Tab 2: Commentary Timeline */}
        {activeTab === 'commentary' && (
          <View style={styles.commentaryContainer}>
            <Text style={styles.timelineHeading}>
              Recent Deliveries ({displayedBatTeam.name})
            </Text>
            {currentInnings && currentInnings.deliveries.length > 0 ? (
              [...currentInnings.deliveries].reverse().map((d) => (
                <View key={d.id} style={styles.timelineItem}>
                  <View style={styles.ballCircle}>
                    <Text style={styles.ballCircleText}>
                      {d.overIndex}.{d.ballInOver}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineCommentary}>{d.commentary}</Text>
                    <Text style={styles.timelineRuns}>
                      {d.isWicket
                        ? 'WICKET!'
                        : `${d.runsBat + d.runsExtra} run(s)`}{' '}
                      {d.extraType !== 'none' ? `(${d.extraType})` : ''}
                      {d.shotArea ? ` • Shot Area: ${d.shotArea}` : ''}
                      {d.bowlingSide ? ` • ${d.bowlingSide === 'over' ? 'Over Wkt' : 'Round Wkt'}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No deliveries recorded in this innings yet.</Text>
              </View>
            )}
          </View>
        )}

        {/* Tab 3: Visual Analytics (Wagon Wheel & Pitch Radar) */}
        {activeTab === 'analytics' && (
          <View style={styles.analyticsContainer}>
            {/* Innings selector */}
            <View style={styles.inningsSwitcher}>
              <TouchableOpacity
                style={[
                  styles.inningsChip,
                  selectedInningsIndex === 0 && styles.inningsChipActive,
                ]}
                onPress={() => setSelectedInningsIndex(0)}
              >
                <Text
                  style={[
                    styles.inningsChipText,
                    selectedInningsIndex === 0 && styles.inningsChipTextActive,
                  ]}
                >
                  1st Innings ({inn1BatTeam.shortName})
                </Text>
              </TouchableOpacity>

              {inn2 && (
                <TouchableOpacity
                  style={[
                    styles.inningsChip,
                    selectedInningsIndex === 1 && styles.inningsChipActive,
                  ]}
                  onPress={() => setSelectedInningsIndex(1)}
                >
                  <Text
                    style={[
                      styles.inningsChipText,
                      selectedInningsIndex === 1 && styles.inningsChipTextActive,
                    ]}
                  >
                    2nd Innings ({inn2BatTeam.shortName})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Sub-view switcher: Wagon Wheel vs Pitch Radar */}
            <View style={styles.analyticsSubTabs}>
              <TouchableOpacity
                style={[
                  styles.analyticsSubTabBtn,
                  analyticsView === 'wagon' && styles.analyticsSubTabBtnActive,
                ]}
                onPress={() => setAnalyticsView('wagon')}
              >
                <Ionicons
                  name="compass-outline"
                  size={16}
                  color={analyticsView === 'wagon' ? '#FFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.analyticsSubTabText,
                    analyticsView === 'wagon' && styles.analyticsSubTabTextActive,
                  ]}
                >
                  Radial Wagon Wheel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.analyticsSubTabBtn,
                  analyticsView === 'radar' && styles.analyticsSubTabBtnActive,
                ]}
                onPress={() => setAnalyticsView('radar')}
              >
                <Ionicons
                  name="radio-outline"
                  size={16}
                  color={analyticsView === 'radar' ? '#FFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.analyticsSubTabText,
                    analyticsView === 'radar' && styles.analyticsSubTabTextActive,
                  ]}
                >
                  Pitch Length Radar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Player filter chips */}
            {analyticsView === 'wagon' && inningsBatterIds.length > 0 && (
              <View style={styles.filterChipContainer}>
                <Text style={styles.filterLabel}>FILTER BY BATTER:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      !selectedBatterId && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedBatterId(undefined)}
                  >
                    <Text style={[styles.filterChipText, !selectedBatterId && styles.filterChipTextActive]}>
                      All Batters
                    </Text>
                  </TouchableOpacity>
                  {inningsBatterIds.map((bId) => {
                    const p = allPlayers.find((player) => player.id === bId);
                    return (
                      <TouchableOpacity
                        key={bId}
                        style={[
                          styles.filterChip,
                          selectedBatterId === bId && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedBatterId(bId)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            selectedBatterId === bId && styles.filterChipTextActive,
                          ]}
                        >
                          {p?.name || 'Batter'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {analyticsView === 'radar' && inningsBowlerIds.length > 0 && (
              <View style={styles.filterChipContainer}>
                <Text style={styles.filterLabel}>FILTER BY BOWLER:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      !selectedBowlerId && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedBowlerId(undefined)}
                  >
                    <Text style={[styles.filterChipText, !selectedBowlerId && styles.filterChipTextActive]}>
                      All Bowlers
                    </Text>
                  </TouchableOpacity>
                  {inningsBowlerIds.map((bId) => {
                    const p = allPlayers.find((player) => player.id === bId);
                    return (
                      <TouchableOpacity
                        key={bId}
                        style={[
                          styles.filterChip,
                          selectedBowlerId === bId && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedBowlerId(bId)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            selectedBowlerId === bId && styles.filterChipTextActive,
                          ]}
                        >
                          {p?.name || 'Bowler'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Visual Chart Card */}
            <View style={styles.chartWrapper}>
              {currentInnings ? (
                analyticsView === 'wagon' ? (
                  <WagonWheelSVG
                    deliveries={currentInnings.deliveries}
                    batterId={selectedBatterId}
                    batterName={allPlayers.find((p) => p.id === selectedBatterId)?.name}
                  />
                ) : (
                  <PitchRadarSVG
                    deliveries={
                      selectedBowlerId
                        ? currentInnings.deliveries.filter((d) => d.bowlerId === selectedBowlerId)
                        : currentInnings.deliveries
                    }
                    bowlerName={allPlayers.find((p) => p.id === selectedBowlerId)?.name}
                  />
                )
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No deliveries recorded in this innings yet.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Tab 4: Match Info */}
        {activeTab === 'info' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Match Conditions & Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Match Format:</Text>
              <Text style={styles.infoVal}>{match.format.toUpperCase()} ({match.rules.totalOvers} Overs per side)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ball Type:</Text>
              <Text style={styles.infoVal}>
                {match.ballType ? match.ballType.toUpperCase() : 'LEATHER'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={[styles.infoVal, { color: Colors.pitchGreen, fontWeight: '800' }]}>
                {match.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Assigned Scorer:</Text>
              <Text style={styles.infoVal}>{match.scorerName || 'Official Scorer'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Organized By:</Text>
              <Text style={styles.infoVal}>{match.organizerName || 'Match Organizing Committee'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Venue:</Text>
              <Text style={styles.infoVal}>{match.venue}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoVal}>{match.date}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Toss:</Text>
              <Text style={styles.infoVal}>
                {match.tossWinnerId === match.team1.id ? match.team1.name : match.team2.name} won and chose to {match.tossDecision}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Players Per Team:</Text>
              <Text style={styles.infoVal}>{match.rules.playersPerTeam}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sync Status:</Text>
              <Text style={styles.infoVal}>{match.isSynced ? 'Synced to Cloud' : 'Saved Locally (Offline)'}</Text>
            </View>

            {/* Organizer Match Interruption / State Modifier Button */}
            <TouchableOpacity
              style={styles.organizerStatusBtn}
              onPress={() => {
                setNewStatus(match.status);
                setStatusNote(match.result || '');
                setStatusModalVisible(true);
              }}
            >
              <Ionicons name="settings-outline" size={16} color="#FFF" />
              <Text style={styles.organizerStatusBtnText}>Organizer Match Status Controls</Text>
            </TouchableOpacity>

            {/* Share & Backup Tools */}
            <View style={styles.shareRow}>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShareSummary}>
                <Ionicons name="share-social-outline" size={16} color={Colors.primary} />
                <Text style={styles.shareBtnText}>Share Scorecard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleExportBackup}>
                <Ionicons name="cloud-download-outline" size={16} color={Colors.primary} />
                <Text style={styles.shareBtnText}>Export Backup</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Organizer Match Status Control Modal */}
      <Modal visible={statusModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.statusModalCard}>
            <Text style={styles.statusModalTitle}>Update Match Status</Text>
            <Text style={styles.statusModalSubtitle}>
              Handle weather delays, revised overs, rain interruptions, or abandonment.
            </Text>

            <Text style={styles.statusSelectLabel}>SELECT NEW STATUS</Text>
            <View style={styles.statusGrid}>
              {(['live', 'delayed', 'abandoned', 'tied', 'completed'] as MatchStatus[]).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.statusPill,
                    newStatus === st && styles.statusPillActive,
                  ]}
                  onPress={() => setNewStatus(st)}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      newStatus === st && styles.statusPillTextActive,
                    ]}
                  >
                    {st.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.statusSelectLabel}>INTERRUPTION / RESULT NOTE (OPTIONAL)</Text>
            <TextInput
              style={styles.statusInput}
              value={statusNote}
              onChangeText={setStatusNote}
              placeholder="e.g. Rain break at 14.2 ov. Target revised to 110 in 15 ov."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setStatusModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSaveStatusChange}
              >
                <Text style={styles.modalConfirmText}>Save Status</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.canvas,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    scrollContent: {
      padding: 14,
      paddingBottom: 40,
    },
    statusAlertDelayed: {
      backgroundColor: theme.statusWarningBg,
      borderWidth: 1,
      borderColor: theme.statusWarning,
      borderRadius: 8,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    statusAlertDelayedTitle: {
      color: theme.statusWarning,
      fontSize: 12,
      fontWeight: '700',
    },
    statusAlertDelayedText: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 1,
      fontWeight: '500',
    },
    statusAlertAbandoned: {
      backgroundColor: theme.statusErrorBg,
      borderWidth: 1,
      borderColor: theme.statusError,
      borderRadius: 8,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    statusAlertAbandonedTitle: {
      color: theme.statusError,
      fontSize: 12,
      fontWeight: '700',
    },
    statusAlertAbandonedText: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 1,
      fontWeight: '500',
    },
    statusAlertTied: {
      backgroundColor: theme.statusSyncedBg,
      borderWidth: 1,
      borderColor: theme.statusSynced,
      borderRadius: 8,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    statusAlertTiedTitle: {
      color: theme.statusSynced,
      fontSize: 12,
      fontWeight: '700',
    },
    statusAlertTiedText: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 1,
      fontWeight: '500',
    },
    openScorerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.brand,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 10,
      gap: 6,
    },
    openScorerText: {
      color: theme.brandText,
      fontSize: 13,
      fontWeight: '700',
    },
    cloudDelayedBanner: {
      backgroundColor: theme.statusWarningBg,
      borderWidth: 1,
      borderColor: theme.statusWarning,
      borderRadius: 8,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    cloudDelayedTitle: {
      color: theme.statusWarning,
      fontSize: 12,
      fontWeight: '700',
    },
    cloudDelayedSubtitle: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 1,
      fontWeight: '500',
    },
    spectatorModeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.raised,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
      gap: 8,
    },
    spectatorBannerTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    spectatorBannerSubtitle: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 1,
      fontWeight: '500',
    },
    liveTagPulse: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.statusLiveBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      gap: 4,
    },
    livePulseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.statusLive,
    },
    liveTagText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.statusLive,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 3,
      marginBottom: 12,
    },
    tabItem: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 6,
    },
    tabItemActive: {
      backgroundColor: theme.brand,
    },
    tabItemText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    tabItemTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    inningsSwitcher: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    inningsChip: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.raised,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inningsChipActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    inningsChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    inningsChipTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    analyticsContainer: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    analyticsSubTabs: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    analyticsSubTabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.raised,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    analyticsSubTabBtnActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    analyticsSubTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    analyticsSubTabTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    filterChipContainer: {
      marginBottom: 10,
    },
    filterLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 4,
    },
    chipScroll: {
      flexDirection: 'row',
    },
    filterChip: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: theme.raised,
      marginRight: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterChipActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    filterChipTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    chartWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    emptyBox: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 8,
      marginTop: 8,
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: 12,
      fontStyle: 'italic',
    },
    commentaryContainer: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    timelineHeading: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubdued,
      paddingBottom: 6,
    },
    timelineItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubdued,
      gap: 10,
    },
    ballCircle: {
      backgroundColor: theme.raised,
      paddingVertical: 3,
      paddingHorizontal: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ballCircleText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    timelineCommentary: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textPrimary,
      flex: 1,
    },
    timelineRuns: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 1,
    },
    infoCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 10,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubdued,
    },
    infoLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    infoVal: {
      fontSize: 12,
      color: theme.textPrimary,
      fontWeight: '600',
      maxWidth: '60%',
      textAlign: 'right',
    },
    organizerStatusBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.brand,
      paddingVertical: 10,
      borderRadius: 8,
      marginTop: 14,
    },
    organizerStatusBtnText: {
      color: theme.brandText,
      fontSize: 12,
      fontWeight: '700',
    },
    shareRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    shareBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.raised,
      paddingVertical: 9,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    shareBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'flex-end',
    },
    statusModalCard: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 18,
      maxHeight: '85%',
    },
    statusModalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    statusModalSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 1,
      marginBottom: 10,
    },
    statusSelectLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      marginTop: 6,
      marginBottom: 4,
    },
    statusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    statusPill: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: theme.raised,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statusPillActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    statusPillTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    statusInput: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 10,
      color: theme.textPrimary,
      fontSize: 13,
      marginBottom: 14,
      textAlignVertical: 'top',
    },
    modalBtnRow: {
      flexDirection: 'row',
      gap: 8,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.raised,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalCancelText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    modalConfirmBtn: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.brand,
      alignItems: 'center',
    },
    modalConfirmText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.brandText,
    },
  });
}
