import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../../context/CricketContext';
import {
  Player,
  DismissalType,
  BowlingSide,
  ShotSector,
  PitchLength,
  PitchLine,
  PitchCoordinate,
  PitchProvenance,
} from '../../../types/cricket';
import { BallInput } from '../../../engine/cricketEngine';
import { Colors } from '../../../utils/colors';
import { CricketHaptics } from '../../../services/haptics';
import { ScoreboardBanner } from '../../../components/match/ScoreboardBanner';
import { RecentBallsRibbon } from '../../../components/match/RecentBallsRibbon';
import { ScoringKeypad } from '../../../components/match/ScoringKeypad';
import { WicketModal } from '../../../components/match/WicketModal';
import { BowlerSelectModal } from '../../../components/match/BowlerSelectModal';
import { BatterSelectModal } from '../../../components/match/BatterSelectModal';
import { ShotAreaSelectorModal } from '../../../components/match/ShotAreaSelectorModal';
import { CelebrationOverlay, CelebrationType } from '../../../components/match/CelebrationOverlay';
import { WagonWheelSVG } from '../../../components/match/WagonWheelSVG';
import { PitchRadarSVG } from '../../../components/match/PitchRadarSVG';
import { StorageService } from '../../../storage/storageService';
import { useTheme, ThemeColors } from '../../../theme/useTheme';

