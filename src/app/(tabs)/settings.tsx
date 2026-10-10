import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { UserProfile } from '../../storage/storageService';
import { Colors } from '../../utils/colors';

export default function SettingsScreen() {
  const {
    userProfile,
    presetUsers,
    switchUser,
    updateUserProfile,
    matches,
    importMatch,
    getPlayerById,
  } = useCricket();

  const [phoneInput, setPhoneInput] = useState(userProfile?.phoneNumber || '');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  const claimedPlayer = userProfile?.claimedPlayerId
    ? getPlayerById(userProfile.claimedPlayerId)
    : undefined;

  const handleSendOtp = () => {
    if (!phoneInput || phoneInput.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setOtpSent(true);
    Alert.alert('Demo OTP Sent', 'Verification code has been sent. Use demo code: 123456');
  };

  const handleVerifyOtp = async () => {
    if (otpInput === '123456') {
      await updateUserProfile({
        phoneNumber: phoneInput,
        isGuest: false,
        isVerified: true,
      });
      setOtpSent(false);
      setOtpInput('');
      Alert.alert('Verified!', 'Your mobile account is now verified. Guest records are linked.');
    } else {
      Alert.alert('Invalid Code', 'Please enter code 123456');
    }
  };

  const handleSwitchAccount = async (targetUser: UserProfile) => {
    await switchUser(targetUser);
    setPhoneInput(targetUser.phoneNumber || '');
    setOtpSent(false);
    setOtpInput('');
    Alert.alert(
      'Account Switched!',
      `Now logged in as ${targetUser.name} (${targetUser.role.toUpperCase()}). You can now test features from this perspective!`
    );
  };

  const handleImportMatch = async () => {
    if (!importJsonText.trim()) {
      Alert.alert('Input Required', 'Paste the match JSON backup text first.');
      return;
    }
    try {
      const match = await importMatch(importJsonText.trim());
      setImportJsonText('');
      setShowImportBox(false);
      Alert.alert('Success', `Imported match: "${match.title}"`);
    } catch (err: any) {
      Alert.alert('Import Failed', err.message || 'Invalid match format.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Current Active Profile Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="person-circle" size={24} color={Colors.primary} />
          <Text style={styles.cardTitle}>Active Account & Identity</Text>
        </View>

        <View style={styles.profileBox}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(userProfile?.name || 'User')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{userProfile?.name}</Text>
              {userProfile?.isVerified && (
                <Ionicons name="checkmark-circle" size={18} color={Colors.pitchGreen} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.profileRole}>
              Role: <Text style={styles.roleHighlight}>{(userProfile?.role || 'player').toUpperCase()}</Text>
              {userProfile?.teamId ? ` • Squad Member` : ''}
            </Text>
            <Text style={styles.profilePhone}>{userProfile?.phoneNumber || 'No phone verified (Guest)'}</Text>
          </View>
        </View>

        {userProfile?.claimedPlayerId && (
          <TouchableOpacity
            style={styles.viewProfileBtn}
            onPress={() => router.push(`/player/${userProfile.claimedPlayerId}`)}
          >
            <MaterialCommunityIcons name="card-account-details-outline" size={16} color="#FFF" />
            <Text style={styles.viewProfileBtnText}>View Full Career Profile & Stats</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Easy Persona / User Switcher */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="swap-horizontal" size={22} color="#0284C7" />
          <Text style={styles.cardTitle}>Switch User / Perspective</Text>
        </View>
        <Text style={styles.cardSub}>
          Switch instantly between Captain, Player, and Organizer to test permissions, join approvals, and scoring roles:
        </Text>

        <View style={styles.switchList}>
          {presetUsers.map((u) => {
            const isCurrent = userProfile?.id === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                style={[styles.switchCard, isCurrent && styles.switchCardActive]}
                onPress={() => handleSwitchAccount(u)}
              >
                <View style={styles.switchHeader}>
                  <View style={styles.switchLeft}>
                    <Text style={[styles.switchName, isCurrent && styles.switchNameActive]}>
                      {u.name}
                    </Text>
                    <Text style={styles.switchDesc}>
                      {u.role === 'captain'
                        ? 'Captain • Can approve squad join requests & lead team'
                        : u.role === 'organizer'
                        ? 'Organizer • Organizes matches, formats & ball types'
                        : 'Player • Browses teams & requests to join squads'}
                    </Text>
                  </View>
                  {isCurrent ? (
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>ACTIVE</Text>
                    </View>
                  ) : (
                    <Text style={styles.switchAction}>Switch</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Mobile Number Verification Flow */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={22} color={Colors.pitchGreen} />
          <Text style={styles.cardTitle}>Mobile Number Verification</Text>
        </View>

        <Text style={styles.cardSub}>
          Guest scoring works completely offline. Verify your phone number to permanently secure your profile.
        </Text>

        {!userProfile?.isVerified ? (
          <View style={styles.authSection}>
            <Text style={styles.inputLabel}>Mobile Number (+91)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.sendOtpBtn} onPress={handleSendOtp}>
                <Text style={styles.sendOtpText}>{otpSent ? 'Resend' : 'Send OTP'}</Text>
              </TouchableOpacity>
            </View>

            {otpSent && (
              <View style={[styles.inputRow, { marginTop: 10 }]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={otpInput}
                  onChangeText={setOtpInput}
                  placeholder="Enter 6-digit OTP (123456)"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity style={styles.verifyBtn} onPress={handleVerifyOtp}>
                  <Text style={styles.verifyText}>Verify</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.verifiedBox}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.pitchGreen} />
            <Text style={styles.verifiedText}>Verified Mobile: {userProfile.phoneNumber}</Text>
          </View>
        )}
      </View>

      {/* 4. Offline Scoring & Storage Health */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cloud-offline-outline" size={22} color={Colors.accentAmber} />
          <Text style={styles.cardTitle}>Offline Scoring Health</Text>
        </View>

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Local Match Storage:</Text>
          <Text style={styles.healthValue}>{matches.length} Matches Saved</Text>
        </View>

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Storage Engine:</Text>
          <Text style={styles.healthValue}>AsyncStorage (Persistent)</Text>
        </View>

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Offline Capability:</Text>
          <Text style={[styles.healthValue, { color: Colors.pitchGreen }]}>100% Ready (Zero Data Needed)</Text>
        </View>

        <Text style={styles.offlineNote}>
          Every delivery, dismissal, undo, and scorecard update is instantly confirmed and saved locally.
        </Text>
      </View>

      {/* 5. Backup & Device Migration */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="download-outline" size={22} color={Colors.primary} />
          <Text style={styles.cardTitle}>Backup & Device Migration</Text>
        </View>

        <Text style={styles.cardSub}>
          Export full match backups in JSON format or import from another device without an internet connection.
        </Text>

        <TouchableOpacity
          style={styles.importTriggerBtn}
          onPress={() => setShowImportBox(!showImportBox)}
        >
          <Ionicons name="code-download-outline" size={18} color={Colors.primary} />
          <Text style={styles.importTriggerText}>
            {showImportBox ? 'Hide JSON Import' : 'Import Match From JSON'}
          </Text>
        </TouchableOpacity>

        {showImportBox && (
          <View style={styles.importBox}>
            <TextInput
              style={styles.jsonInput}
              multiline
              numberOfLines={6}
              value={importJsonText}
              onChangeText={setImportJsonText}
              placeholder="Paste raw Match JSON backup here..."
            />
            <TouchableOpacity style={styles.importConfirmBtn} onPress={handleImportMatch}>
              <Text style={styles.importConfirmText}>Load Match Backup</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 6. App Info */}
      <View style={styles.infoCard}>
        <Text style={styles.appTitle}>Cricket Scoring & Management App</Text>
        <Text style={styles.appVersion}>Cross-Platform (iOS & Android) • v1.0.0</Text>
        <Text style={styles.appCredits}>Built with React Native & Expo Router</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  roleHighlight: {
    fontWeight: '800',
    color: Colors.primary,
  },
  profilePhone: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
    gap: 8,
  },
  viewProfileBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  switchList: {
    gap: 8,
  },
  switchCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  switchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLeft: {
    flex: 1,
  },
  switchName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  switchNameActive: {
    color: '#1D4ED8',
  },
  switchDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  switchAction: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    paddingHorizontal: 8,
  },
  activeTag: {
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  authSection: {
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
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
  sendOtpBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
  },
  sendOtpText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  verifyBtn: {
    backgroundColor: Colors.pitchGreen,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  verifyText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  verifiedText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 13,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  healthLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  healthValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  offlineNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 10,
    fontStyle: 'italic',
  },
  importTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  importTriggerText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  importBox: {
    marginTop: 8,
  },
  jsonInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  importConfirmBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  importConfirmText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  infoCard: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  appTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  appVersion: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  appCredits: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});
