import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Colors } from '../../utils/colors';
import { PlayingRole, BattingHand, BowlingStyle, Player, Team, PlayerSearchMatchResult } from '../../types/cricket';
import { CricketHaptics } from '../../services/haptics';
import { StatsRollupEngine } from '../../engine/statsRollupEngine';
import { PlayerIdentityService } from '../../services/playerIdentityService';

const ROLES: { key: PlayingRole; label: string }[] = [
  { key: 'batter', label: 'Batter' },
  { key: 'bowler', label: 'Bowler' },
  { key: 'all-rounder', label: 'All-Rounder' },
  { key: 'wicketkeeper', label: 'Wicketkeeper' },
];

const BOWLING_STYLES: { key: BowlingStyle; label: string }[] = [
  { key: 'fast', label: 'Fast' },
  { key: 'fast-medium', label: 'Fast-Medium' },
  { key: 'medium', label: 'Medium Pace' },
  { key: 'spin-off', label: 'Off Spin' },
  { key: 'spin-leg', label: 'Leg Spin' },
  { key: 'orthodox', label: 'Left-Arm Orthodox' },
];

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    teams,
    saveTeam,
    userProfile,
    joinRequests,
    sendJoinRequest,
    approveJoinRequest,
    declineJoinRequest,
  } = useCricket();

  const [isAddMemberModalVisible, setIsAddMemberModalVisible] = useState(false);

  // Search-First Member State
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<PlayerSearchMatchResult[]>([]);
  const [isSearchingMember, setIsSearchingMember] = useState(false);
  const [showManualMemberForm, setShowManualMemberForm] = useState(false);

  // New Member Form State
  const [playerName, setPlayerName] = useState('');
  const [playerRole, setPlayerRole] = useState<PlayingRole>('all-rounder');
  const [battingHand, setBattingHand] = useState<BattingHand>('right');
  const [bowlingStyle, setBowlingStyle] = useState<BowlingStyle>('fast-medium');
  const [playerPhone, setPlayerPhone] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [isMatchGuestOnly, setIsMatchGuestOnly] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  const team = teams.find((t) => t.id === id);

  if (!team) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Team not found</Text>
      </View>
    );
  }

  const currentUserId = userProfile?.id;
  const claimedPlayerId = userProfile?.claimedPlayerId;

  // Authorization check
  const isManagerOrOwner =
    team.createdByUserId === currentUserId ||
    team.managerUserId === currentUserId;

  const isCaptain =
    team.captainPlayerId === claimedPlayerId ||
    isManagerOrOwner;

  const isMember = team.players.some(
    (p) =>
      p.id === claimedPlayerId ||
      (userProfile?.phoneNumber && p.phoneNumber === userProfile.phoneNumber)
  );

  const pendingRequests = joinRequests.filter(
    (r) => r.teamId === team.id && r.status === 'pending'
  );

  const hasRequested = joinRequests.some(
    (r) =>
      r.teamId === team.id &&
      (r.playerId === claimedPlayerId || r.playerName === userProfile?.name) &&
      r.status === 'pending'
  );

  const handleRequestToJoin = async () => {
    try {
      CricketHaptics.toggle();
      await sendJoinRequest(team.id);
      Alert.alert(
        'Request Sent! ⏳',
        `Your request to join ${team.name} has been sent to the manager/captain.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSetCaptain = async (player: Player) => {
    if (!isCaptain && !isManagerOrOwner) return;
    Alert.alert(
      'Set Team Captain',
      `Appoint ${player.name} as the official default captain for ${team.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            CricketHaptics.milestone();
            const updatedPlayers = team.players.map((p) => ({
              ...p,
              isCaptain: p.id === player.id,
            }));

            const updatedTeam: Team = {
              ...team,
              captainPlayerId: player.id,
              captainName: player.name,
              players: updatedPlayers,
            };

            await saveTeam(updatedTeam);
            Alert.alert('Captain Appointed! 🏏', `${player.name} is now the captain.`);
          },
        },
      ]
    );
  };

  const handleRemovePlayer = (player: Player) => {
    if (!isCaptain && !isManagerOrOwner) return;
    Alert.alert(
      'Remove Member',
      `Remove ${player.name} from the active roster? (Historical scorecards and career statistics will not be deleted).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            CricketHaptics.wicket();
            const updatedPlayers = team.players.filter((p) => p.id !== player.id);
            const isRemovingCaptain = team.captainPlayerId === player.id;

            const updatedTeam: Team = {
              ...team,
              captainPlayerId: isRemovingCaptain ? undefined : team.captainPlayerId,
              captainName: isRemovingCaptain ? undefined : team.captainName,
              players: updatedPlayers,
            };

            await saveTeam(updatedTeam);
          },
        },
      ]
    );
  };

  const handleSearchMember = async (text: string) => {
    setMemberSearchQuery(text);
    if (!text.trim() || text.trim().length < 2) {
      setMemberSearchResults([]);
      return;
    }
    setIsSearchingMember(true);
    try {
      const results = await PlayerIdentityService.searchPlayerProfiles(text, userProfile?.id);
      setMemberSearchResults(results);
    } catch (e) {
      console.warn('Search member error:', e);
    } finally {
      setIsSearchingMember(false);
    }
  };

  const handleAddExistingMember = async (result: PlayerSearchMatchResult) => {
    if (team.players.some((p) => p.id === result.id)) {
      Alert.alert('Already on Roster', `${result.name} is already a member of this team.`);
      return;
    }

    try {
      setIsSubmittingMember(true);
      CricketHaptics.milestone();

      const newPlayer: Player = {
        id: result.id,
        name: result.name,
        role: result.role,
        battingHand: 'right',
        bowlingStyle: 'fast-medium',
        phoneNumber: result.phoneNumber,
        email: result.email,
        isGuest: !result.isClaimed,
        isVerified: Boolean(result.isClaimed || result.isRegisteredUser),
        isCaptain: team.players.length === 0,
        isWicketkeeper: result.role === 'wicketkeeper',
        careerStats: StatsRollupEngine.createEmptyCareerStats(),
        recentScores: [],
      };

      const updatedPlayers = [...team.players, newPlayer];
      const updatedTeam: Team = {
        ...team,
        captainPlayerId: team.captainPlayerId || (newPlayer.isCaptain ? newPlayer.id : undefined),
        captainName: team.captainName || (newPlayer.isCaptain ? newPlayer.name : undefined),
        players: updatedPlayers,
      };

      await saveTeam(updatedTeam);

      setMemberSearchQuery('');
      setMemberSearchResults([]);
      setShowManualMemberForm(false);
      setIsAddMemberModalVisible(false);

      Alert.alert(
        'Player Added! 🏏',
        `${newPlayer.name} has been added to ${team.name}.`
      );
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Error', err.message || 'Failed to add player.');
    } finally {
      setIsSubmittingMember(false);
    }
  };

  const handleAddMemberSubmit = async () => {
    if (!playerName.trim()) {
      Alert.alert('Name Required', 'Please enter player full name.');
      return;
    }

    // Check duplicate membership
    const cleanName = playerName.trim().toLowerCase();
    const existing = team.players.find(
      (p) => p.name.toLowerCase() === cleanName
    );
    if (existing) {
      Alert.alert(
        'Duplicate Member',
        `A player named "${existing.name}" is already on this team's roster.`
      );
      return;
    }

    try {
      setIsSubmittingMember(true);
      CricketHaptics.milestone();

      const newPlayer: Player = {
        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: playerName.trim(),
        role: playerRole,
        battingHand,
        bowlingStyle: playerRole === 'batter' ? undefined : bowlingStyle,
        phoneNumber: playerPhone.trim() || undefined,
        email: playerEmail.trim() || undefined,
        isGuest: true, // unclaimed player profile
        isMatchGuest: isMatchGuestOnly,
        isCaptain: team.players.length === 0, // first player is default captain if roster was empty
        isWicketkeeper: playerRole === 'wicketkeeper',
        careerStats: StatsRollupEngine.createEmptyCareerStats(),
        recentScores: [],
      };

      const updatedPlayers = [...team.players, newPlayer];
      const updatedTeam: Team = {
        ...team,
        captainPlayerId: team.captainPlayerId || (newPlayer.isCaptain ? newPlayer.id : undefined),
        captainName: team.captainName || (newPlayer.isCaptain ? newPlayer.name : undefined),
        players: updatedPlayers,
      };

      await saveTeam(updatedTeam);

      // Reset form
      setPlayerName('');
      setPlayerPhone('');
      setPlayerEmail('');
      setShowManualMemberForm(false);
      setIsMatchGuestOnly(false);
      setIsAddMemberModalVisible(false);

      Alert.alert(
        'Member Added! 🏏',
        `${newPlayer.name} has been added to ${team.name} as a ${isMatchGuestOnly ? 'match-only guest' : 'permanent roster member'}.`
      );
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Error', err.message || 'Failed to add member.');
    } finally {
      setIsSubmittingMember(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={[styles.headerBanner, { borderLeftColor: team.primaryColor || '#004BA0' }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamTitle}>{team.name}</Text>
            <Text style={styles.teamSub}>
              {team.shortName} • {team.city || 'Club'} • {team.players.length} Members
            </Text>
            {team.captainName ? (
              <Text style={styles.headerCaptainText}>
                Captain: {team.captainName}
              </Text>
            ) : null}
          </View>

          {isManagerOrOwner ? (
            <View style={styles.roleTagManager}>
              <Text style={styles.roleTagManagerText}>Manager</Text>
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
              <Text style={styles.joinBtnText}>
                {hasRequested ? 'Pending ⏳' : 'Request to Join'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pending Join Requests Box (Manager/Captain Only) */}
      {(isManagerOrOwner || isCaptain) && pendingRequests.length > 0 && (
        <View style={styles.inboxCard}>
          <Text style={styles.inboxTitle}>
            Pending Join Requests ({pendingRequests.length})
          </Text>
          {pendingRequests.map((req) => (
            <View key={req.id} style={styles.reqRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reqName}>{req.playerName}</Text>
                <Text style={styles.reqSub}>{req.playerRole.toUpperCase()}</Text>
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

      {/* Roster Section Header */}
      <View style={styles.squadHeaderRow}>
        <View>
          <Text style={styles.squadHeading}>Official Team Sheet</Text>
          <Text style={styles.squadSubText}>
            {team.players.length} registered players on durable roster
          </Text>
        </View>

        {(isManagerOrOwner || isCaptain) && (
          <TouchableOpacity
            style={styles.addMemberBtn}
            onPress={() => {
              CricketHaptics.toggle();
              setIsAddMemberModalVisible(true);
            }}
          >
            <Ionicons name="person-add" size={14} color="#070D1E" />
            <Text style={styles.addMemberBtnText}>Add Player</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Roster Players List */}
      <FlatList
        data={team.players}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const isPlayerCaptain =
            item.isCaptain || item.id === team.captainPlayerId;

          return (
            <View style={styles.playerCard}>
              <View style={styles.numBox}>
                <Text style={styles.numText}>{index + 1}</Text>
              </View>

              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => router.push(`/player/${item.id}`)}
              >
                <View style={styles.nameRow}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  {isPlayerCaptain && (
                    <View style={styles.captainBadge}>
                      <Text style={styles.captainBadgeText}>C</Text>
                    </View>
                  )}
                  {item.isWicketkeeper && (
                    <View style={styles.wkBadge}>
                      <Text style={styles.wkBadgeText}>WK</Text>
                    </View>
                  )}
                  {item.isMatchGuest && (
                    <View style={styles.guestBadge}>
                      <Text style={styles.guestBadgeText}>GUEST</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.roleSub}>
                  {(item.battingHand || 'right').toUpperCase()} HAND •{' '}
                  {(item.role || 'batter').toUpperCase()}
                  {item.bowlingStyle ? ` • ${item.bowlingStyle}` : ''}
                </Text>

                {/* Privacy Rule: Never show phone numbers publicly; show masked only to manager */}
                {isManagerOrOwner && item.phoneNumber ? (
                  <Text style={styles.phoneMetaPrivate}>
                    🔒 Contact: {item.phoneNumber.slice(0, 4)}••••{item.phoneNumber.slice(-2)}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* Manager / Captain Actions */}
              {(isManagerOrOwner || isCaptain) && (
                <View style={styles.playerActionsCol}>
                  {!isPlayerCaptain && (
                    <TouchableOpacity
                      style={styles.captainActionBtn}
                      onPress={() => handleSetCaptain(item)}
                    >
                      <Text style={styles.captainActionText}>Make C</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.removeActionBtn}
                    onPress={() => handleRemovePlayer(item)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptySquadBox}>
            <MaterialCommunityIcons name="account-group-outline" size={44} color="#64748B" />
            <Text style={styles.emptySquadTitle}>No Members on Roster</Text>
            <Text style={styles.emptySquadSub}>
              Use "Add Player" above to build this team's roster.
            </Text>
          </View>
        }
      />

      {/* Add Player Profile Modal (Flow A3) */}
      <Modal visible={isAddMemberModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Player to Team Sheet</Text>
              <TouchableOpacity onPress={() => setIsAddMemberModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {!showManualMemberForm ? (
                <View>
                  <Text style={styles.phoneDisclaimer}>
                    Search registered profiles by email, phone, or name first to reuse existing stats.
                  </Text>

                  <TextInput
                    style={styles.formInput}
                    value={memberSearchQuery}
                    onChangeText={handleSearchMember}
                    placeholder="Search player by name, email, or phone..."
                    placeholderTextColor="#64748B"
                  />

                  {isSearchingMember && (
                    <Text style={[styles.phoneDisclaimer, { color: '#00E5FF', textAlign: 'center' }]}>
                      Searching player profiles...
                    </Text>
                  )}

                  {memberSearchResults.length > 0 && (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={styles.searchResultsLabel}>Matching Profiles Found</Text>
                      {memberSearchResults.map((p) => (
                        <View key={p.id} style={styles.playerSearchItem}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={styles.playerSearchName}>{p.name}</Text>
                              {p.isClaimed && (
                                <View style={styles.verifiedBadge}>
                                  <Ionicons name="checkmark-circle" size={12} color="#00E676" />
                                  <Text style={styles.verifiedBadgeText}>Verified</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.playerSearchMeta}>
                              {p.role} • {p.city || 'Club'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.selectExistingPlayerBtn}
                            onPress={() => handleAddExistingMember(p)}
                          >
                            <Text style={styles.selectExistingPlayerBtnText}>Add</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.manualPlayerToggleBtn}
                    onPress={() => setShowManualMemberForm(true)}
                  >
                    <Ionicons name="person-add-outline" size={16} color="#00E5FF" />
                    <Text style={styles.manualPlayerToggleText}>
                      Player not found? Create new player profile
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <TouchableOpacity
                    style={styles.backToSearchBtn}
                    onPress={() => setShowManualMemberForm(false)}
                  >
                    <Ionicons name="arrow-back" size={14} color="#00E5FF" />
                    <Text style={styles.backToSearchBtnText}>Back to search</Text>
                  </TouchableOpacity>

                  {/* Name */}
                  <Text style={styles.inputLabel}>Player Full Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={playerName}
                    onChangeText={setPlayerName}
                    placeholder="e.g. Suryakumar Yadav"
                    placeholderTextColor="#64748B"
                  />

                  {/* Playing Role */}
                  <Text style={styles.inputLabel}>Playing Role</Text>
                  <View style={styles.chipsRow}>
                    {ROLES.map((r) => (
                      <TouchableOpacity
                        key={r.key}
                        style={[
                          styles.chipBtn,
                          playerRole === r.key && styles.chipBtnActive,
                        ]}
                        onPress={() => setPlayerRole(r.key)}
                      >
                        <Text
                          style={[
                            styles.chipBtnText,
                            playerRole === r.key && styles.chipBtnTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Batting Hand */}
                  <Text style={styles.inputLabel}>Batting Hand</Text>
                  <View style={styles.chipsRow}>
                    <TouchableOpacity
                      style={[
                        styles.chipBtn,
                        battingHand === 'right' && styles.chipBtnActive,
                      ]}
                      onPress={() => setBattingHand('right')}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          battingHand === 'right' && styles.chipBtnTextActive,
                        ]}
                      >
                        Right-Handed
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.chipBtn,
                        battingHand === 'left' && styles.chipBtnActive,
                      ]}
                      onPress={() => setBattingHand('left')}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          battingHand === 'left' && styles.chipBtnTextActive,
                        ]}
                      >
                        Left-Handed
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bowling Style (If not pure batter) */}
                  {playerRole !== 'batter' && (
                    <>
                      <Text style={styles.inputLabel}>Bowling Style</Text>
                      <View style={styles.chipsRow}>
                        {BOWLING_STYLES.map((bs) => (
                          <TouchableOpacity
                            key={bs.key}
                            style={[
                              styles.chipBtn,
                              bowlingStyle === bs.key && styles.chipBtnActive,
                            ]}
                            onPress={() => setBowlingStyle(bs.key)}
                          >
                            <Text
                              style={[
                                styles.chipBtnText,
                                bowlingStyle === bs.key && styles.chipBtnTextActive,
                              ]}
                            >
                              {bs.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Optional Contact Email */}
                  <Text style={styles.inputLabel}>
                    Contact Email (Optional)
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={playerEmail}
                    onChangeText={setPlayerEmail}
                    placeholder="player@example.com"
                    placeholderTextColor="#64748B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  {/* Optional Contact Phone */}
                  <Text style={styles.inputLabel}>
                    Contact Phone (Optional Private Contact)
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={playerPhone}
                    onChangeText={setPlayerPhone}
                    placeholder="e.g. +91 98765 43210"
                    placeholderTextColor="#64748B"
                    keyboardType="phone-pad"
                  />
                  <Text style={styles.phoneDisclaimer}>
                    🔒 Private contact data only. Stored securely and never exposed in public team listings.
                  </Text>

                  {/* Member Scope Toggle: Permanent vs Match-Only Guest */}
                  <View style={styles.scopeBox}>
                    <TouchableOpacity
                      style={styles.scopeRow}
                      onPress={() => setIsMatchGuestOnly(!isMatchGuestOnly)}
                    >
                      <View
                        style={[
                          styles.scopeRadio,
                          isMatchGuestOnly && styles.scopeRadioActive,
                        ]}
                      >
                        {isMatchGuestOnly && <View style={styles.scopeRadioDot} />}
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.scopeTitle}>Match-only Guest / Substitute</Text>
                        <Text style={styles.scopeDesc}>
                          {isMatchGuestOnly
                            ? 'Added as a temporary match guest only. Will NOT alter the permanent team roster.'
                            : 'Added as a permanent roster member of this team.'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitMemberBtn,
                      isSubmittingMember && { opacity: 0.6 },
                    ]}
                    onPress={handleAddMemberSubmit}
                    disabled={isSubmittingMember}
                  >
                    <Text style={styles.submitMemberBtnText}>
                      {isSubmittingMember ? 'ADDING PLAYER...' : 'ADD PLAYER TO ROSTER'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#070D1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  headerBanner: {
    backgroundColor: '#0C142B',
    padding: 16,
    borderLeftWidth: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  teamSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  headerCaptainText: {
    fontSize: 12,
    color: '#00E676',
    fontWeight: '700',
    marginTop: 4,
  },
  roleTagManager: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  roleTagManagerText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '800',
  },
  roleTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  joinBtn: {
    backgroundColor: '#00E676',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinBtnPending: {
    backgroundColor: '#1E2C4F',
  },
  joinBtnText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 12,
  },
  inboxCard: {
    backgroundColor: '#121C38',
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  inboxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFB300',
    marginBottom: 10,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  reqName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  reqSub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  approveBtn: {
    backgroundColor: '#00E676',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
  },
  approveText: {
    color: '#070D1E',
    fontWeight: '800',
    fontSize: 11,
  },
  declineBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  declineText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  squadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  squadHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  squadSubText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E676',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  addMemberBtnText: {
    color: '#070D1E',
    fontWeight: '800',
    fontSize: 12,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C142B',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  numBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#121C38',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  numText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  captainBadge: {
    backgroundColor: '#00E676',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  captainBadgeText: {
    color: '#070D1E',
    fontSize: 10,
    fontWeight: '900',
  },
  wkBadge: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  wkBadgeText: {
    color: '#070D1E',
    fontSize: 10,
    fontWeight: '900',
  },
  guestBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  guestBadgeText: {
    color: '#070D1E',
    fontSize: 9,
    fontWeight: '800',
  },
  roleSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  phoneMetaPrivate: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
  },
  playerActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  captainActionBtn: {
    backgroundColor: '#121C38',
    borderWidth: 1,
    borderColor: '#00E676',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  captainActionText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: '800',
  },
  removeActionBtn: {
    padding: 6,
  },
  emptySquadBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptySquadTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySquadSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 30, 0.85)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0C142B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1.5,
    borderTopColor: '#1E2C4F',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#121C38',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chipBtn: {
    backgroundColor: '#121C38',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  chipBtnActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  chipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  chipBtnTextActive: {
    color: '#070D1E',
    fontWeight: '800',
  },
  phoneDisclaimer: {
    fontSize: 10,
    color: '#64748B',
    marginTop: -8,
    marginBottom: 14,
  },
  scopeBox: {
    backgroundColor: '#121C38',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scopeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeRadioActive: {
    borderColor: '#00E676',
  },
  scopeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00E676',
  },
  scopeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scopeDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  submitMemberBtn: {
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitMemberBtnText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  searchResultsLabel: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  playerSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121C38',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  playerSearchName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
    gap: 2,
  },
  verifiedBadgeText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: '700',
  },
  playerSearchMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  selectExistingPlayerBtn: {
    backgroundColor: '#00E676',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectExistingPlayerBtnText: {
    color: '#070D1E',
    fontSize: 11,
    fontWeight: '800',
  },
  manualPlayerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121C38',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    gap: 6,
    marginTop: 6,
  },
  manualPlayerToggleText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  backToSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  backToSearchBtnText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },
});
