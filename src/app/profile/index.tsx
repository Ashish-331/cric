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

export const AVATAR_PRESETS: { id: AvatarPreset; label: string; icon: string; color: string }[] = [
  { id: 'helmet', label: 'Helmet', icon: 'shield-account', color: '#00E5FF' },
  { id: 'cap', label: 'Club Cap', icon: 'hat-fedora', color: '#00E676' },
  { id: 'red-ball', label: 'Red Ball', icon: 'baseball', color: '#FF1744' },
  { id: 'white-ball', label: 'White Ball', icon: 'baseball-diamond', color: '#F8FAFC' },
  { id: 'stumps', label: 'Stumps', icon: 'format-align-justify', color: '#FFB300' },
  { id: 'gloves', label: 'Keeper Gloves', icon: 'hand-back-left', color: '#D500F9' },
];

export default function ProfileScreen() {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Profile Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { borderColor: activePreset.color }]}>
            <MaterialCommunityIcons
              name={activePreset.icon as any}
              size={38}
              color={activePreset.color}
            />
            {claimedPlayer?.jerseyNumber && (
              <View style={styles.jerseyBadge}>
                <Text style={styles.jerseyText}>#{claimedPlayer.jerseyNumber}</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>{claimedPlayer?.name || userProfile?.name}</Text>
              {userProfile?.isVerified && (
                <Ionicons name="checkmark-circle" size={18} color={Colors.pitchGreen} style={{ marginLeft: 4 }} />
              )}
            </View>

            <Text style={styles.playerRoleSub}>
              {(claimedPlayer?.role || userProfile?.playingRole || 'batter').toUpperCase()} • {(claimedPlayer?.battingHand || userProfile?.battingHand || 'right').toUpperCase()} HAND BAT
            </Text>
            <Text style={styles.cityText}>
              📍 {claimedPlayer?.city || 'Club Cricket Grounds'} • {claimedPlayer?.clubName || 'Grassroots Arena'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditModalVisible(true)}
          >
            <Ionicons name="create-outline" size={18} color="#00E5FF" />
          </TouchableOpacity>
        </View>

        {/* Verification Status Banner */}
        <View style={styles.verificationBanner}>
          <Ionicons
            name={userProfile?.isVerified && !userProfile?.isGuest ? 'shield-checkmark' : 'shield-outline'}
            size={16}
            color={userProfile?.isVerified && !userProfile?.isGuest ? '#00E676' : '#FFB300'}
          />
          <Text style={styles.verificationText}>
            {userProfile?.isVerified && !userProfile?.isGuest
              ? `Verified Account (${userProfile.email || 'Email Confirmed'})`
              : 'Guest Scorer (Local Offline Session)'}
          </Text>

          {(!userProfile?.isVerified || userProfile?.isGuest) && (
            <TouchableOpacity
              style={styles.verifyLinkBtn}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.verifyLinkText}>Sign In / Register</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Personal Records Hall of Fame */}
      <View style={styles.hallOfFameCard}>
        <View style={styles.cardHeaderRow}>
          <MaterialCommunityIcons name="trophy-award" size={20} color="#FFB300" />
          <Text style={styles.cardHeaderTitle}>Personal Records Hall of Fame</Text>
        </View>

        <View style={styles.hallGrid}>
          <View style={styles.hallItem}>
            <Text style={styles.hallLabel}>HIGHEST SCORE</Text>
            <Text style={[styles.hallValue, { color: '#00E676' }]}>
              {stats?.highestScore ?? 0}
              {stats?.highestScoreNotOut ? '*' : ''}
            </Text>
          </View>

          <View style={styles.hallItem}>
            <Text style={styles.hallLabel}>BEST BOWLING</Text>
            <Text style={[styles.hallValue, { color: '#00E5FF' }]}>
              {stats?.bestBowling && stats.bestBowling !== '0/0' ? stats.bestBowling : 'N/A'}
            </Text>
          </View>

          <View style={styles.hallItem}>
            <Text style={styles.hallLabel}>BATTING AVERAGE</Text>
            <Text style={styles.hallValue}>{stats?.average ?? 0}</Text>
          </View>

          <View style={styles.hallItem}>
            <Text style={styles.hallLabel}>STRIKE RATE</Text>
            <Text style={styles.hallValue}>{stats?.strikeRate ?? 0}</Text>
          </View>

          <View style={styles.hallItem}>
            <Text style={styles.hallLabel}>TOTAL 50s / 100s</Text>
            <Text style={styles.hallValue}>
              {stats?.fifties ?? 0} / {stats?.hundreds ?? 0}
            </Text>
          </View>

          <View style={styles.hallItem}>
            <Text style={styles.hallLabel}>CATCHES / STUMP</Text>
            <Text style={styles.hallValue}>
              {stats?.catches ?? 0} / {stats?.stumpings ?? 0}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Recent Form Sparkline */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="trending-up" size={18} color="#00E5FF" />
          <Text style={styles.cardHeaderTitle}>Recent Form (Last 5 Scores)</Text>
        </View>

        {recentScores.length > 0 ? (
          <View style={styles.sparklineRow}>
            {recentScores.map((score, idx) => (
              <View key={idx} style={styles.scorePill}>
                <Text
                  style={[
                    styles.scoreText,
                    score >= 100
                      ? { color: '#FFB300' }
                      : score >= 50
                      ? { color: '#00E676' }
                      : { color: '#FFFFFF' },
                  ]}
                >
                  {score}
                </Text>
                <Text style={styles.scoreSub}>Inn {idx + 1}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyNote}>No completed match innings logged yet</Text>
        )}
      </View>

      {/* 4. Session & Account Actions */}
      <View style={styles.actionCard}>
        <TouchableOpacity
          style={styles.switchPersonaBtn}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={18} color="#00E5FF" />
          <Text style={styles.switchPersonaText}>Account & Security Settings</Text>
        </TouchableOpacity>

        {!userProfile?.isGuest && userProfile?.isVerified ? (
          <TouchableOpacity style={styles.logOutBtn} onPress={handleLogOut}>
            <Ionicons name="log-out-outline" size={18} color="#FF1744" />
            <Text style={styles.logOutText}>Sign Out of Cric</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.logOutBtn, { borderColor: '#00E676' }]}
            onPress={() => router.push('/auth/login')}
          >
            <Ionicons name="log-in-outline" size={18} color="#00E676" />
            <Text style={[styles.logOutText, { color: '#00E676' }]}>Sign In / Register Account</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customize Player Hub</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* Avatar Preset Selector */}
              <Text style={styles.inputLabel}>Choose Cricket Avatar</Text>
              <View style={styles.avatarPresetGrid}>
                {AVATAR_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.presetItem,
                      avatarPreset === p.id && styles.presetItemActive,
                    ]}
                    onPress={() => setAvatarPreset(p.id)}
                  >
                    <MaterialCommunityIcons
                      name={p.icon as any}
                      size={26}
                      color={avatarPreset === p.id ? p.color : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.presetLabel,
                        avatarPreset === p.id && { color: p.color, fontWeight: '800' },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Player Name</Text>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Virat Kohli"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.inputLabel}>Jersey Number</Text>
              <TextInput
                style={styles.input}
                value={jerseyNumber}
                onChangeText={setJerseyNumber}
                placeholder="18"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={3}
              />

              <Text style={styles.inputLabel}>Home City / Ground</Text>
              <TextInput
                style={styles.input}
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="e.g. Bangalore, India"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.inputLabel}>Club Name</Text>
              <TextInput
                style={styles.input}
                value={clubNameInput}
                onChangeText={setClubNameInput}
                placeholder="e.g. Royal Challengers Club"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.inputLabel}>Playing Role</Text>
              <View style={styles.roleGrid}>
                {(['batter', 'bowler', 'all-rounder', 'wicketkeeper'] as PlayingRole[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleBtn, roleInput === r && styles.roleBtnActive]}
                    onPress={() => setRoleInput(r)}
                  >
                    <Text style={[styles.roleBtnText, roleInput === r && styles.roleBtnTextActive]}>
                      {r.replace('-', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
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
    backgroundColor: '#070D1E',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#0C142B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#1E2C4F',
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
    backgroundColor: '#121C38',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  jerseyBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#070D1E',
    borderWidth: 1.5,
    borderColor: '#FFB300',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  jerseyText: {
    color: '#FFB300',
    fontSize: 9,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  playerRoleSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5FF',
    marginTop: 2,
  },
  cityText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  editBtn: {
    padding: 8,
    backgroundColor: '#121C38',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121C38',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  verificationText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  verifyLinkBtn: {
    backgroundColor: '#00E676',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifyLinkText: {
    color: '#070D1E',
    fontSize: 11,
    fontWeight: '900',
  },
  hallOfFameCard: {
    backgroundColor: '#0C142B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#1E2C4F',
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
    fontWeight: '900',
    color: '#FFFFFF',
  },
  hallGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hallItem: {
    width: '48.5%',
    backgroundColor: '#121C38',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  hallLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
  },
  hallValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  sectionCard: {
    backgroundColor: '#0C142B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#1E2C4F',
    marginBottom: 14,
  },
  sparklineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scorePill: {
    flex: 1,
    backgroundColor: '#121C38',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  emptyNote: {
    color: '#64748B',
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
    backgroundColor: '#121C38',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  switchPersonaText: {
    color: '#00E5FF',
    fontWeight: '800',
    fontSize: 13,
  },
  logOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121C38',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF1744',
  },
  logOutText: {
    color: '#FF1744',
    fontWeight: '800',
    fontSize: 13,
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
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
    backgroundColor: '#121C38',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    gap: 4,
  },
  presetItemActive: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
  },
  presetLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#121C38',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1E2C4F',
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
    backgroundColor: '#121C38',
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  roleBtnActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  roleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  roleBtnTextActive: {
    color: '#070D1E',
    fontWeight: '900',
  },
  saveBtn: {
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#070D1E',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
