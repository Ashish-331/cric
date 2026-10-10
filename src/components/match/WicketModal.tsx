import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { DismissalType, Player } from '../../types/cricket';
import { Colors } from '../../utils/colors';

interface WicketModalProps {
  visible: boolean;
  onClose: () => void;
  striker?: Player;
  nonStriker?: Player;
  bowlingTeamPlayers: Player[];
  isFreeHit?: boolean;
  onConfirmWicket: (params: {
    dismissalType: DismissalType;
    dismissedPlayerId: string;
    fielderId?: string;
    runsBat: number;
  }) => void;
}

const DISMISSAL_OPTIONS: { type: DismissalType; label: string; needsFielder?: boolean }[] = [
  { type: 'bowled', label: 'Bowled' },
  { type: 'caught', label: 'Caught', needsFielder: true },
  { type: 'caught_and_bowled', label: 'Caught & Bowled' },
  { type: 'lbw', label: 'LBW' },
  { type: 'run_out', label: 'Run Out', needsFielder: true },
  { type: 'stumped', label: 'Stumped', needsFielder: true },
  { type: 'hit_wicket', label: 'Hit Wicket' },
  { type: 'retired_hurt', label: 'Retired Hurt' },
  { type: 'retired_out', label: 'Retired Out' },
];

export const WicketModal: React.FC<WicketModalProps> = ({
  visible,
  onClose,
  striker,
  nonStriker,
  bowlingTeamPlayers,
  isFreeHit = false,
  onConfirmWicket,
}) => {
  const [selectedType, setSelectedType] = useState<DismissalType>(isFreeHit ? 'run_out' : 'bowled');
  const [dismissedId, setDismissedId] = useState<string>(striker?.id || '');
  const [selectedFielderId, setSelectedFielderId] = useState<string | undefined>(undefined);
  const [runsCompleted, setRunsCompleted] = useState<number>(0);

  React.useEffect(() => {
    if (visible) {
      setSelectedType(isFreeHit ? 'run_out' : 'bowled');
      setDismissedId(striker?.id || '');
      setSelectedFielderId(undefined);
      setRunsCompleted(0);
    }
  }, [visible, isFreeHit, striker?.id]);

  const currentOption = DISMISSAL_OPTIONS.find((o) => o.type === selectedType);
  const requiresFielder = currentOption?.needsFielder ?? false;

  const handleConfirm = () => {
    onConfirmWicket({
      dismissalType: selectedType,
      dismissedPlayerId: dismissedId || striker?.id || '',
      fielderId: requiresFielder ? selectedFielderId : undefined,
      runsBat: runsCompleted,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Record Dismissal</Text>

          {isFreeHit && (
            <View style={styles.freeHitBanner}>
              <Text style={styles.freeHitBannerTitle}>⚡ FREE HIT DELIVERY</Text>
              <Text style={styles.freeHitBannerText}>
                Per ICC / MCC Law 21.19, batsman cannot be out Bowled, Caught, LBW, Stumped, or Hit Wicket. Only Run Out or Retired Out allowed.
              </Text>
            </View>
          )}

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* 1. Dismissal Type */}
            <Text style={styles.sectionTitle}>Dismissal Method</Text>
            <View style={styles.grid}>
              {DISMISSAL_OPTIONS.map((item) => {
                const isDisallowed = isFreeHit && !['run_out', 'retired_hurt', 'retired_out'].includes(item.type);
                return (
                  <TouchableOpacity
                    key={item.type}
                    disabled={isDisallowed}
                    style={[
                      styles.typeBtn,
                      selectedType === item.type && styles.typeBtnActive,
                      isDisallowed && styles.typeBtnDisabled,
                    ]}
                    onPress={() => !isDisallowed && setSelectedType(item.type)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        selectedType === item.type && styles.typeBtnTextActive,
                        isDisallowed && styles.typeBtnTextDisabled,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2. Dismissed Batter */}
            <Text style={styles.sectionTitle}>Dismissed Batsman</Text>
            <View style={styles.batterChoiceRow}>
              {striker && (
                <TouchableOpacity
                  style={[
                    styles.batterBtn,
                    dismissedId === striker.id && styles.batterBtnActive,
                  ]}
                  onPress={() => setDismissedId(striker.id)}
                >
                  <Text style={styles.roleSub}>STRIKER</Text>
                  <Text
                    style={[
                      styles.batterName,
                      dismissedId === striker.id && styles.batterNameActive,
                    ]}
                  >
                    {striker.name}
                  </Text>
                </TouchableOpacity>
              )}

              {nonStriker && (
                <TouchableOpacity
                  style={[
                    styles.batterBtn,
                    dismissedId === nonStriker.id && styles.batterBtnActive,
                  ]}
                  onPress={() => setDismissedId(nonStriker.id)}
                >
                  <Text style={styles.roleSub}>NON-STRIKER</Text>
                  <Text
                    style={[
                      styles.batterName,
                      dismissedId === nonStriker.id && styles.batterNameActive,
                    ]}
                  >
                    {nonStriker.name}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 3. Fielder attribution (if caught, run out, stumped) */}
            {requiresFielder && (
              <>
                <Text style={styles.sectionTitle}>Fielder Involved (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fielderScroll}>
                  {bowlingTeamPlayers.map((player) => (
                    <TouchableOpacity
                      key={player.id}
                      style={[
                        styles.fielderPill,
                        selectedFielderId === player.id && styles.fielderPillActive,
                      ]}
                      onPress={() =>
                        setSelectedFielderId(selectedFielderId === player.id ? undefined : player.id)
                      }
                    >
                      <Text
                        style={[
                          styles.fielderPillText,
                          selectedFielderId === player.id && styles.fielderPillTextActive,
                        ]}
                      >
                        {player.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* 4. Runs Completed if Run Out */}
            {selectedType === 'run_out' && (
              <>
                <Text style={styles.sectionTitle}>Runs Completed Before Run Out</Text>
                <View style={styles.runsRow}>
                  {[0, 1, 2, 3].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.runPill,
                        runsCompleted === r && styles.runPillActive,
                      ]}
                      onPress={() => setRunsCompleted(r)}
                    >
                      <Text
                        style={[
                          styles.runPillText,
                          runsCompleted === r && styles.runPillTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm Wicket</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  scrollArea: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeBtnActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  typeBtnTextActive: {
    color: '#DC2626',
    fontWeight: '800',
  },
  batterChoiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  batterBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  batterBtnActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  roleSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  batterName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  batterNameActive: {
    color: '#DC2626',
  },
  fielderScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fielderPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fielderPillActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  fielderPillText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  fielderPillTextActive: {
    color: '#0369A1',
    fontWeight: '700',
  },
  runsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  runPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  runPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  runPillText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  runPillTextActive: {
    color: '#FFF',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.accentRed,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  freeHitBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  freeHitBannerTitle: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  freeHitBannerText: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  typeBtnDisabled: {
    opacity: 0.35,
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
  typeBtnTextDisabled: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
});

