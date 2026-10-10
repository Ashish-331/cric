import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Player, BowlerStats } from '../../types/cricket';
import { Colors } from '../../utils/colors';

interface BowlerSelectModalProps {
  visible: boolean;
  onClose: () => void;
  bowlingTeamPlayers: Player[];
  currentBowlerId?: string;
  bowlerStats: Record<string, BowlerStats>;
  onSelectBowler: (playerId: string) => void;
  maxOversPerBowler?: number;
  totalOvers?: number;
}

export const BowlerSelectModal: React.FC<BowlerSelectModalProps> = ({
  visible,
  onClose,
  bowlingTeamPlayers,
  currentBowlerId,
  bowlerStats,
  onSelectBowler,
  maxOversPerBowler,
  totalOvers = 20,
}) => {
  const maxAllowedOvers = maxOversPerBowler ?? (totalOvers ? Math.ceil(totalOvers / 5) : 4);

  const handleSelect = (playerId: string) => {
    onSelectBowler(playerId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Select Bowler for this Over</Text>
          <Text style={styles.subtitle}>
            Rules note: Bowlers cannot bowl consecutive overs (Quota limit: {maxAllowedOvers} ov per bowler).
          </Text>

          <FlatList
            data={bowlingTeamPlayers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isCurrent = item.id === currentBowlerId;
              const stats = bowlerStats[item.id];
              const completedOvers = stats ? Math.floor(stats.legalBalls / 6) : 0;
              const hasCompletedQuota = completedOvers >= maxAllowedOvers;
              const isDisabled = isCurrent || hasCompletedQuota;

              return (
                <TouchableOpacity
                  disabled={isDisabled}
                  style={[
                    styles.playerItem,
                    isDisabled && styles.playerItemDisabled,
                  ]}
                  onPress={() => handleSelect(item.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.playerName,
                        isDisabled && styles.playerNameDisabled,
                      ]}
                    >
                      {item.name}
                      {isCurrent
                        ? ' (Just Bowled)'
                        : hasCompletedQuota
                        ? ` (Quota: ${stats?.oversFormatted}/${maxAllowedOvers} ov)`
                        : ''}
                    </Text>
                    <Text style={styles.playerRole}>
                      {item.bowlingStyle || item.role.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    <Text style={styles.statsFigures}>
                      {stats ? `${stats.oversFormatted} ov • ${stats.wickets} wkt` : 'Yet to bowl'}
                    </Text>
                    {stats && (
                      <Text style={styles.statsEcon}>Econ: {stats.economy}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Dismiss</Text>
          </TouchableOpacity>
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
    maxHeight: '75%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  listContent: {
    paddingBottom: 12,
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  playerItemDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F5F9',
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  playerNameDisabled: {
    color: '#94A3B8',
  },
  playerRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statsCol: {
    alignItems: 'flex-end',
  },
  statsFigures: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  statsEcon: {
    fontSize: 11,
    color: '#64748B',
  },
  closeBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
