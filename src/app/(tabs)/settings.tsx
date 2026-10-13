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
import { AuthService } from '../../services/authService';

export default function SettingsScreen() {
  const {
    userProfile,
    updateUserProfile,
    matches,
    importMatch,
    getPlayerById,
  } = useCricket();

  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  const claimedPlayer = userProfile?.claimedPlayerId
    ? getPlayerById(userProfile.claimedPlayerId)
    : undefined;

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out Account',
      'Are you sure you want to sign out? You will return to offline guest scoring.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.signOut();
            } catch (err: any) {
              console.warn('Sign out notice:', err.message);
            }
            await updateUserProfile({
              id: `guest_${Date.now()}`,
              name: 'Guest Scorer',
              email: undefined,
              phoneNumber: undefined,
              isGuest: true,
              isVerified: false,
              role: 'scorer',
            });
            Alert.alert('Signed Out', 'You have been signed out.');
            router.replace('/auth/login');
          },
        },
      ]
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
      {/* 1. Unified Account & Security Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark" size={22} color={Colors.primary} />
          <Text style={styles.cardTitle}>Account & Security</Text>
        </View>

        {!userProfile?.isGuest && userProfile?.isVerified ? (
          <View>
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
                  <Ionicons name="checkmark-circle" size={18} color={Colors.pitchGreen} style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.profileRole}>
                  Account: <Text style={styles.roleHighlight}>{userProfile.email || 'Verified'}</Text>
                </Text>
                {claimedPlayer ? (
                  <Text style={styles.profilePhone}>Linked Player: {claimedPlayer.name}</Text>
                ) : userProfile.phoneNumber ? (
                  <Text style={styles.profilePhone}>Private Contact: {userProfile.phoneNumber}</Text>
                ) : (
                  <Text style={styles.profilePhone}>Zero SMS • Email Authenticated</Text>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.viewProfileBtn, { flex: 1, marginTop: 0 }]}
                onPress={() => router.push('/profile')}
              >
                <Ionicons name="person" size={15} color="#FFF" />
                <Text style={styles.viewProfileBtnText}>My Cricket Hub</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewProfileBtn, { flex: 1, marginTop: 0, backgroundColor: '#EF4444' }]}
                onPress={handleSignOut}
              >
                <Ionicons name="log-out-outline" size={15} color="#FFF" />
                <Text style={styles.viewProfileBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.guestWarningBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={22} color={Colors.accentAmber} />
              <Text style={styles.guestTitle}>Guest Mode (Local Offline Only)</Text>
            </View>
            <Text style={styles.guestDesc}>
              You are currently using Cric in Guest Scorer mode. Friendly match scoring works 100% offline. To sync live scorecards across devices, manage squads, and join tournaments, sign in or register with your email.
            </Text>
            <TouchableOpacity
              style={styles.signInActionBtn}
              onPress={() => router.push('/auth/login')}
            >
              <Ionicons name="log-in-outline" size={18} color="#FFF" />
              <Text style={styles.signInActionText}>Sign In / Register Account</Text>
            </TouchableOpacity>
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
          <Text style={styles.healthValue}>SQLite (WAL Mode & Durable Outbox)</Text>
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
  guestWarningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
  },
  guestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 6,
  },
  guestDesc: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    marginBottom: 12,
  },
  signInActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
  },
  signInActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
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
