import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExtraType } from '../../types/cricket';
import { BallInput } from '../../engine/cricketEngine';
import { Colors } from '../../utils/colors';

interface ScoringKeypadProps {
  onScoreBall: (input: BallInput) => void;
  onOpenWicketModal: () => void;
  onUndo: () => void;
  onSwapStrike: () => void;
  disabled?: boolean;
}

export const ScoringKeypad: React.FC<ScoringKeypadProps> = ({
  onScoreBall,
  onOpenWicketModal,
  onUndo,
  onSwapStrike,
  disabled = false,
}) => {
  const [selectedExtra, setSelectedExtra] = useState<ExtraType>('none');

  const handleRunPress = (runs: number) => {
    if (disabled) return;

    if (selectedExtra === 'none') {
      onScoreBall({
        runsBat: runs,
        runsExtra: 0,
        extraType: 'none',
        isBoundary: runs === 4,
        isSix: runs === 6,
        isWicket: false,
      });
    } else if (selectedExtra === 'wide') {
      // 1 penalty wide run + any extra running/bye runs
      const totalWideExtra = 1 + runs;
      onScoreBall({
        runsBat: 0,
        runsExtra: totalWideExtra,
        extraType: 'wide',
        isBoundary: false,
        isSix: false,
        isWicket: false,
      });
      setSelectedExtra('none');
    } else if (selectedExtra === 'noBall') {
      // 1 penalty no-ball + runs scored off the bat
      onScoreBall({
        runsBat: runs,
        runsExtra: 1,
        extraType: 'noBall',
        isBoundary: runs === 4,
        isSix: runs === 6,
        isWicket: false,
      });
      setSelectedExtra('none');
    } else if (selectedExtra === 'bye' || selectedExtra === 'legBye') {
      onScoreBall({
        runsBat: 0,
        runsExtra: runs,
        extraType: selectedExtra,
        isBoundary: runs === 4,
        isSix: false,
        isWicket: false,
      });
      setSelectedExtra('none');
    }
  };

  const toggleExtra = (type: ExtraType) => {
    if (selectedExtra === type) {
      setSelectedExtra('none');
    } else {
      setSelectedExtra(type);
    }
  };

  return (
    <View style={styles.container}>
      {/* Selected Extra Notice if active */}
      {selectedExtra !== 'none' && (
        <View style={styles.extraBanner}>
          <Text style={styles.extraBannerText}>
            EXTRA ARMED:{' '}
            <Text style={styles.extraBannerType}>
              +{selectedExtra === 'wide'
                ? 'WIDE'
                : selectedExtra === 'noBall'
                ? 'NO BALL'
                : selectedExtra === 'legBye'
                ? 'LEG BYE'
                : 'BYE'}
            </Text>{' '}
            — Tap runs (0-6) to record ball
          </Text>
          <TouchableOpacity onPress={() => setSelectedExtra('none')} style={styles.cancelExtraBtn}>
            <Text style={styles.cancelExtraText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Runs Keypad (Ergonomic 56dp height minimum for outdoor thumb scoring) */}
      <View style={styles.runGrid}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={[styles.runBtn, styles.dotBtn]}
          onPress={() => handleRunPress(0)}
        >
          <Text style={styles.runBtnText}>0</Text>
          <Text style={styles.runBtnSub}>DOT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.runBtn}
          onPress={() => handleRunPress(1)}
        >
          <Text style={styles.runBtnText}>1</Text>
          <Text style={styles.runBtnSub}>RUN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.runBtn}
          onPress={() => handleRunPress(2)}
        >
          <Text style={styles.runBtnText}>2</Text>
          <Text style={styles.runBtnSub}>RUNS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.runBtn}
          onPress={() => handleRunPress(3)}
        >
          <Text style={styles.runBtnText}>3</Text>
          <Text style={styles.runBtnSub}>RUNS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={[styles.runBtn, styles.fourBtn]}
          onPress={() => handleRunPress(4)}
        >
          <Text style={[styles.runBtnText, styles.fourText]}>4</Text>
          <Text style={[styles.runBtnSub, styles.fourSub]}>FOUR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={[styles.runBtn, styles.sixBtn]}
          onPress={() => handleRunPress(6)}
        >
          <Text style={[styles.runBtnText, styles.sixText]}>6</Text>
          <Text style={[styles.runBtnSub, styles.sixSub]}>SIX</Text>
        </TouchableOpacity>
      </View>

      {/* Extras Selection Row (+Wide, +NoBall, +Bye, +LegBye) */}
      <View style={styles.extrasRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={[styles.extraBtn, selectedExtra === 'wide' && styles.extraBtnActive]}
          onPress={() => toggleExtra('wide')}
        >
          <Text style={[styles.extraBtnText, selectedExtra === 'wide' && styles.extraBtnTextActive]}>
            +Wide
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={[styles.extraBtn, selectedExtra === 'noBall' && styles.extraBtnActive]}
          onPress={() => toggleExtra('noBall')}
        >
          <Text style={[styles.extraBtnText, selectedExtra === 'noBall' && styles.extraBtnTextActive]}>
            +NoBall
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={[styles.extraBtn, selectedExtra === 'bye' && styles.extraBtnActive]}
          onPress={() => toggleExtra('bye')}
        >
          <Text style={[styles.extraBtnText, selectedExtra === 'bye' && styles.extraBtnTextActive]}>
            +Bye
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={[styles.extraBtn, selectedExtra === 'legBye' && styles.extraBtnActive]}
          onPress={() => toggleExtra('legBye')}
        >
          <Text style={[styles.extraBtnText, selectedExtra === 'legBye' && styles.extraBtnTextActive]}>
            +LegBye
          </Text>
        </TouchableOpacity>
      </View>

      {/* Primary Actions Row: Wicket Modal, Swap Strike, 1-Tap Undo */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.wicketBtn}
          onPress={onOpenWicketModal}
        >
          <Ionicons name="flame" size={18} color="#FFFFFF" />
          <Text style={styles.wicketBtnText}>WICKET (OUT)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.swapBtn}
          onPress={onSwapStrike}
        >
          <Ionicons name="swap-horizontal" size={16} color="#334155" />
          <Text style={styles.swapBtnText}>Swap</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.undoBtn}
          onPress={onUndo}
        >
          <Ionicons name="arrow-undo" size={16} color="#FFFFFF" />
          <Text style={styles.undoBtnText}>Undo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  extraBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  extraBannerText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  extraBannerType: {
    fontWeight: '900',
    color: '#B45309',
  },
  cancelExtraBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FDE68A',
    borderRadius: 4,
  },
  cancelExtraText: {
    color: '#B45309',
    fontWeight: '800',
    fontSize: 11,
  },
  runGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  runBtn: {
    width: '31%',
    minHeight: 56, // Ergonomic 56dp minimum touch target
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
  },
  dotBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  fourBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
  },
  fourText: {
    color: '#059669',
  },
  fourSub: {
    color: '#059669',
  },
  sixBtn: {
    backgroundColor: '#FAF5FF',
    borderColor: '#C084FC',
  },
  sixText: {
    color: '#7E22CE',
  },
  sixSub: {
    color: '#7E22CE',
  },
  runBtnText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  runBtnSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  extrasRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    justifyContent: 'space-between',
  },
  extraBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  extraBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  extraBtnTextActive: {
    color: '#B45309',
    fontWeight: '900',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  wicketBtn: {
    flex: 2.2,
    minHeight: 56, // 56dp ergonomic height
    backgroundColor: Colors.accentRed,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: Colors.accentRed,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  wicketBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  swapBtn: {
    flex: 1,
    minHeight: 56, // 56dp ergonomic height
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  swapBtnText: {
    color: '#1E293B',
    fontSize: 11,
    fontWeight: '800',
  },
  undoBtn: {
    flex: 1,
    minHeight: 56, // 56dp ergonomic height
    backgroundColor: '#0F172A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  undoBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