export default function ScorerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const {
    activeMatch,
    loadMatchById,
    recordDelivery,
    undoDelivery,
    retireBatter,
    returnBatter,
    selectBowler,
    selectStriker,
    selectNonStriker,
    swapStrikerNonStriker,
    startSecondInnings,
  } = useCricket();

  // Core scoring modals
  const [wicketModalVisible, setWicketModalVisible] = useState(false);
  const [bowlerModalVisible, setBowlerModalVisible] = useState(false);
  const [batterModalVisible, setBatterModalVisible] = useState(false);
  const [batterSlotToSelect, setBatterSlotToSelect] = useState<'striker' | 'nonStriker'>('striker');
  const [inningsBreakModalVisible, setInningsBreakModalVisible] = useState(false);

  // Cricketing state additions
  const [bowlingSide, setBowlingSide] = useState<BowlingSide>('over');
  const [quickScoring, setQuickScoring] = useState<boolean>(true);
  const [shotModalVisible, setShotModalVisible] = useState(false);
  const [pendingBall, setPendingBall] = useState<BallInput | null>(null);

  // Celebrations & Haptic Alerts
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationType, setCelebrationType] = useState<CelebrationType | null>(null);
  const [celebrationTitle, setCelebrationTitle] = useState<string | undefined>(undefined);
  const [celebrationSubtitle, setCelebrationSubtitle] = useState<string | undefined>(undefined);

  // Visuals modal (Wagon Wheel & Pitch Radar)
  const [visualsModalVisible, setVisualsModalVisible] = useState(false);
  const [visualsTab, setVisualsTab] = useState<'wagon' | 'radar'>('wagon');

  // 2nd innings opener selection
  const [inn2StrikerId, setInn2StrikerId] = useState('');
  const [inn2NonStrikerId, setInn2NonStrikerId] = useState('');
  const [inn2BowlerId, setInn2BowlerId] = useState('');

  // Persistence status (must be declared before any conditional return to obey Rules of Hooks)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastFailedBall, setLastFailedBall] = useState<BallInput | null>(null);

  useEffect(() => {
    if (id) {
      loadMatchById(id);
    }
  }, [id, loadMatchById]);

  if (!activeMatch) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Scorer...</Text>
      </View>
    );
  }

  const innIndex = activeMatch.currentInningsIndex;
  const currentInnings = activeMatch.innings[innIndex];

  if (!currentInnings) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No active innings found</Text>
      </View>
    );
  }

  const team1BattingFirst =
    (activeMatch.tossWinnerId === activeMatch.team1.id && activeMatch.tossDecision === 'bat') ||
    (activeMatch.tossWinnerId === activeMatch.team2.id && activeMatch.tossDecision === 'bowl');

  const battingTeam =
    innIndex === 0
      ? team1BattingFirst
        ? activeMatch.team1
        : activeMatch.team2
      : team1BattingFirst
      ? activeMatch.team2
      : activeMatch.team1;

  const bowlingTeam =
    innIndex === 0
      ? team1BattingFirst
        ? activeMatch.team2
        : activeMatch.team1
      : team1BattingFirst
      ? activeMatch.team1
      : activeMatch.team2;

  const allPlayers: Player[] = [...activeMatch.team1.players, ...activeMatch.team2.players];
  const getPlayer = (pId?: string) => allPlayers.find((p) => p.id === pId);

  const striker = getPlayer(currentInnings.currentStrikerId);
  const nonStriker = getPlayer(currentInnings.currentNonStrikerId);
  const currentBowler = getPlayer(currentInnings.currentBowlerId);

  const triggerCelebration = (
    type: CelebrationType,
    title?: string,
    subtitle?: string
  ) => {
    setCelebrationType(type);
    setCelebrationTitle(title);
    setCelebrationSubtitle(subtitle);
    setCelebrationVisible(true);
  };

  const commitDelivery = async (input: BallInput): Promise<void> => {
    const ballToCommit: BallInput = {
      ...input,
      id: input.id || input.commandId || `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    try {
      const strikerId = currentInnings.currentStrikerId;
      const prevRuns = (strikerId && currentInnings.batterStats[strikerId]?.runs) || 0;

      setSaveStatus('saving');
      const outcome = await recordDelivery(ballToCommit);
      setSaveStatus('saved');
      setSaveError(null);
      setLastFailedBall(null);

      // A2: Handle outcome warnings (e.g. negated dismissal on No-Ball or Free Hit)
      if (outcome.warning) {
        Alert.alert('Notice', outcome.warning);
      }

      // Handle Wicket: ONLY celebrate & prompt replacement if authoritative outcome confirms valid wicket!
      if (outcome.isWicket && outcome.wicketValid) {
        triggerCelebration(
          'wicket',
          'WICKET DOWN!',
          `${getPlayer(outcome.dismissedPlayerId || '')?.name || 'Batter'} dismissed`
        );
        CricketHaptics.wicket();

        if (outcome.vacantSlot && !outcome.isInningsComplete) {
          setBatterSlotToSelect(outcome.vacantSlot);
          setBatterModalVisible(true);
        }
      } else {
        // Milestone and boundary celebrations on fair, valid scoring
        const addedRuns = ballToCommit.runsBat || 0;
        const newRuns = prevRuns + addedRuns;

        if (prevRuns < 50 && newRuns >= 50) {
          triggerCelebration(
            'fifty',
            'HALF CENTURY! 50*',
            `${striker?.name || 'Batter'} brings up a sensational half-century!`
          );
          CricketHaptics.milestone();
        } else if (prevRuns < 100 && newRuns >= 100) {
          triggerCelebration(
            'hundred',
            'CENTURY! 100*',
            `What a masterclass! Century reached by ${striker?.name || 'Batter'}!`
          );
          CricketHaptics.milestone();
        } else if (ballToCommit.isSix) {
          triggerCelebration(
            'six',
            'MAXIMUM 6!',
            `${striker?.name || 'Batter'} launches it into the stands!`
          );
        } else if (ballToCommit.isBoundary) {
          triggerCelebration(
            'four',
            'CRACKING FOUR!',
            `${striker?.name || 'Batter'} finds the boundary rope!`
          );
        }
      }

      // Over finish prompt: ONLY if over is complete AND innings is not complete!
      if (outcome.needsNewBowler) {
        setTimeout(() => {
          setBowlerModalVisible(true);
        }, 350);
      }
    } catch (err: any) {
      setSaveStatus('failed');
      setSaveError(err.message || 'Storage write failed');
      setLastFailedBall(ballToCommit);
      Alert.alert('Storage Save Error', err.message);
    }
  };

  const handleRetrySave = async () => {
    if (lastFailedBall) {
      await commitDelivery(lastFailedBall);
    } else if (activeMatch) {
      try {
        setSaveStatus('saving');
        await StorageService.saveMatch(activeMatch);
        setSaveStatus('saved');
        setSaveError(null);
      } catch (err: any) {
        setSaveStatus('failed');
        setSaveError(err.message || 'Retry failed');
      }
    }
  };

  const handleScoreBall = async (input: BallInput) => {
    // Check if batsman or bowler needs to be chosen first
    if (!currentInnings.currentStrikerId) {
      setBatterSlotToSelect('striker');
      setBatterModalVisible(true);
      return;
    }
    if (!currentInnings.currentNonStrikerId) {
      setBatterSlotToSelect('nonStriker');
      setBatterModalVisible(true);
      return;
    }
    if (!currentInnings.currentBowlerId) {
      setBowlerModalVisible(true);
      return;
    }

    // Keypad haptic feedback
    if (input.isSix) {
      CricketHaptics.maximumSix();
    } else if (input.isBoundary) {
      CricketHaptics.boundaryFour();
    } else if (input.runsBat > 0 || input.extraType === 'wide' || input.extraType === 'noBall') {
      CricketHaptics.runs();
    } else {
      CricketHaptics.dot();
    }

    const isDotBall = input.runsBat === 0 && input.runsExtra === 0 && !input.isWicket;

    const deliveryWithSide: BallInput = {
      ...input,
      bowlingSide,
    };

    // Dot Balls: When a delivery is a dot ball, DO NOT open any modal! Commit the ball immediately.
    // Also if Quick Scoring is enabled OR pure extra without bat shot (wide, penalty)
    if (isDotBall || quickScoring || input.extraType === 'wide' || input.extraType === 'penalty') {
      await commitDelivery(deliveryWithSide);
    } else {
      // Non-dot balls: prompt interactive wagon wheel & pitch mapping
      setPendingBall(deliveryWithSide);
      setShotModalVisible(true);
    }
  };

  const handleSelectSector = async (
    sector: ShotSector,
    pitchLength?: PitchLength,
    pitchLine?: PitchLine,
    pitchCoord?: PitchCoordinate,
    pitchProvenance?: PitchProvenance
  ) => {
    if (!pendingBall) return;
    const finalBall: BallInput = {
      ...pendingBall,
      shotArea: sector,
      pitchLength,
      pitchLine,
      pitchCoord,
      pitchProvenance,
    };

    setShotModalVisible(false);
    setPendingBall(null);
    await commitDelivery(finalBall);
  };

  const handleSkipSector = async () => {
    if (!pendingBall) return;
    const finalBall = pendingBall;

    setShotModalVisible(false);
    setPendingBall(null);
    await commitDelivery(finalBall);
  };

  const handleConfirmWicket = async (params: {
    dismissalType: DismissalType;
    dismissedPlayerId: string;
    fielderId?: string;
    runsBat: number;
  }) => {
    try {
      // CRIC-005: Model explicit retirement without manufacturing a delivery
      if (params.dismissalType === 'retired_hurt' || params.dismissalType === 'retired_out') {
        await retireBatter(params.dismissedPlayerId, params.dismissalType);
        triggerCelebration(
          'wicket',
          params.dismissalType === 'retired_hurt' ? 'BATTER RETIRED HURT' : 'BATTER RETIRED OUT',
          `${getPlayer(params.dismissedPlayerId)?.name || 'Batter'} vacates crease`
        );
        const dismissedSlot =
          params.dismissedPlayerId === currentInnings.currentStrikerId ? 'striker' : 'nonStriker';
        setBatterSlotToSelect(dismissedSlot);
        setBatterModalVisible(true);
        return;
      }

      const wicketBall: BallInput = {
        runsBat: params.runsBat,
        extraType: 'none',
        runsExtra: 0,
        isBoundary: false,
        isSix: false,
        isWicket: true,
        dismissalType: params.dismissalType,
        dismissedPlayerId: params.dismissedPlayerId,
        fielderId: params.fielderId,
        bowlingSide,
      };

      // For caught / caught & bowled / run out: if not quickScoring, open interactive wagon wheel!
      if (
        !quickScoring &&
        (params.dismissalType === 'caught' ||
          params.dismissalType === 'caught_and_bowled' ||
          params.dismissalType === 'run_out')
      ) {
        setPendingBall(wicketBall);
        setShotModalVisible(true);
        return;
      }

      // commitDelivery authoritatively validates dismissal legality and updates replacements/celebrations
      await commitDelivery(wicketBall);
    } catch (err: any) {
      Alert.alert('Wicket Error', err.message);
    }
  };

  const handleManualSwapStrike = async () => {
    if (!currentInnings.currentStrikerId || !currentInnings.currentNonStrikerId) return;
    CricketHaptics.toggle();
    await swapStrikerNonStriker();
  };

  const handleUndoDelivery = async () => {
    CricketHaptics.undo();
    await undoDelivery();
  };

  const handleStartSecondInnings = async () => {
    const sId = inn2StrikerId || bowlingTeam.players[0]?.id;
    const nsId = inn2NonStrikerId || bowlingTeam.players[1]?.id;
    const bId = inn2BowlerId || battingTeam.players[0]?.id;

    if (!sId || !nsId || sId === nsId) {
      Alert.alert('Batters Required', 'Select two different opening batters');
      return;
    }
    if (!bId) {
      Alert.alert('Bowler Required', 'Select an opening bowler');
      return;
    }

    await startSecondInnings(sId, nsId, bId);
    setInningsBreakModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Live Scoreboard Banner */}
        <ScoreboardBanner match={activeMatch} />

        {/* Persistence Failure Banner */}
        {saveStatus === 'failed' && (
          <View style={styles.saveErrorBanner}>
            <View style={styles.saveErrorContent}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.saveErrorTitle}>Storage Save Failed</Text>
                <Text style={styles.saveErrorText}>
                  {saveError || 'Match progress could not be written to persistent storage.'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.retrySaveButton} onPress={handleRetrySave}>
              <Ionicons name="refresh" size={14} color="#FFF" />
              <Text style={styles.retrySaveText}>Retry Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Persistence Status Pill */}
        <View style={styles.saveStatusRow}>
          <View style={styles.saveStatusPill}>
            <View
              style={[
                styles.saveStatusDot,
                saveStatus === 'saving'
                  ? styles.saveStatusDotSaving
                  : saveStatus === 'failed'
                  ? styles.saveStatusDotFailed
                  : styles.saveStatusDotSaved,
              ]}
            />
            <Text style={styles.saveStatusLabel}>
              {saveStatus === 'saving'
                ? 'Saving ball...'
                : saveStatus === 'failed'
                ? 'Unsaved changes'
                : 'Saved locally'}
            </Text>
          </View>
        </View>

        {/* Free Hit Glowing Alert Banner */}
        {currentInnings.isFreeHit && (
          <View style={styles.freeHitBanner}>
            <View style={styles.freeHitPulseIndicator}>
              <Ionicons name="flash" size={18} color="#FFD700" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.freeHitTitle}>⚡ FREE HIT IN PLAY</Text>
              <Text style={styles.freeHitSubtitle}>
                Bowled, Caught, LBW & Stumped negated (ICC / MCC Law 21.19)
              </Text>
            </View>
          </View>
        )}

        {/* Match Completed Banner */}
        {activeMatch.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Ionicons name="trophy" size={24} color={Colors.accentAmber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.completedTitle}>Match Concluded!</Text>
              <Text style={styles.completedResult}>{activeMatch.result}</Text>
            </View>
            <TouchableOpacity
              style={styles.viewScorecardBtn}
              onPress={() => router.push(`/match/${activeMatch.id}`)}
            >
              <Text style={styles.viewScorecardText}>Scorecard</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Innings Break Banner */}
        {activeMatch.status === 'innings_break' && (
          <View style={styles.breakBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.breakTitle}>Innings Break</Text>
              <Text style={styles.breakSubtitle}>
                Target: {activeMatch.targetRuns} runs in {activeMatch.rules.totalOvers} overs
              </Text>
            </View>
            <TouchableOpacity
              style={styles.startInn2Btn}
              onPress={() => setInningsBreakModalVisible(true)}
            >
              <Text style={styles.startInn2Text}>Start 2nd Innings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick action triggers for replacing batsman / bowler if vacant */}
        {(!currentInnings.currentStrikerId || !currentInnings.currentNonStrikerId) && (
          <TouchableOpacity
            style={styles.vacantCreaseAlert}
            onPress={() => {
              setBatterSlotToSelect(!currentInnings.currentStrikerId ? 'striker' : 'nonStriker');
              setBatterModalVisible(true);
            }}
          >
            <Ionicons name="alert-circle" size={18} color="#FFF" />
            <Text style={styles.vacantText}>
              Batter slot is vacant! Tap here to select incoming batter.
            </Text>
          </TouchableOpacity>
        )}

        {/* Recent Deliveries in This Over Ribbon */}
        <RecentBallsRibbon deliveries={currentInnings.deliveries} />

        {/* Bowler Changer Bar with Approach Angle & Quick Scoring */}
        <View style={styles.bowlerControlCard}>
          <View style={styles.bowlerInfoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bowlerRoleLabel}>CURRENT BOWLER</Text>
              <Text style={styles.currentBowlerName} numberOfLines={1}>
                {currentBowler?.name || 'Select Bowler'}
              </Text>
            </View>

            {/* Approach Toggle: Over / Round */}
            <View style={styles.approachToggleWrap}>
              <TouchableOpacity
                style={[
                  styles.approachBtn,
                  bowlingSide === 'over' && styles.approachBtnActive,
                ]}
                onPress={() => {
                  setBowlingSide('over');
                  CricketHaptics.toggle();
                }}
              >
                <Text
                  style={[
                    styles.approachBtnText,
                    bowlingSide === 'over' && styles.approachBtnTextActive,
                  ]}
                >
                  Over
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.approachBtn,
                  bowlingSide === 'round' && styles.approachBtnActive,
                ]}
                onPress={() => {
                  setBowlingSide('round');
                  CricketHaptics.toggle();
                }}
              >
                <Text
                  style={[
                    styles.approachBtnText,
                    bowlingSide === 'round' && styles.approachBtnTextActive,
                  ]}
                >
                  Round
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.changeBowlerBtn}
              onPress={() => setBowlerModalVisible(true)}
            >
              <Ionicons name="swap-horizontal" size={14} color="#FFF" />
              <Text style={styles.changeBowlerText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Quick scoring & Visuals bar */}
          <View style={styles.controlsBar}>
            <TouchableOpacity
              style={[
                styles.quickScoringPill,
                quickScoring && styles.quickScoringPillActive,
              ]}
              onPress={() => {
                setQuickScoring(!quickScoring);
                CricketHaptics.toggle();
              }}
            >
              <Ionicons
                name={quickScoring ? 'flash' : 'flash-outline'}
                size={14}
                color={quickScoring ? '#070D1E' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.quickScoringText,
                  quickScoring && styles.quickScoringTextActive,
                ]}
              >
                {quickScoring ? 'Quick Scoring ON' : 'Shot Area Modal ON'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.visualsLinkBtn}
              onPress={() => setVisualsModalVisible(true)}
            >
              <Ionicons name="pie-chart-outline" size={14} color={Colors.accentCyan} />
              <Text style={styles.visualsLinkText}>Wagon Wheel & Radar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Touch Keypad */}
        <ScoringKeypad
          disabled={activeMatch.status === 'completed' || activeMatch.status === 'innings_break'}
          onScoreBall={handleScoreBall}
          onOpenWicketModal={() => setWicketModalVisible(true)}
          onUndo={handleUndoDelivery}
          onSwapStrike={handleManualSwapStrike}
        />

        {/* View Full Scorecard Link */}
        <TouchableOpacity
          style={styles.fullCardLink}
          onPress={() => router.push(`/match/${activeMatch.id}`)}
        >
          <Ionicons name="stats-chart" size={16} color={Colors.accentCyan} />
          <Text style={styles.fullCardLinkText}>View Full Match Scorecard & Statistics</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Wicket Modal with Free Hit lockout */}
      <WicketModal
        visible={wicketModalVisible}
        onClose={() => setWicketModalVisible(false)}
        striker={striker}
        nonStriker={nonStriker}
        bowlingTeamPlayers={bowlingTeam.players}
        isFreeHit={currentInnings.isFreeHit}
        onConfirmWicket={handleConfirmWicket}
      />

      {/* Bowler Selection Modal */}
      <BowlerSelectModal
        visible={bowlerModalVisible}
        onClose={() => setBowlerModalVisible(false)}
        bowlingTeamPlayers={bowlingTeam.players}
        currentBowlerId={currentInnings.currentBowlerId}
        bowlerStats={currentInnings.bowlerStats}
        onSelectBowler={selectBowler}
        maxOversPerBowler={activeMatch.rules.maxOversPerBowler}
        totalOvers={activeMatch.rules.totalOvers}
      />

      {/* Batter Selection Modal */}
      <BatterSelectModal
        visible={batterModalVisible}
        onClose={() => setBatterModalVisible(false)}
        battingTeamPlayers={battingTeam.players}
        batterStats={currentInnings.batterStats}
        currentStrikerId={currentInnings.currentStrikerId}
        currentNonStrikerId={currentInnings.currentNonStrikerId}
        slot={batterSlotToSelect}
        onSelectBatter={(pId) => {
          const stats = currentInnings.batterStats[pId];
          if (stats && !stats.isOut && stats.dismissalText?.includes('retired hurt')) {
            returnBatter(pId, batterSlotToSelect);
          } else if (batterSlotToSelect === 'striker') {
            selectStriker(pId);
          } else {
            selectNonStriker(pId);
          }
        }}
      />

      {/* 10-Ground Sector Shot Area Modal */}
      <ShotAreaSelectorModal
        visible={shotModalVisible}
        runs={pendingBall?.runsBat || 0}
        isBoundary={pendingBall?.isBoundary || false}
        isSix={pendingBall?.isSix || false}
        isWicket={pendingBall?.isWicket || false}
        strikerName={striker?.name}
        battingHand={striker?.battingHand || 'right'}
        onSelectSector={handleSelectSector}
        onSkip={handleSkipSector}
        onEnableQuickScoring={() => {
          setQuickScoring(true);
          handleSkipSector();
        }}
      />

      {/* Broadcast Celebration Overlay */}
      <CelebrationOverlay
        visible={celebrationVisible}
        type={celebrationType}
        title={celebrationTitle}
        subtitle={celebrationSubtitle}
        onDismiss={() => setCelebrationVisible(false)}
      />

      {/* Visual Analytics Modal (Wagon Wheel & Pitch Radar) */}
      <Modal
        visible={visualsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisualsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.visualsModalCard}>
            <View style={styles.visualsHeader}>
              <View>
                <Text style={styles.visualsTitle}>Visual Field Analytics</Text>
                <Text style={styles.visualsSubtitle}>
                  {battingTeam.name} Innings • {currentInnings.deliveries.length} balls
                </Text>
              </View>
              <TouchableOpacity
                style={styles.visualsCloseBtn}
                onPress={() => setVisualsModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            {/* Switch tabs */}
            <View style={styles.visualsTabRow}>
              <TouchableOpacity
                style={[
                  styles.visualsTabBtn,
                  visualsTab === 'wagon' && styles.visualsTabBtnActive,
                ]}
                onPress={() => setVisualsTab('wagon')}
              >
                <Ionicons
                  name="compass-outline"
                  size={16}
                  color={visualsTab === 'wagon' ? '#070D1E' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.visualsTabBtnText,
                    visualsTab === 'wagon' && styles.visualsTabBtnTextActive,
                  ]}
                >
                  Wagon Wheel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visualsTabBtn,
                  visualsTab === 'radar' && styles.visualsTabBtnActive,
                ]}
                onPress={() => setVisualsTab('radar')}
              >
                <Ionicons
                  name="radio-outline"
                  size={16}
                  color={visualsTab === 'radar' ? '#070D1E' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.visualsTabBtnText,
                    visualsTab === 'radar' && styles.visualsTabBtnTextActive,
                  ]}
                >
                  Pitch Radar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab content */}
            <ScrollView
              contentContainerStyle={styles.visualsScroll}
              showsVerticalScrollIndicator={false}
            >
              {visualsTab === 'wagon' ? (
                <WagonWheelSVG
                  deliveries={currentInnings.deliveries}
                  batterId={currentInnings.currentStrikerId}
                  batterName={striker?.name}
                />
              ) : (
                <PitchRadarSVG
                  deliveries={currentInnings.deliveries}
                  bowlerName={currentBowler?.name}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Start 2nd Innings Modal */}
      <Modal visible={inningsBreakModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Begin 2nd Innings</Text>
            <Text style={styles.modalSubtitle}>
              Target: {activeMatch.targetRuns} runs • {bowlingTeam.name} Batting
            </Text>

            <Text style={styles.sectionHeading}>Opening Striker (⚡ On Strike)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollList}>
              {bowlingTeam.players.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.playerChip,
                    (inn2StrikerId || bowlingTeam.players[0]?.id) === p.id && styles.playerChipActive,
                  ]}
                  onPress={() => setInn2StrikerId(p.id)}
                >
                  <Text
                    style={[
                      styles.playerChipText,
                      (inn2StrikerId || bowlingTeam.players[0]?.id) === p.id && styles.playerChipTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionHeading}>Opening Non-Striker</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollList}>
              {bowlingTeam.players.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.playerChip,
                    (inn2NonStrikerId || bowlingTeam.players[1]?.id) === p.id && styles.playerChipActive,
                  ]}
                  onPress={() => setInn2NonStrikerId(p.id)}
                >
                  <Text
                    style={[
                      styles.playerChipText,
                      (inn2NonStrikerId || bowlingTeam.players[1]?.id) === p.id && styles.playerChipTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionHeading}>Opening Bowler ({battingTeam.name})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollList}>
              {battingTeam.players.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.playerChip,
                    (inn2BowlerId || battingTeam.players[0]?.id) === p.id && styles.playerChipActive,
                  ]}
                  onPress={() => setInn2BowlerId(p.id)}
                >
                  <Text
                    style={[
                      styles.playerChipText,
                      (inn2BowlerId || battingTeam.players[0]?.id) === p.id && styles.playerChipTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setInningsBreakModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleStartSecondInnings}
              >
                <Text style={styles.modalConfirmText}>Start Innings 2</Text>
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
      padding: 12,
      paddingBottom: 40,
    },
    freeHitBanner: {
      backgroundColor: theme.statusWarningBg,
      borderRadius: 8,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.statusWarning,
    },
    freeHitPulseIndicator: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.statusWarning,
    },
    freeHitTitle: {
      color: theme.statusWarning,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    freeHitSubtitle: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '500',
      marginTop: 1,
    },
    completedBanner: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    completedTitle: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    completedResult: {
      color: theme.brand,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    viewScorecardBtn: {
      backgroundColor: theme.brand,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    viewScorecardText: {
      color: theme.brandText,
      fontSize: 12,
      fontWeight: '700',
    },
    breakBanner: {
      backgroundColor: theme.statusBreakBg,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.statusBreak,
    },
    breakTitle: {
      color: theme.statusBreak,
      fontSize: 14,
      fontWeight: '800',
    },
    breakSubtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
    },
    startInn2Btn: {
      backgroundColor: theme.brand,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    startInn2Text: {
      color: theme.brandText,
      fontWeight: '700',
      fontSize: 12,
    },
    vacantCreaseAlert: {
      backgroundColor: theme.statusWarningBg,
      padding: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.statusWarning,
    },
    vacantText: {
      color: theme.statusWarning,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    bowlerControlCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    bowlerInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bowlerRoleLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.5,
    },
    currentBowlerName: {
      color: theme.textPrimary,
      fontWeight: '700',
      fontSize: 14,
      marginTop: 1,
    },
    approachToggleWrap: {
      flexDirection: 'row',
      backgroundColor: theme.raised,
      borderRadius: 6,
      padding: 2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    approachBtn: {
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 4,
    },
    approachBtnActive: {
      backgroundColor: theme.brand,
    },
    approachBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    approachBtnTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    changeBowlerBtn: {
      backgroundColor: theme.raised,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    changeBowlerText: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    controlsBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.borderSubdued,
    },
    quickScoringPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.raised,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quickScoringPillActive: {
      backgroundColor: theme.brandTint,
      borderColor: theme.brand,
    },
    quickScoringText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    quickScoringTextActive: {
      color: theme.brand,
      fontWeight: '700',
    },
    visualsLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    visualsLinkText: {
      color: theme.brand,
      fontSize: 11,
      fontWeight: '600',
    },
    fullCardLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
      marginTop: 8,
    },
    fullCardLinkText: {
      color: theme.brand,
      fontSize: 13,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'flex-end',
    },
    visualsModalCard: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 18,
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: theme.border,
    },
    visualsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    visualsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    visualsSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 1,
    },
    visualsCloseBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.raised,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    visualsTabRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    visualsTabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: theme.raised,
      borderWidth: 1,
      borderColor: theme.border,
    },
    visualsTabBtnActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    visualsTabBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    visualsTabBtnTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    visualsScroll: {
      alignItems: 'center',
      paddingBottom: 20,
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 18,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    modalSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 1,
      marginBottom: 10,
    },
    sectionHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      marginTop: 10,
      marginBottom: 6,
    },
    scrollList: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    playerChip: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.raised,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    playerChipActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    playerChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    playerChipTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    modalBtnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
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
    saveErrorBanner: {
      backgroundColor: theme.statusErrorBg,
      borderWidth: 1,
      borderColor: theme.statusError,
      borderRadius: 8,
      padding: 10,
      marginHorizontal: 12,
      marginTop: 6,
      marginBottom: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    saveErrorContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    saveErrorTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.statusError,
    },
    saveErrorText: {
      fontSize: 11,
      color: theme.statusError,
      marginTop: 1,
    },
    retrySaveButton: {
      backgroundColor: theme.statusError,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      gap: 4,
    },
    retrySaveText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    saveStatusRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginHorizontal: 12,
      marginTop: 2,
      marginBottom: 4,
    },
    saveStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      gap: 5,
    },
    saveStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    saveStatusDotSaved: {
      backgroundColor: theme.brand,
    },
    saveStatusDotSaving: {
      backgroundColor: theme.statusBreak,
    },
    saveStatusDotFailed: {
      backgroundColor: theme.statusError,
    },
    saveStatusLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.textSecondary,
    },
  });
}
