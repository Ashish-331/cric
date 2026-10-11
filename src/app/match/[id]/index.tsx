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

export default function MatchCentreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loadMatchById, exportMatch, updateMatchStatus, userProfile } = useCricket();

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  statusAlertDelayed: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  statusAlertDelayedTitle: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusAlertDelayedText: {
    color: '#92400E',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  statusAlertAbandoned: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  statusAlertAbandonedTitle: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusAlertAbandonedText: {
    color: '#991B1B',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  statusAlertTied: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  statusAlertTiedTitle: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusAlertTiedText: {
    color: '#075985',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  openScorerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pitchGreen,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
    shadowColor: Colors.pitchGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  openScorerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cloudDelayedBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  cloudDelayedTitle: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cloudDelayedSubtitle: {
    color: '#92400E',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  spectatorModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  spectatorBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  spectatorBannerSubtitle: {
    fontSize: 11,
    color: '#0369A1',
    marginTop: 2,
    fontWeight: '600',
  },
  liveTagPulse: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: Colors.primary,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#FFFFFF',
  },
  inningsSwitcher: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  inningsChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  inningsChipActive: {
    backgroundColor: Colors.primaryDark,
  },
  inningsChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  inningsChipTextActive: {
    color: '#FFFFFF',
  },
  analyticsContainer: {
    backgroundColor: '#070D1E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  analyticsSubTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  analyticsSubTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  analyticsSubTabBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.pitchGreen,
  },
  analyticsSubTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  analyticsSubTabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  filterChipContainer: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: Colors.pitchGreen,
    borderColor: Colors.pitchGreen,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#070D1E',
    fontWeight: '800',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 10,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  commentaryContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timelineHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  ballCircle: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  ballCircleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineCommentary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  timelineRuns: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  organizerStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  organizerStatusBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  statusModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  statusModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  statusSelectLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statusPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  statusPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  statusInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    color: '#0F172A',
    fontSize: 13,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.pitchGreen,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
