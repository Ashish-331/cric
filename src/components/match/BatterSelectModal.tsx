import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Player, BatterStats } from '../../types/cricket';
import { Colors } from '../../utils/colors';

interface BatterSelectModalProps {
  visible: boolean;
  onClose: () => void;
  battingTeamPlayers: Player[];
  batterStats: Record<string, BatterStats>;
  currentStrikerId?: string;
  currentNonStrikerId?: string;
  slot: 'striker' | 'nonStriker';
  onSelectBatter: (playerId: string) => void;
}

export const BatterSelectModal: React.FC<BatterSelectModalProps> = ({
  visible,
  onClose,
  battingTeamPlayers,
  batterStats,
  currentStrikerId,
  currentNonStrikerId,
  slot,
  onSelectBatter,
}) => {
  const handleSelect = (playerId: string) => {
    onSelectBatter(playerId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>
            Select Incoming {slot === 'striker' ? 'Striker' : 'Non-Striker'}
          </Text>
          <Text style={styles.subtitle}>
            Choose a player from the batting team who has not been dismissed yet.
          </Text>

          <FlatList
            data={battingTeamPlayers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isAlreadyAtCrease =
                item.id === currentStrikerId || item.id === currentNonStrikerId;
              const stats = batterStats[item.id];
              const isOut = stats?.isOut ?? false;
              const isUnavailable = isAlreadyAtCrease || isOut;

              return (
                <TouchableOpacity
                  disabled={isUnavailable}
                  style={[
                    styles.playerItem,
                    isUnavailable && styles.playerItemDisabled,
                  ]}
                  onPress={() => handleSelect(item.id)}
                >
                  <View>
                    <Text
                      style={[
                        styles.playerName,
                        isUnavailable && styles.playerNameDisabled,
                      ]}
                    >
                      {item.name} {isOut ? '(Out)' : isAlreadyAtCrease ? '(On Crease)' : ''}
                    </Text>
                    <Text style={styles.playerRole}>
                      {(item.battingHand || 'right').toUpperCase()} HAND • {(item.role || 'batter').toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    {stats ? (
                      <Text style={styles.statsRuns}>
                        {stats.runs} ({stats.ballsFaced})
                      </Text>
                    ) : (
                      <Text style={styles.statsYetToBat}>Yet to bat</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cancel</Text>
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
    opacity: 0.45,
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
  statsRuns: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.pitchGreen,
  },
  statsYetToBat: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
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
