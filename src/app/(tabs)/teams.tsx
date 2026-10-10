import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Team, Player, PlayingRole } from '../../types/cricket';
import { Colors } from '../../utils/colors';

const COLOR_PRESETS = ['#004BA0', '#D32F2F', '#FBC02D', '#059669', '#7C3AED', '#EA580C'];

export default function TeamsScreen() {
  const {
    teams,
    saveTeam,
    createNewTeam,
    userProfile,
    joinRequests,
    sendJoinRequest,
    approveJoinRequest,
    declineJoinRequest,
  } = useCricket();

  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');

  // Automatically focus on active user's club upon user switching
  React.useEffect(() => {
    if (userProfile?.teamId && teams.some((t) => t.id === userProfile.teamId)) {
      setSelectedTeamId(userProfile.teamId);
    }
  }, [userProfile?.teamId, teams]);

  // Add Player Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<PlayingRole>('batter');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');

  // Register New Team Modal
  const [teamModalVisible, setTeamModalVisible] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShort, setNewTeamShort] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(COLOR_PRESETS[0]);

  const activeTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];

  // Check current user status with activeTeam
  const currentUserId = userProfile?.claimedPlayerId;
  const isCaptainOfActiveTeam =
    Boolean(activeTeam && (activeTeam.captainPlayerId === currentUserId || activeTeam.createdByUserId === userProfile?.id));

  const isMemberOfActiveTeam =
    Boolean(activeTeam && activeTeam.players.some((p) => p.id === currentUserId || p.name === userProfile?.name));

  // Pending join requests for this team
  const pendingRequestsForTeam = joinRequests.filter(
    (r) => r.teamId === activeTeam?.id && r.status === 'pending'
  );

  // Check if current user has an existing request for this team
  const hasUserRequested = joinRequests.some(
    (r) =>
      r.teamId === activeTeam?.id &&
      (r.playerId === currentUserId || r.playerName === userProfile?.name) &&
      r.status === 'pending'
  );

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !newTeamShort.trim()) {
      Alert.alert('Details Required', 'Please provide team name and short code (e.g. MUM)');
      return;
    }

    try {
      const created = await createNewTeam(newTeamName.trim(), newTeamShort.trim(), newTeamColor);
      setSelectedTeamId(created.id);
      setNewTeamName('');
      setNewTeamShort('');
      setTeamModalVisible(false);
      Alert.alert('Team Registered!', `You are now the Captain of ${created.name}.`);
    } catch (err: any) {
      Alert.alert('Creation Failed', err.message);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      Alert.alert('Name Required', 'Please enter player name');
      return;
    }
    if (!activeTeam) return;

    const newPlayer: Player = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newPlayerName.trim(),
      role: newPlayerRole,
      battingHand: 'right',
      phoneNumber: newPlayerPhone.trim() || undefined,
      bowlingStyle: newPlayerRole === 'bowler' ? 'fast-medium' : undefined,
    };

    const updatedTeam: Team = {
      ...activeTeam,
      players: [...activeTeam.players, newPlayer],
    };

    await saveTeam(updatedTeam);
    setNewPlayerName('');
    setNewPlayerPhone('');
    setModalVisible(false);
  };

  const handleRequestToJoin = async () => {
    if (!activeTeam) return;
    try {
      await sendJoinRequest(activeTeam.id);
      Alert.alert(
        'Request Sent! ⏳',
        `Your request to join ${activeTeam.name} has been sent to the Captain for approval.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleApprove = async (reqId: string, playerName: string) => {
    await approveJoinRequest(reqId);
    Alert.alert('Request Approved! ✅', `${playerName} has been added to ${activeTeam?.name} squad roster.`);
  };

  const handleDecline = async (reqId: string) => {
    await declineJoinRequest(reqId);
    Alert.alert('Declined', 'Join request was declined.');
  };

  return (
    <View style={styles.container}>
      {/* 1. Teams Switcher Header */}
      <View style={styles.topBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={teams}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.teamTabs}
          renderItem={({ item }) => {
            const isSelected = activeTeam?.id === item.id;
            return (
              <TouchableOpacity
                style={[styles.teamTab, isSelected && styles.teamTabActive]}
                onPress={() => setSelectedTeamId(item.id)}
              >
                <View style={[styles.teamIndicator, { backgroundColor: item.primaryColor }]} />
                <Text style={[styles.teamTabText, isSelected && styles.teamTabTextActive]}>
                  {item.shortName}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity
          style={styles.addTeamBtn}
          onPress={() => setTeamModalVisible(true)}
        >
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.addTeamText}>New Team</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Active Team Header Card */}
      {activeTeam && (
        <View style={[styles.teamHeaderCard, { borderLeftColor: activeTeam.primaryColor }]}>
          <View style={styles.teamTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.teamNameText}>{activeTeam.name}</Text>
              <Text style={styles.teamCodeText}>
                Code: {activeTeam.shortName} • {activeTeam.players.length} Registered Players
              </Text>
            </View>

            {isCaptainOfActiveTeam ? (
              <View style={styles.captainRoleBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#D97706" />
                <Text style={styles.captainRoleText}>You are Captain</Text>
              </View>
            ) : isMemberOfActiveTeam ? (
              <View style={styles.memberRoleBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.memberRoleText}>Squad Member</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.joinBtn, hasUserRequested && styles.joinBtnPending]}
                disabled={hasUserRequested}
                onPress={handleRequestToJoin}
              >
                <Ionicons
                  name={hasUserRequested ? 'time-outline' : 'person-add-outline'}
                  size={14}
                  color="#FFF"
                />
                <Text style={styles.joinBtnText}>
                  {hasUserRequested ? 'Request Pending' : 'Request to Join'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 3. Captain's Pending Join Requests Inbox */}
      {isCaptainOfActiveTeam && (
        <View style={styles.inboxSection}>
          <View style={styles.inboxHeader}>
            <View style={styles.inboxTitleRow}>
              <Ionicons name="mail-unread" size={18} color={Colors.accentAmber} />
              <Text style={styles.inboxTitle}>Captain's Join Requests Inbox</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{pendingRequestsForTeam.length} Pending</Text>
            </View>
          </View>

          {pendingRequestsForTeam.length > 0 ? (
            <View style={styles.requestsList}>
              {pendingRequestsForTeam.map((req) => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reqName}>{req.playerName}</Text>
                    <Text style={styles.reqDetails}>
                      {req.playerRole.toUpperCase()} • {req.playerPhone || 'Phone unverified'}
                    </Text>
                  </View>
                  <View style={styles.reqActions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(req.id, req.playerName)}
                    >
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Text style={styles.btnActionText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => handleDecline(req.id)}
                    >
                      <Ionicons name="close" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyInbox}>
              <Text style={styles.emptyInboxText}>No pending requests for {activeTeam?.name}.</Text>
            </View>
          )}
        </View>
      )}

      {/* 4. Squad Roster Header & Add Player */}
      <View style={styles.rosterBar}>
        <Text style={styles.rosterTitle}>Official Squad Roster</Text>
        {isCaptainOfActiveTeam && (
          <TouchableOpacity
            style={styles.addPlayerSmallBtn}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add-circle" size={16} color={Colors.primary} />
            <Text style={styles.addPlayerSmallText}>Direct Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 5. Squad Players List */}
      <FlatList
        data={activeTeam?.players || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.playersList}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.playerCard}
            onPress={() => router.push(`/player/${item.id}`)}
          >
            <View style={styles.indexBox}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.pNameRow}>
                <Text style={styles.playerName}>{item.name}</Text>
                {item.isCaptain && <Text style={styles.tagCaptain}> (C)</Text>}
                {item.isWicketkeeper && <Text style={styles.tagWK}> (WK)</Text>}
              </View>
              <Text style={styles.playerRoleSub}>
                {(item.battingHand || 'right').toUpperCase()} HAND • {(item.role || 'batter').toUpperCase()}
                {item.bowlingStyle ? ` • ${item.bowlingStyle}` : ''}
              </Text>
            </View>

            <View style={styles.profileArrow}>
              <Text style={styles.viewStatsText}>Stats</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Register New Team Modal */}
      <Modal visible={teamModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Register New Cricket Club</Text>
            <Text style={styles.modalSub}>
              You will become the designated Captain and administrator of this team.
            </Text>

            <Text style={styles.fieldLabel}>Team Name</Text>
            <TextInput
              style={styles.input}
              value={newTeamName}
              onChangeText={setNewTeamName}
              placeholder="e.g. Deccan Gladiators"
            />

            <Text style={styles.fieldLabel}>Short Code (3-4 Letters)</Text>
            <TextInput
              style={styles.input}
              value={newTeamShort}
              onChangeText={setNewTeamShort}
              placeholder="e.g. DEC"
              maxLength={4}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Team Primary Color</Text>
            <View style={styles.colorRow}>
              {COLOR_PRESETS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    newTeamColor === c && styles.colorCircleActive,
                  ]}
                  onPress={() => setNewTeamColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setTeamModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreateTeam}>
                <Text style={styles.createBtnText}>Register Team</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Player Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Add Player to {activeTeam?.shortName}</Text>

            <Text style={styles.fieldLabel}>Player Name</Text>
            <TextInput
              style={styles.input}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              placeholder="e.g. Jasprit Bumrah"
            />

            <Text style={styles.fieldLabel}>Mobile Number (Optional)</Text>
            <TextInput
              style={styles.input}
              value={newPlayerPhone}
              onChangeText={setNewPlayerPhone}
              placeholder="e.g. +91 98765 43210"
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Playing Role</Text>
            <View style={styles.roleGrid}>
              {(['batter', 'bowler', 'all-rounder', 'wicketkeeper'] as PlayingRole[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, newPlayerRole === r && styles.roleChipActive]}
                  onPress={() => setNewPlayerRole(r)}
                >
                  <Text style={[styles.roleChipText, newPlayerRole === r && styles.roleChipTextActive]}>
                    {r.replace('-', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleAddPlayer}>
                <Text style={styles.createBtnText}>Add to Squad</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  teamTabs: {
    gap: 8,
  },
  teamTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  teamTabActive: {
    backgroundColor: '#0F172A',
  },
  teamIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  teamTabTextActive: {
    color: '#FFFFFF',
  },
  addTeamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addTeamText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  teamHeaderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  teamNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  teamCodeText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  captainRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  captainRoleText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
  },
  memberRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  memberRoleText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pitchGreen,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  joinBtnPending: {
    backgroundColor: '#94A3B8',
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  inboxSection: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inboxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inboxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  countBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  countText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  requestsList: {
    gap: 6,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    gap: 8,
  },
  reqName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  reqDetails: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  reqActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pitchGreen,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  btnActionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  declineBtn: {
    backgroundColor: '#FEE2E2',
    padding: 5,
    borderRadius: 6,
  },
  emptyInbox: {
    paddingVertical: 4,
  },
  emptyInboxText: {
    fontSize: 12,
    color: '#92400E',
    fontStyle: 'italic',
  },
  rosterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  rosterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
  },
  addPlayerSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPlayerSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  playersList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
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
  indexBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  pNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 14,
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
  playerRoleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  profileArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewStatsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  roleChipActive: {
    backgroundColor: Colors.primary,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  roleChipTextActive: {
    color: '#FFF',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontWeight: '700',
    color: '#64748B',
  },
  createBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  createBtnText: {
    fontWeight: '800',
    color: '#FFF',
  },
});
