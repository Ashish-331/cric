import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Colors } from '../../utils/colors';
import { PlayingRole } from '../../types/cricket';
import { CricketHaptics } from '../../services/haptics';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    teams,
    userProfile,
    joinRequests,
    sendJoinRequest,
    approveJoinRequest,
    declineJoinRequest,
    addGhostPlayerToTeam,
  } = useCricket();

  const [isGhostModalVisible, setIsGhostModalVisible] = useState(false);
  const [ghostName, setGhostName] = useState('');
  const [ghostPhone, setGhostPhone] = useState('');
  const [ghostRole, setGhostRole] = useState<PlayingRole>('all-rounder');
  const [isAddingGhost, setIsAddingGhost] = useState(false);

  const team = teams.find((t) => t.id === id);

  if (!team) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Team not found</Text>
      </View>
    );
  }

  const currentUserId = userProfile?.claimedPlayerId;
  const isCaptain = team.captainPlayerId === currentUserId || team.createdByUserId === userProfile?.id;
  const isMember = team.players.some((p) => p.id === currentUserId || p.name === userProfile?.name);

  const pendingRequests = joinRequests.filter((r) => r.teamId === team.id && r.status === 'pending');
  const hasRequested = joinRequests.some(
    (r) =>
      r.teamId === team.id &&
      (r.playerId === currentUserId || r.playerName === userProfile?.name) &&
      r.status === 'pending'
  );

  const handleRequestToJoin = async () => {
    try {
      await sendJoinRequest(team.id);
      Alert.alert('Request Sent!', `Your request to join ${team.name} has been sent to the Captain.`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleAddGhostPlayer = async () => {
    if (!ghostName.trim()) {
      Alert.alert('Missing Name', 'Please enter the player name.');
      return;
    }
    if (!ghostPhone.trim()) {
      Alert.alert('Missing Mobile Number', 'Please enter a mobile number so the player can claim their profile & career stats later.');
      return;
    }

    try {
      setIsAddingGhost(true);
      CricketHaptics.milestone();
      await addGhostPlayerToTeam(team.id, ghostName.trim(), ghostPhone.trim(), ghostRole);
      Alert.alert(
        'Player Added! 👻',
        `${ghostName.trim()} has been added to ${team.name}. When they sign in with mobile number "${ghostPhone.trim()}", all match performances and stats will be linked automatically!`
      );
      setGhostName('');
      setGhostPhone('');
      setIsGhostModalVisible(false);
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Error', err.message || 'Failed to add ghost player.');
    } finally {
      setIsAddingGhost(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={[styles.headerBanner, { borderLeftColor: team.primaryColor }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamTitle}>{team.name}</Text>
            <Text style={styles.teamSub}>
              Code: {team.shortName} • {team.players.length} Squad Members
            </Text>
          </View>

          {isCaptain ? (
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>Captain</Text>
            </View>
          ) : isMember ? (
            <View style={[styles.roleTag, { backgroundColor: '#ECFDF5' }]}>
              <Text style={[styles.roleTagText, { color: '#047857' }]}>Squad Member</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.joinBtn, hasRequested && styles.joinBtnPending]}
              disabled={hasRequested}
              onPress={handleRequestToJoin}
            >
              <Text style={styles.joinBtnText}>{hasRequested ? 'Pending ⏳' : 'Request to Join'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Captain's Pending Requests Box */}
      {isCaptain && pendingRequests.length > 0 && (
        <View style={styles.inboxCard}>
          <Text style={styles.inboxTitle}>Pending Join Requests ({pendingRequests.length})</Text>
          {pendingRequests.map((req) => (
            <View key={req.id} style={styles.reqRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reqName}>{req.playerName}</Text>
                <Text style={styles.reqSub}>{req.playerRole.toUpperCase()} • {req.playerPhone || 'Guest'}</Text>
              </View>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => approveJoinRequest(req.id)}
              >
                <Text style={styles.approveText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={() => declineJoinRequest(req.id)}
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Squad Header Row */}
      <View style={styles.squadHeaderRow}>
        <Text style={styles.squadHeading}>Official Squad Roster ({team.players.length})</Text>
        {(isCaptain || userProfile?.role === 'organizer' || userProfile?.isVerified) && (
          <TouchableOpacity
            style={styles.addGhostBtn}
            onPress={() => {
              CricketHaptics.toggle();
              setIsGhostModalVisible(true);
            }}
          >
            <Ionicons name="person-add" size={13} color="#FFF" />
            <Text style={styles.addGhostBtnText}>Add Ghost Player</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={team.players}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.playerCard}
            onPress={() => router.push(`/player/${item.id}`)}
          >
            <View style={styles.numBox}>
              <Text style={styles.numText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.playerName}>{item.name}</Text>
                {item.isCaptain && <Text style={styles.tagCaptain}> (C)</Text>}
                {item.isWicketkeeper && <Text style={styles.tagWK}> (WK)</Text>}
                {item.isGuest && (
                  <View style={styles.ghostTag}>
                    <Text style={styles.ghostTagText}>GHOST</Text>
                  </View>
                )}
              </View>
              <Text style={styles.roleSub}>
                {(item.battingHand || 'right').toUpperCase()} HAND • {(item.role || 'batter').toUpperCase()}
                {item.bowlingStyle ? ` • ${item.bowlingStyle}` : ''}
              </Text>
              {item.phoneNumber ? (
                <Text style={styles.phoneMeta}>📱 {item.phoneNumber}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      />

      {/* Add Ghost Player Modal */}
      <Modal
        visible={isGhostModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGhostModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add Ghost Player 👻</Text>
                <Text style={styles.modalSub}>
                  Add teammate without app account. Performance stats auto-link by phone!
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsGhostModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Player Full Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Jasprit Bumrah"
              placeholderTextColor="#94A3B8"
              value={ghostName}
              onChangeText={setGhostName}
            />

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Mobile Phone Number *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={ghostPhone}
              onChangeText={setGhostPhone}
            />

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Playing Role</Text>
            <View style={styles.roleChipsRow}>
              {(['batter', 'bowler', 'all-rounder', 'wicketkeeper'] as PlayingRole[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleChip,
                    ghostRole === r && styles.roleChipSelected,
                  ]}
                  onPress={() => {
                    CricketHaptics.toggle();
                    setGhostRole(r);
                  }}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      ghostRole === r && styles.roleChipTextSelected,
                    ]}
                  >
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setIsGhostModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalBtn, isAddingGhost && { opacity: 0.6 }]}
                disabled={isAddingGhost}
                onPress={handleAddGhostPlayer}
              >
                <Text style={styles.saveModalBtnText}>
                  {isAddingGhost ? 'Adding...' : 'Add Player'}
                </Text>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: '#64748B',
    fontSize: 14,
  },
  headerBanner: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderLeftWidth: 6,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  teamSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  roleTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleTagText: {
    color: '#B45309',
    fontWeight: '800',
    fontSize: 11,
  },
  joinBtn: {
    backgroundColor: Colors.pitchGreen,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinBtnPending: {
    backgroundColor: '#94A3B8',
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inboxCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inboxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 8,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    gap: 8,
  },
  reqName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  reqSub: {
    fontSize: 11,
    color: '#64748B',
  },
  approveBtn: {
    backgroundColor: Colors.pitchGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  approveText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  declineBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  declineText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  squadHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  numBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  tagCaptain: {
    color: Colors.accentAmber,
    fontWeight: '800',
    fontSize: 12,
  },
  tagWK: {
    color: Colors.pitchGreen,
    fontWeight: '800',
    fontSize: 12,
  },
  roleSub: {
    fontSize: 11,
    color: '#64748B',
  },
  squadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  addGhostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  addGhostBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  ghostTag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  ghostTagText: {
    color: '#7E22CE',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  phoneMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  roleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleChipSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  roleChipTextSelected: {
    color: '#FFFFFF',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelModalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelModalBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  saveModalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#00E676',
  },
  saveModalBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
});
