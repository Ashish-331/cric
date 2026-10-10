import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TossDecision } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { CricketHaptics } from '../../services/haptics';

interface InteractiveCoinTossModalProps {
  visible: boolean;
  team1Name: string;
  team2Name: string;
  team1Id: string;
  team2Id: string;
  onConfirmToss: (tossWinnerId: string, decision: TossDecision) => void;
  onClose: () => void;
}

export const InteractiveCoinTossModal: React.FC<InteractiveCoinTossModalProps> = ({
  visible,
  team1Name,
  team2Name,
  team1Id,
  team2Id,
  onConfirmToss,
  onClose,
}) => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinResult, setCoinResult] = useState<'heads' | 'tails' | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>(team1Id);
  const [decision, setDecision] = useState<TossDecision>('bat');

  const spinAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setSelectedWinnerId(team1Id);
      setDecision('bat');
      setCoinResult(null);
      setIsFlipping(false);
      spinAnim.setValue(0);
    }
  }, [visible, team1Id]);

  const handleFlipCoin = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setCoinResult(null);
    CricketHaptics.toggle();

    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 8, // 8 full spins
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      const isHeads = Math.random() >= 0.5;
      const res = isHeads ? 'heads' : 'tails';
      setCoinResult(res);
      // Heads => Team 1 wins toss, Tails => Team 2 wins toss
      const winnerId = isHeads ? team1Id : team2Id;
      setSelectedWinnerId(winnerId);
      setIsFlipping(false);
      CricketHaptics.milestone();
    });
  };

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 8],
    outputRange: ['0deg', '2880deg'],
  });

  const winnerName = selectedWinnerId === team1Id ? team1Name : team2Name;

  const handleConfirm = () => {
    onConfirmToss(selectedWinnerId, decision);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Official Coin Toss</Text>
              <Text style={styles.subtitle}>{team1Name} vs {team2Name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Animated Coin */}
          <View style={styles.coinArea}>
            <Animated.View
              style={[
                styles.coin,
                { transform: [{ rotateY: spinInterpolate }] },
              ]}
            >
              <View style={styles.coinInner}>
                <MaterialCommunityIcons
                  name={coinResult === 'tails' ? 'cricket' : 'shield-crown'}
                  size={42}
                  color="#FFB300"
                />
                <Text style={styles.coinLabel}>
                  {isFlipping
                    ? '...'
                    : coinResult
                    ? coinResult.toUpperCase()
                    : 'TAP TO FLIP'}
                </Text>
              </View>
            </Animated.View>

            <TouchableOpacity
              style={[styles.flipBtn, isFlipping && styles.flipBtnDisabled]}
              disabled={isFlipping}
              onPress={handleFlipCoin}
            >
              <Ionicons name="sync" size={16} color="#070D1E" />
              <Text style={styles.flipBtnText}>
                {isFlipping ? 'Spinning in the Air...' : 'Flip Stadium Coin'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Toss Winner Selector */}
          <Text style={styles.sectionLabel}>Toss Winner</Text>
          <View style={styles.winnerRow}>
            <TouchableOpacity
              style={[styles.winnerChip, selectedWinnerId === team1Id && styles.winnerChipActive]}
              onPress={() => setSelectedWinnerId(team1Id)}
            >
              <Text style={[styles.winnerText, selectedWinnerId === team1Id && styles.winnerTextActive]}>
                {team1Name}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.winnerChip, selectedWinnerId === team2Id && styles.winnerChipActive]}
              onPress={() => setSelectedWinnerId(team2Id)}
            >
              <Text style={[styles.winnerText, selectedWinnerId === team2Id && styles.winnerTextActive]}>
                {team2Name}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Election: Bat vs Bowl */}
          <Text style={styles.sectionLabel}>{winnerName} Elected To</Text>
          <View style={styles.electionRow}>
            <TouchableOpacity
              style={[styles.electionBtn, decision === 'bat' && styles.electionBtnActive]}
              onPress={() => setDecision('bat')}
            >
              <Text style={[styles.electionText, decision === 'bat' && styles.electionTextActive]}>
                🏏 BAT FIRST
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.electionBtn, decision === 'bowl' && styles.electionBtnActive]}
              onPress={() => setDecision('bowl')}
            >
              <Text style={[styles.electionText, decision === 'bowl' && styles.electionTextActive]}>
                ⚾ BOWL FIRST
              </Text>
            </TouchableOpacity>
          </View>

          {/* Confirmation */}
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>
              CONFIRM: {winnerName} TO {decision.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 30, 0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0C142B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1E2C4F',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  coinArea: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  coin: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#1E2C4F',
    borderWidth: 4,
    borderColor: '#FFB300',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFB300',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  coinInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinLabel: {
    color: '#FFB300',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFB300',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  flipBtnDisabled: {
    opacity: 0.6,
  },
  flipBtnText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 6,
  },
  winnerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  winnerChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#121C38',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    alignItems: 'center',
  },
  winnerChipActive: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  winnerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  winnerTextActive: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  electionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  electionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#121C38',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    alignItems: 'center',
  },
  electionBtnActive: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  electionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
  },
  electionTextActive: {
    color: '#00E676',
    fontWeight: '900',
  },
  confirmBtn: {
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  confirmBtnText: {
    color: '#070D1E',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
