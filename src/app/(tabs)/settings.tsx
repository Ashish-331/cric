import React, { useState, useMemo } from 'react';
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
import { useTheme, ThemeMode } from '../../theme/useTheme';
import { ThemeColors } from '../../theme/tokens';
import { CricketHaptics } from '../../services/haptics';
import { AuthService } from '../../services/authService';

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
          <Ionicons name="shield-checkmark" size={22} color={theme.primary} />
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
                  <Ionicons name="checkmark-circle" size={18} color={theme.primary} style={{ marginLeft: 4 }} />
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
                <Ionicons name="person" size={15} color={theme.text} />
                <Text style={styles.viewProfileBtnText}>My Cricket Hub</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.signOutBtn, { flex: 1, marginTop: 0 }]}
                onPress={handleSignOut}
              >
                <Ionicons name="log-out-outline" size={15} color={theme.danger} />
                <Text style={styles.signOutBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.guestWarningBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={22} color={theme.warning} />
              <Text style={styles.guestTitle}>Guest Mode (Local Offline Only)</Text>
            </View>
            <Text style={styles.guestDesc}>
              You are currently using Cric in Guest Scorer mode. Friendly match scoring works 100% offline. To sync live scorecards across devices, manage squads, and join tournaments, sign in or register with your email.
            </Text>
            <TouchableOpacity
              style={styles.signInActionBtn}
              onPress={() => router.push('/auth/login')}
            >
              <Ionicons name="log-in-outline" size={18} color={theme.surface} />
              <Text style={styles.signInActionText}>Sign In / Register Account</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 2. Appearance & Scorebook Ground Mode */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="color-palette-outline" size={22} color={theme.primary} />
          <Text style={styles.cardTitle}>Appearance & Scorebook</Text>
        </View>
        <Text style={styles.cardSub}>
          Choose how Cric looks on this device. Ground Dark appearance delivers crisp, high-contrast typography in bright direct sun or evening floodlights.
        </Text>

        <View style={styles.themeSelectorRow}>
          {(
            [
              { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
              { mode: 'light', label: 'Light Paper', icon: 'sunny-outline' },
              { mode: 'dark', label: 'Ground Dark', icon: 'moon-outline' },
            ] as { mode: ThemeMode; label: string; icon: any }[]
          ).map((item) => {
            const isSelected = themeMode === item.mode;
            return (
              <TouchableOpacity
                key={item.mode}
                style={[styles.themeOptionBtn, isSelected && styles.themeOptionBtnActive]}
                onPress={() => {
                  CricketHaptics.toggle();
                  setThemeMode(item.mode);
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={isSelected ? theme.surface : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    isSelected && styles.themeOptionTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Offline Scoring & Storage Health */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cloud-offline-outline" size={22} color={theme.warning} />
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
          <Text style={[styles.healthValue, { color: theme.primary }]}>100% Ready (Zero Data Needed)</Text>
        </View>

        <Text style={styles.offlineNote}>
          Every delivery, dismissal, undo, and scorecard update is instantly confirmed and saved locally.
        </Text>
      </View>

      {/* 4. Backup & Device Migration */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="download-outline" size={22} color={theme.primary} />
          <Text style={styles.cardTitle}>Backup & Device Migration</Text>
        </View>

        <Text style={styles.cardSub}>
          Export full match backups in JSON format or import from another device without an internet connection.
        </Text>

        <TouchableOpacity
          style={styles.importTriggerBtn}
          onPress={() => setShowImportBox(!showImportBox)}
        >
          <Ionicons name="code-download-outline" size={18} color={theme.primary} />
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
              placeholderTextColor={theme.textMuted}
            />
            <TouchableOpacity style={styles.importConfirmBtn} onPress={handleImportMatch}>
              <Text style={styles.importConfirmText}>Load Match Backup</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 5. App Info */}
      <View style={styles.infoCard}>
        <Text style={styles.appTitle}>Cric — Grassroots Cricket Scorebook</Text>
        <Text style={styles.appVersion}>Cross-Platform (iOS & Android) • v1.0.0</Text>
        <Text style={styles.appCredits}>Built with React Native & Expo Router</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
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
      color: theme.text,
    },
    cardSub: {
      fontSize: 12,
      color: theme.textSecondary,
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
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: theme.primarySubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileName: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
    },
    profileRole: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    roleHighlight: {
      fontWeight: '700',
      color: theme.primary,
    },
    profilePhone: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 2,
    },
    viewProfileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      paddingVertical: 10,
      marginTop: 10,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 40,
    },
    viewProfileBtnText: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 12,
    },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.danger,
      gap: 8,
      minHeight: 40,
    },
    signOutBtnText: {
      color: theme.danger,
      fontWeight: '700',
      fontSize: 12,
    },
    themeSelectorRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 6,
    },
    themeOptionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
      minHeight: 44,
    },
    themeOptionBtnActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    themeOptionText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    themeOptionTextActive: {
      color: theme.surface,
      fontWeight: '800',
    },
    guestWarningBox: {
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.warning,
      borderRadius: 8,
      padding: 12,
    },
    guestTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.warning,
      marginLeft: 6,
    },
    guestDesc: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 12,
    },
    signInActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 10,
      gap: 8,
      minHeight: 44,
    },
    signInActionText: {
      color: theme.surface,
      fontSize: 13,
      fontWeight: '700',
    },
    healthRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    healthLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    healthValue: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    offlineNote: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 10,
      fontStyle: 'italic',
      lineHeight: 16,
    },
    importTriggerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      minHeight: 36,
    },
    importTriggerText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    importBox: {
      marginTop: 8,
    },
    jsonInput: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 10,
      fontSize: 12,
      color: theme.text,
      textAlignVertical: 'top',
    },
    importConfirmBtn: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
      minHeight: 44,
    },
    importConfirmText: {
      color: theme.surface,
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
      color: theme.textSecondary,
    },
    appVersion: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 2,
    },
    appCredits: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 2,
    },
  });
