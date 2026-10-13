import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { AvatarPreset, PlayingRole, BattingHand, BowlingStyle } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { CricketHaptics } from '../../services/haptics';
import { AuthService } from '../../services/authService';
import { useTheme } from '../../theme';

export const AVATAR_PRESETS: { id: AvatarPreset; label: string; icon: string; color: string }[] = [
  { id: 'helmet', label: 'Helmet', icon: 'shield-account', color: '#1A5336' },
  { id: 'cap', label: 'Club Cap', icon: 'hat-fedora', color: '#2D7D46' },
  { id: 'red-ball', label: 'Red Ball', icon: 'baseball', color: '#B91C1C' },
  { id: 'white-ball', label: 'White Ball', icon: 'baseball-diamond', color: '#64748B' },
  { id: 'stumps', label: 'Stumps', icon: 'format-align-justify', color: '#B45309' },
  { id: 'gloves', label: 'Keeper Gloves', icon: 'hand-back-left', color: '#6D28D9' },
];

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { userProfile, updateUserProfile, getPlayerById, updatePlayer, teams } = useCricket();

  const claimedPlayer = userProfile?.claimedPlayerId
    ? getPlayerById(userProfile.claimedPlayerId)
    : undefined;

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [avatarPreset, setAvatarPreset] = useState<AvatarPreset>(
    claimedPlayer?.avatarPreset || 'helmet'
  );
  const [nameInput, setNameInput] = useState(userProfile?.name || '');
  const [jerseyNumber, setJerseyNumber] = useState(
    claimedPlayer?.jerseyNumber ? String(claimedPlayer.jerseyNumber) : '18'
  );
  const [cityInput, setCityInput] = useState(claimedPlayer?.city || 'Mumbai, India');
  const [clubNameInput, setClubNameInput] = useState(claimedPlayer?.clubName || 'Wankhede Cricket Club');
  const [roleInput, setRoleInput] = useState<PlayingRole>(claimedPlayer?.role || userProfile?.playingRole || 'batter');
  const [battingHandInput, setBattingHandInput] = useState<BattingHand>(claimedPlayer?.battingHand || userProfile?.battingHand || 'right');
  const [bowlingStyleInput, setBowlingStyleInput] = useState<BowlingStyle>(claimedPlayer?.bowlingStyle || userProfile?.bowlingStyle || 'fast-medium');

  const stats = claimedPlayer?.careerStats;
  const recentScores = claimedPlayer?.recentScores || [];
  const playerTeam = teams.find((t) => t.players.some((p) => p.id === claimedPlayer?.id));

  const handleSaveProfile = async () => {
    CricketHaptics.milestone();
    if (claimedPlayer) {
      const updatedPlayer = {
        ...claimedPlayer,
        name: nameInput.trim() || claimedPlayer.name,
        avatarPreset,
        jerseyNumber: parseInt(jerseyNumber, 10) || 18,
        city: cityInput.trim(),
        clubName: clubNameInput.trim(),
        role: roleInput,
        battingHand: battingHandInput,
        bowlingStyle: bowlingStyleInput,
      };
      await updatePlayer(updatedPlayer);
    }

    await updateUserProfile({
      name: nameInput.trim() || userProfile?.name,
      playingRole: roleInput,
      battingHand: battingHandInput,
      bowlingStyle: bowlingStyleInput,
    });

    setEditModalVisible(false);
    Alert.alert('Profile Saved', 'Your cricket player hub has been updated.');
  };

  const handleLogOut = () => {
    CricketHaptics.toggle();
    Alert.alert(
      'Sign Out Account',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.signOut();
            } catch (err: any) {
              console.warn('Sign out warning:', err.message);
            }
            await updateUserProfile({
              id: `guest_${Date.now()}`,
              name: 'Guest Scorer',
              email: undefined,
              isGuest: true,
              isVerified: false,
              phoneNumber: undefined,
              claimedPlayerId: undefined,
              role: 'scorer',
            });
            Alert.alert('Signed Out', 'You have been signed out of your account.');
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const activePreset = AVATAR_PRESETS.find((p) => p.id === (claimedPlayer?.avatarPreset || avatarPreset)) || AVATAR_PRESETS[0];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.canvas }]} contentContainerStyle={styles.content}>
      {/* 1. Profile Hero Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { borderColor: activePreset.color, backgroundColor: colors.surfaceAlt }]}>
            <MaterialCommunityIcons
              name={activePreset.icon as any}
              size={36}
              color={activePreset.color}
            />
            {claimedPlayer?.jerseyNumber && (
              <View style={[styles.jerseyBadge, { backgroundColor: colors.surface, borderColor: colors.brand }]}>
                <Text style={[styles.jerseyText, { color: colors.brand }]}>#{claimedPlayer.jerseyNumber}</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.playerName, { color: colors.textPrimary }]}>{claimedPlayer?.name || userProfile?.name}</Text>
              {userProfile?.isVerified && (
                <Ionicons name="checkmark-circle" size={18} color={colors.brand} style={{ marginLeft: 4 }} />
              )}
            </View>

            <Text style={[styles.playerRoleSub, { color: colors.brand }]}>
              {(claimedPlayer?.role || userProfile?.playingRole || 'batter').toUpperCase()} • {(claimedPlayer?.battingHand || userProfile?.battingHand || 'right').toUpperCase()} HAND BAT
            </Text>
            <Text style={[styles.cityText, { color: colors.textSecondary }]}>
              📍 {claimedPlayer?.city || 'Club Cricket Grounds'} • {claimedPlayer?.clubName || 'Grassroots Arena'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            onPress={() => setEditModalVisible(true)}
          >
            <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Verification Status Banner */}
        <View
          style={[
            styles.verificationBanner,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name={userProfile?.isVerified && !userProfile?.isGuest ? 'shield-checkmark' : 'shield-outline'}
            size={16}
            color={userProfile?.isVerified && !userProfile?.isGuest ? colors.brand : colors.warning}
          />
          <Text style={[styles.verificationText, { color: colors.textPrimary }]}>
            {userProfile?.isVerified && !userProfile?.isGuest
              ? `Verified Account (${userProfile.email || 'Email Confirmed'})`
              : 'Guest Scorer (Local Offline Session)'}
          </Text>

          {(!userProfile?.isVerified || userProfile?.isGuest) && (
            <TouchableOpacity
              style={[styles.verifyLinkBtn, { backgroundColor: colors.brand }]}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.verifyLinkText}>Sign In / Register</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Personal Records Hall of Fame */}
      <View
        style={[
          styles.hallOfFameCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <MaterialCommunityIcons name="trophy-award" size={20} color={colors.brand} />
          <Text style={[styles.cardHeaderTitle, { color: colors.textPrimary }]}>Personal Records & Statistics</Text>
        </View>

        <View style={styles.hallGrid}>
          <View style={[styles.hallItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.hallLabel, { color: colors.textSecondary }]}>HIGHEST SCORE</Text>
            <Text style={[styles.hallValue, { color: colors.brand }]}>
              {stats?.highestScore ?? 0}
              {stats?.highestScoreNotOut ? '*' : ''}
            </Text>
          </View>

          <View style={[styles.hallItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.hallLabel, { color: colors.textSecondary }]}>BEST BOWLING</Text>
            <Text style={[styles.hallValue, { color: colors.textPrimary }]}>
              {stats?.bestBowling && stats.bestBowling !== '0/0' ? stats.bestBowling : 'N/A'}
            </Text>
          </View>

          <View style={[styles.hallItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.hallLabel, { color: colors.textSecondary }]}>BATTING AVERAGE</Text>
            <Text style={[styles.hallValue, { color: colors.textPrimary }]}>{stats?.average ?? 0}</Text>
          </View>

          <View style={[styles.hallItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.hallLabel, { color: colors.textSecondary }]}>STRIKE RATE</Text>
            <Text style={[styles.hallValue, { color: colors.textPrimary }]}>{stats?.strikeRate ?? 0}</Text>
          </View>

          <View style={[styles.hallItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.hallLabel, { color: colors.textSecondary }]}>TOTAL 50s / 100s</Text>
            <Text style={[styles.hallValue, { color: colors.textPrimary }]}>
              {stats?.fifties ?? 0} / {stats?.hundreds ?? 0}
            </Text>
          </View>

          <View style={[styles.hallItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.hallLabel, { color: colors.textSecondary }]}>CATCHES / STUMP</Text>
            <Text style={[styles.hallValue, { color: colors.textPrimary }]}>
              {stats?.catches ?? 0} / {stats?.stumpings ?? 0}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Recent Form */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <Ionicons name="trending-up" size={18} color={colors.brand} />
          <Text style={[styles.cardHeaderTitle, { color: colors.textPrimary }]}>Recent Form (Last 5 Scores)</Text>
        </View>

        {recentScores.length > 0 ? (
          <View style={styles.sparklineRow}>
            {recentScores.map((score, idx) => (
              <View
                key={idx}
                style={[
                  styles.scorePill,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scoreText,
                    score >= 100
                      ? { color: colors.brand }
                      : score >= 50
                      ? { color: colors.brand }
                      : { color: colors.textPrimary },
                  ]}
                >
                  {score}
                </Text>
                <Text style={[styles.scoreSub, { color: colors.textSecondary }]}>Inn {idx + 1}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyNote, { color: colors.textSecondary }]}>No completed match innings logged yet</Text>
        )}
      </View>

      {/* 4. Session & Account Actions */}
      <View style={styles.actionCard}>
        <TouchableOpacity
          style={[
            styles.switchPersonaBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
          <Text style={[styles.switchPersonaText, { color: colors.textPrimary }]}>Account & Security Settings</Text>
        </TouchableOpacity>

        {!userProfile?.isGuest && userProfile?.isVerified ? (
          <TouchableOpacity
            style={[
              styles.logOutBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.danger,
              },
            ]}
            onPress={handleLogOut}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={[styles.logOutText, { color: colors.danger }]}>Sign Out of Cric</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.logOutBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.brand,
              },
            ]}
            onPress={() => router.push('/auth/login')}
          >
            <Ionicons name="log-in-outline" size={18} color={colors.brand} />
            <Text style={[styles.logOutText, { color: colors.brand }]}>Sign In / Register Account</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Customize Player Hub</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* Avatar Preset Selector */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Choose Cricket Avatar</Text>
              <View style={styles.avatarPresetGrid}>
                {AVATAR_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.presetItem,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                      },
                      avatarPreset === p.id && {
                        borderColor: colors.brand,
                        backgroundColor: colors.primarySubtle,
                      },
                    ]}
                    onPress={() => setAvatarPreset(p.id)}
                  >
                    <MaterialCommunityIcons
                      name={p.icon as any}
                      size={26}
                      color={avatarPreset === p.id ? p.color : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.presetLabel,
                        { color: colors.textSecondary },
                        avatarPreset === p.id && { color: colors.brand, fontWeight: '700' },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Player Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.textPrimary }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Virat Kohli"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Jersey Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.textPrimary }]}
                value={jerseyNumber}
                onChangeText={setJerseyNumber}
                placeholder="18"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={3}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Home City / Ground</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.textPrimary }]}
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="e.g. Bangalore, India"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Club Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.textPrimary }]}
                value={clubNameInput}
                onChangeText={setClubNameInput}
                placeholder="e.g. Royal Challengers Club"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Playing Role</Text>
              <View style={styles.roleGrid}>
                {(['batter', 'bowler', 'all-rounder', 'wicketkeeper'] as PlayingRole[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleBtn,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      roleInput === r && { backgroundColor: colors.brand, borderColor: colors.brand },
                    ]}
                    onPress={() => setRoleInput(r)}
                  >
                    <Text
                      style={[
                        styles.roleBtnText,
                        { color: colors.textSecondary },
                        roleInput === r && { color: '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {r.replace('-', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.brand }]} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>SAVE PLAYER HUB</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  jerseyBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderWidth: 1.5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  jerseyText: {
    fontSize: 9,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 18,
    fontWeight: '800',
  },
  playerRoleSub: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  cityText: {
    fontSize: 11,
    marginTop: 2,
  },
  editBtn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
    gap: 8,
    borderWidth: 1,
  },
  verificationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  verifyLinkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  verifyLinkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  hallOfFameCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  hallGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hallItem: {
    width: '48.5%',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  hallLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  hallValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  sparklineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scorePill: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scoreSub: {
    fontSize: 10,
    marginTop: 2,
  },
  emptyNote: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  actionCard: {
    gap: 10,
  },
  switchPersonaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    minHeight: 48,
  },
  switchPersonaText: {
    fontWeight: '700',
    fontSize: 13,
  },
  logOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    minHeight: 48,
  },
  logOutText: {
    fontWeight: '700',
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  avatarPresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetItem: {
    width: '31%',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    gap: 4,
  },
  presetLabel: {
    fontSize: 10,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleBtnText: {
    fontSize: 11,
  },
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
