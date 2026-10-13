import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Team, Player, PlayingRole } from '../../types/cricket';
import { useTheme } from '../../theme/useTheme';
import { ThemeColors } from '../../theme/tokens';
import { CricketHaptics } from '../../services/haptics';

const COLOR_PRESETS = ['#1E3A8A', '#B91C1C', '#B45309', '#15803D', '#6D28D9', '#C2410C', '#0369A1'];

export default function TeamsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    teams,
    saveTeam,
    createNewTeam,
    userProfile,
    joinRequests,
    approveJoinRequest,
    declineJoinRequest,
  } = useCricket();

  // Top Tabs: Your teams | Opponents | Add
  const [activeTab, setActiveTab] = useState<'your' | 'opponents' | 'add'>('your');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Add Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShort, setNewTeamShort] = useState('');
  const [newTeamCity, setNewTeamCity] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(COLOR_PRESETS[0]);
  const [captainNameHint, setCaptainNameHint] = useState('');
  const [captainPhonePrivate, setCaptainPhonePrivate] = useState('');
  const [addSelfAsPlayer, setAddSelfAsPlayer] = useState(true);
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);

  // Invite / QR Modal State
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [selectedInviteTeam, setSelectedInviteTeam] = useState<Team | null>(null);

  // Filtered lists
  const currentUserId = userProfile?.id;
  const claimedPlayerId = userProfile?.claimedPlayerId;

  const isYourTeam = (t: Team) => {
    const isOwnerOrManager =
      t.createdByUserId === currentUserId ||
      t.managerUserId === currentUserId;
    const isRosterPlayer =
      t.players.some(
        (p) =>
          p.id === claimedPlayerId ||
          (userProfile?.phoneNumber && p.phoneNumber === userProfile.phoneNumber)
      );
    return isOwnerOrManager || isRosterPlayer;
  };

  const yourTeams = useMemo(() => {
    return teams.filter(isYourTeam);
  }, [teams, currentUserId, claimedPlayerId, userProfile?.phoneNumber]);

  const opponentTeams = useMemo(() => {
    // Teams that are not strictly your managed teams or designated as opponents
    return teams.filter((t) => !isYourTeam(t) || t.isOpponent);
  }, [teams, yourTeams]);

  const filteredTeams = useMemo(() => {
    const sourceList = activeTab === 'your' ? yourTeams : opponentTeams;
    if (!searchQuery.trim()) return sourceList;
    const query = searchQuery.toLowerCase().trim();
    return sourceList.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.city?.toLowerCase().includes(query) ||
        t.shortName.toLowerCase().includes(query)
    );
  }, [activeTab, yourTeams, opponentTeams, searchQuery]);

  // Duplicate Warning check during Team Creation
  const duplicateWarning = useMemo(() => {
    if (!newTeamName.trim()) return null;
    const trimmed = newTeamName.trim().toLowerCase();
    const cityTrimmed = newTeamCity.trim().toLowerCase();
    const match = teams.find(
      (t) =>
        t.name.toLowerCase() === trimmed &&
        (!cityTrimmed || !t.city || t.city.toLowerCase() === cityTrimmed)
    );
    if (match) {
      return `A team named "${match.name}" already exists in ${match.city || 'this area'}. You can still create a distinct team or select the existing one.`;
    }
    return null;
  }, [newTeamName, newTeamCity, teams]);

  const handleCreateTeamSubmit = async () => {
    if (!newTeamName.trim() || !newTeamShort.trim()) {
      Alert.alert('Details Required', 'Please provide a team name and short code (e.g. MUM).');
      return;
    }
    if (!newTeamCity.trim()) {
      Alert.alert('City Required', 'Please provide the home city or town for this team.');
      return;
    }

    try {
      setIsSubmittingTeam(true);
      CricketHaptics.milestone();

      const created = await createNewTeam(
        newTeamName.trim(),
        newTeamShort.trim(),
        newTeamColor,
        {
          city: newTeamCity.trim(),
          addSelfAsPlayer,
          captainName: captainNameHint.trim() || undefined,
          captainPhone: captainPhonePrivate.trim() || undefined,
        }
      );

      // Reset form
      setNewTeamName('');
      setNewTeamShort('');
      setNewTeamCity('');
      setCaptainNameHint('');
      setCaptainPhonePrivate('');
      setAddSelfAsPlayer(true);

      Alert.alert(
        'Team Created Successfully! 🏏',
        `"${created.name}" (${created.city}) is now active. You can now add members and configure the captain.`,
        [
          {
            text: 'View Roster',
            onPress: () => router.push(`/teams/${created.id}`),
          },
          {
            text: 'Done',
            onPress: () => setActiveTab('your'),
          },
        ]
      );
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Creation Failed', err.message || 'Could not create team.');
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  const handleShareInvite = async (team: Team) => {
    CricketHaptics.toggle();
    const code = team.inviteCode || `INV-${team.shortName}`;
    try {
      await Share.share({
        title: `Join ${team.name} on Cric`,
        message: `Join ${team.name} (${team.city || 'Cricket Club'}) on Cric! Use invitation code: ${code}\nDownload the Cric app to manage team rosters and live scores.`,
      });
    } catch (e) {
      // dismissed
    }
  };

  const openInviteModal = (team: Team) => {
    CricketHaptics.toggle();
    setSelectedInviteTeam(team);
    setInviteModalVisible(true);
  };

  const renderTeamCard = ({ item }: { item: Team }) => {
    const isOwner =
      item.createdByUserId === currentUserId ||
      item.managerUserId === currentUserId;

    // Resolve captain display name safely
    let captainDisplay = item.captainName;
    if (!captainDisplay && item.captainPlayerId) {
      const capPlayer = item.players.find((p) => p.id === item.captainPlayerId);
      if (capPlayer) captainDisplay = capPlayer.name;
    }

    return (
      <View style={styles.teamCard}>
        <View style={styles.teamCardTop}>
          {/* Logo / Initials Badge */}
          <View
            style={[
              styles.avatarBadge,
              { backgroundColor: item.primaryColor || '#004BA0' },
            ]}
          >
            <Text style={styles.avatarInitials}>
              {item.shortName.substring(0, 3)}
            </Text>
          </View>

          {/* Team Info (Safe - No phone numbers exposed) */}
          <View style={styles.teamInfoCol}>
            <View style={styles.teamTitleRow}>
              <Text style={styles.teamNameText} numberOfLines={1}>
                {item.name}
              </Text>
              {isOwner && (
                <View style={styles.managerBadge}>
                  <Text style={styles.managerBadgeText}>Manager</Text>
                </View>
              )}
            </View>

            <Text style={styles.cityText}>
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />{' '}
              {item.city || 'Local Area'} • {item.players.length} Roster Members
            </Text>

            {captainDisplay ? (
              <Text style={styles.captainText}>
                <Ionicons name="shield-checkmark-outline" size={13} color={theme.primary} />{' '}
                Captain: {captainDisplay}
              </Text>
            ) : (
              <Text style={styles.noCaptainText}>
                <Ionicons name="alert-circle-outline" size={13} color={theme.warning} /> Captain not yet assigned
              </Text>
            )}
          </View>
        </View>

        {/* Card Actions */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.membersBtn}
            onPress={() => router.push(`/teams/${item.id}`)}
          >
            <Ionicons name="people-outline" size={16} color={theme.primary} />
            <Text style={styles.membersBtnText}>
              MEMBERS ({item.players.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inviteQrBtn}
            onPress={() => openInviteModal(item)}
          >
            <Ionicons name="qr-code-outline" size={16} color={theme.textSecondary} />
            <Text style={styles.inviteQrBtnText}>INVITE / QR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Segmented Top Tabs */}
      <View style={styles.tabsHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'your' && styles.tabButtonActive]}
          onPress={() => {
            CricketHaptics.toggle();
            setActiveTab('your');
          }}
        >
          <Text
            style={[styles.tabButtonText, activeTab === 'your' && styles.tabButtonTextActive]}
          >
            Your Teams ({yourTeams.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'opponents' && styles.tabButtonActive]}
          onPress={() => {
            CricketHaptics.toggle();
            setActiveTab('opponents');
          }}
        >
          <Text
            style={[styles.tabButtonText, activeTab === 'opponents' && styles.tabButtonTextActive]}
          >
            Opponents ({opponentTeams.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'add' && styles.tabButtonActive]}
          onPress={() => {
            CricketHaptics.toggle();
            setActiveTab('add');
          }}
        >
          <Ionicons
            name="add-circle-outline"
            size={16}
            color={activeTab === 'add' ? theme.surface : theme.primary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'add' && styles.tabButtonTextActive]}
          >
            Add Team
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode 1 & 2: List View (Your Teams or Opponents) */}
      {activeTab !== 'add' && (
        <View style={{ flex: 1 }}>
          {/* Search Bar */}
          <View style={styles.searchBarRow}>
            <Ionicons name="search-outline" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${activeTab === 'your' ? 'your teams' : 'opponents'} by name or city...`}
              placeholderTextColor={theme.textMuted}
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filteredTeams}
            keyExtractor={(t) => t.id}
            renderItem={renderTeamCard}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="shield-outline" size={48} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No Matching Teams Found' : activeTab === 'your' ? 'No Teams Created Yet' : 'No Opponent Teams in Directory'}
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === 'your'
                    ? 'Create your first cricket team to manage rosters, captains, and match lineups.'
                    : 'Search for opponents or add a new opponent team to schedule matches.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => setActiveTab('add')}
                >
                  <Ionicons name="add" size={18} color={theme.surface} />
                  <Text style={styles.emptyAddBtnText}>CREATE A TEAM NOW</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      )}

      {/* Mode 3: Add Team Form (Flow A2) */}
      {activeTab === 'add' && (
        <ScrollView contentContainerStyle={styles.addFormContent}>
          <Text style={styles.formHeading}>Register New Cricket Team</Text>
          <Text style={styles.formSub}>
            Create a canonical team entity. Team and roster persist across all matches and tournaments.
          </Text>

          {duplicateWarning && (
            <View style={styles.duplicateWarningBox}>
              <Ionicons name="warning-outline" size={18} color={theme.warning} style={{ marginRight: 8 }} />
              <Text style={styles.duplicateWarningText}>{duplicateWarning}</Text>
            </View>
          )}

          {/* Team Name */}
          <Text style={styles.inputLabel}>Team Name *</Text>
          <TextInput
            style={styles.formInput}
            value={newTeamName}
            onChangeText={setNewTeamName}
            placeholder="e.g. Mumbai Strikers"
            placeholderTextColor={theme.textMuted}
          />

          {/* Short Code & City Row */}
          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>Short Code *</Text>
              <TextInput
                style={styles.formInput}
                value={newTeamShort}
                onChangeText={(t) => setNewTeamShort(t.toUpperCase().slice(0, 4))}
                placeholder="MUM"
                placeholderTextColor={theme.textMuted}
                maxLength={4}
                autoCapitalize="characters"
              />
            </View>

            <View style={{ flex: 1.5 }}>
              <Text style={styles.inputLabel}>City / Town *</Text>
              <TextInput
                style={styles.formInput}
                value={newTeamCity}
                onChangeText={setNewTeamCity}
                placeholder="e.g. Mumbai"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          {/* Team Jersey Color Picker */}
          <Text style={styles.inputLabel}>Primary Jersey Color</Text>
          <View style={styles.colorPickerRow}>
            {COLOR_PRESETS.map((col) => (
              <TouchableOpacity
                key={col}
                style={[
                  styles.colorChip,
                  { backgroundColor: col },
                  newTeamColor === col && styles.colorChipSelected,
                ]}
                onPress={() => setNewTeamColor(col)}
              >
                {newTeamColor === col && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional Captain/Coordinator Hint */}
          <Text style={styles.inputLabel}>Captain / Coordinator Name (Optional)</Text>
          <TextInput
            style={styles.formInput}
            value={captainNameHint}
            onChangeText={setCaptainNameHint}
            placeholder="e.g. Rohit Sharma"
            placeholderTextColor={theme.textMuted}
          />

          {/* Optional Private Contact Phone */}
          <Text style={styles.inputLabel}>Coordinator Phone (Optional Private Contact)</Text>
          <TextInput
            style={styles.formInput}
            value={captainPhonePrivate}
            onChangeText={setCaptainPhonePrivate}
            placeholder="e.g. +91 98765 43210"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
          />
          <Text style={styles.privacyNote}>
            🔒 Private coordinator contact only. Never used for login and never exposed publicly on team cards.
          </Text>

          {/* Checkbox: Add Yourself In The Team */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              CricketHaptics.toggle();
              setAddSelfAsPlayer(!addSelfAsPlayer);
            }}
          >
            <View style={[styles.checkboxBox, addSelfAsPlayer && styles.checkboxBoxChecked]}>
              {addSelfAsPlayer && <Ionicons name="checkmark" size={16} color={theme.surface} />}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.checkboxTitle}>Add yourself in the team</Text>
              <Text style={styles.checkboxDesc}>
                {addSelfAsPlayer
                  ? 'Your player profile will be added to the roster as a playing squad member.'
                  : 'You will remain the team manager/owner only, and will not be listed on the playing roster.'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Submit Action */}
          <TouchableOpacity
            style={[styles.primarySubmitBtn, isSubmittingTeam && { opacity: 0.6 }]}
            onPress={handleCreateTeamSubmit}
            disabled={isSubmittingTeam}
          >
            <Text style={styles.primarySubmitBtnText}>
              {isSubmittingTeam ? 'CREATING TEAM...' : 'ADD TEAM'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={theme.surface} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Invite / QR Modal */}
      <Modal visible={inviteModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.inviteModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Team Invitation & QR</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedInviteTeam && (
              <View style={styles.inviteModalBody}>
                <View
                  style={[
                    styles.avatarBadgeLarge,
                    { backgroundColor: selectedInviteTeam.primaryColor || '#004BA0' },
                  ]}
                >
                  <Text style={styles.avatarInitialsLarge}>
                    {selectedInviteTeam.shortName}
                  </Text>
                </View>

                <Text style={styles.inviteTeamName}>{selectedInviteTeam.name}</Text>
                <Text style={styles.inviteTeamCity}>
                  {selectedInviteTeam.city || 'Cricket Team'} • {selectedInviteTeam.players.length} Squad Members
                </Text>

                {/* Scoped Invite Code */}
                <View style={styles.inviteCodeBox}>
                  <Text style={styles.inviteCodeLabel}>INVITATION CODE</Text>
                  <Text style={styles.inviteCodeValue}>
                    {selectedInviteTeam.inviteCode || `INV-${selectedInviteTeam.shortName}`}
                  </Text>
                </View>

                <Text style={styles.inviteInstructions}>
                  Players and captains can enter this code in the Cric app to lookup this team or submit join requests.
                </Text>

                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => handleShareInvite(selectedInviteTeam)}
                >
                  <Ionicons name="share-social-outline" size={18} color={theme.surface} />
                  <Text style={styles.shareBtnText}>SHARE TEAM INVITE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    tabsHeader: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      padding: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 8,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      backgroundColor: theme.surfaceAlt,
      minHeight: 44,
    },
    tabButtonActive: {
      backgroundColor: theme.primary,
    },
    tabButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    tabButtonTextActive: {
      color: theme.surface,
      fontWeight: '800',
    },
    searchBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
      fontWeight: '500',
    },
    listContent: {
      padding: 16,
      paddingBottom: 40,
    },
    teamCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    teamCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarBadge: {
      width: 48,
      height: 48,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarInitials: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 16,
      letterSpacing: 0.5,
    },
    teamInfoCol: {
      flex: 1,
    },
    teamTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    teamNameText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      flex: 1,
    },
    managerBadge: {
      backgroundColor: theme.primarySubtle,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    managerBadgeText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    cityText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 3,
    },
    captainText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '600',
      marginTop: 4,
    },
    noCaptainText: {
      fontSize: 12,
      color: theme.warning,
      fontWeight: '500',
      marginTop: 4,
    },
    cardActionsRow: {
      flexDirection: 'row',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 10,
    },
    membersBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
    },
    membersBtnText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    inviteQrBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
    },
    inviteQrBtnText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginTop: 12,
    },
    emptySub: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },
    emptyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 18,
      gap: 6,
      minHeight: 44,
    },
    emptyAddBtnText: {
      color: theme.surface,
      fontWeight: '700',
      fontSize: 13,
    },
    addFormContent: {
      padding: 20,
      paddingBottom: 60,
    },
    formHeading: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    formSub: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      marginBottom: 16,
      lineHeight: 18,
    },
    duplicateWarningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.warning,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    duplicateWarningText: {
      color: theme.warning,
      fontSize: 13,
      fontWeight: '500',
      flex: 1,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    formInput: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 15,
      fontWeight: '500',
      minHeight: 44,
      marginBottom: 14,
    },
    formRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    colorPickerRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    colorChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorChipSelected: {
      borderWidth: 2.5,
      borderColor: theme.text,
    },
    privacyNote: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: -8,
      marginBottom: 16,
      lineHeight: 16,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.surface,
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
    },
    checkboxBox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxBoxChecked: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    checkboxTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    checkboxDesc: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    primarySubmitBtn: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
      minHeight: 48,
    },
    primarySubmitBtnText: {
      color: theme.surface,
      fontWeight: '800',
      fontSize: 14,
      letterSpacing: 0.3,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    inviteModalCard: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
    },
    inviteModalBody: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    avatarBadgeLarge: {
      width: 64,
      height: 64,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    avatarInitialsLarge: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 20,
      letterSpacing: 0.5,
    },
    inviteTeamName: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    inviteTeamCity: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      marginBottom: 16,
    },
    inviteCodeBox: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 12,
      paddingHorizontal: 24,
      alignItems: 'center',
      marginBottom: 14,
      width: '100%',
    },
    inviteCodeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.5,
    },
    inviteCodeValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.primary,
      letterSpacing: 1.5,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    inviteInstructions: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 20,
      paddingHorizontal: 12,
    },
    shareBtn: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      minHeight: 48,
    },
    shareBtnText: {
      color: theme.surface,
      fontWeight: '800',
      fontSize: 14,
    },
  });
