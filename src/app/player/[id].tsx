import React, { useState, useMemo } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Player, PlayingRole, BattingHand, BowlingStyle } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { useTheme } from '../../theme';
import { ThemeColors } from '../../theme/tokens';

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPlayerById, updatePlayer, userProfile, teams } = useCricket();
  const { theme, colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const player = getPlayerById(id as string);

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(player?.name || '');
  const [phoneInput, setPhoneInput] = useState(player?.phoneNumber || '');
  const [roleInput, setRoleInput] = useState<PlayingRole>(player?.role || 'batter');
  const [battingHandInput, setBattingHandInput] = useState<BattingHand>(player?.battingHand || 'right');
  const [bowlingStyleInput, setBowlingStyleInput] = useState<BowlingStyle>(player?.bowlingStyle || 'fast-medium');

  if (!player) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-remove-outline" size={48} color="#94A3B8" />
        <Text style={styles.notFoundText}>Player profile not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Find player's team
  const playerTeam = teams.find((t) => t.players.some((p) => p.id === player.id));
  const stats = player.careerStats;
  const recentScores = player.recentScores || [];

  const formatStat = (val: number | undefined | null, decimals = 1): string => {
    if (val === undefined || val === null || isNaN(val) || !isFinite(val)) return '0.0';
    return Number(val.toFixed(decimals)).toString();
  };

  const handleSaveProfile = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Required', 'Please enter player name');
      return;
    }
    const updated: Player = {
      ...player,
      name: nameInput.trim(),
      phoneNumber: phoneInput.trim() || undefined,
      role: roleInput,
      battingHand: battingHandInput,
      bowlingStyle: bowlingStyleInput,
    };
    await updatePlayer(updated);
    setEditModalVisible(false);
    Alert.alert('Success', 'Player profile updated.');
  };

  const isCurrentUser =
    userProfile?.claimedPlayerId === player.id || userProfile?.name === player.name;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.canvas }]} contentContainerStyle={styles.content}>
      {/* 1. Profile Header Card */}
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
            <Text style={styles.avatarText}>
              {player.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.playerName, { color: colors.textPrimary }]}>{player.name}</Text>
              {player.isVerified && (
                <Ionicons name="checkmark-circle" size={18} color={colors.brand} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={[styles.phoneText, { color: colors.textSecondary }]}>
              {player.phoneNumber || 'Mobile unverified (Guest Profile)'}
            </Text>
            {playerTeam && (
              <View style={[styles.teamBadge, { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.teamDot, { backgroundColor: playerTeam.primaryColor }]} />
                <Text style={[styles.teamBadgeText, { color: colors.textPrimary }]}>{playerTeam.name}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.editIconBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            onPress={() => {
              setNameInput(player.name);
              setPhoneInput(player.phoneNumber || '');
              setRoleInput(player.role);
              setBattingHandInput(player.battingHand);
              setBowlingStyleInput(player.bowlingStyle || 'fast-medium');
              setEditModalVisible(true);
            }}
          >
            <Ionicons name="pencil" size={16} color={colors.brand} />
          </TouchableOpacity>
        </View>

        {/* Roles & Styles chips */}
        <View style={[styles.stylesRow, { borderTopColor: colors.border }]}>
          <View style={[styles.infoChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="cricket" size={14} color={colors.brand} />
            <Text style={[styles.infoChipText, { color: colors.textPrimary }]}>{(player.role || 'batter').toUpperCase()}</Text>
          </View>
          <View style={[styles.infoChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="hand-right-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.infoChipText, { color: colors.textPrimary }]}>{(player.battingHand || 'right').toUpperCase()} HAND BAT</Text>
          </View>
          {player.bowlingStyle && (
            <View style={[styles.infoChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Ionicons name="baseball-outline" size={14} color={colors.brand} />
              <Text style={[styles.infoChipText, { color: colors.textPrimary }]}>{player.bowlingStyle.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 2. Recent Form Sparkline */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trending-up" size={18} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Recent Form (Last 5 Innings)</Text>
        </View>

        {recentScores.length > 0 ? (
          <View style={styles.sparklineContainer}>
            <View style={styles.scoresRow}>
              {recentScores.map((score, idx) => {
                const isFifty = score >= 50 && score < 100;
                const isHundred = score >= 100;
                return (
                  <View key={idx} style={styles.scorePillContainer}>
                    <View
                      style={[
                        styles.scorePill,
                        isFifty && styles.scorePillFifty,
                        isHundred && styles.scorePillHundred,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scorePillText,
                          (isFifty || isHundred) && styles.scorePillTextHigh,
                        ]}
                      >
                        {score}
                      </Text>
                    </View>
                    <Text style={styles.scorePillSub}>Inn {idx + 1}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyNote}>No completed match innings recorded yet</Text>
        )}
      </View>

      {/* 3. Batting Career Statistics */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="cricket" size={18} color="#0284C7" />
          <Text style={styles.sectionTitle}>Batting Career Statistics</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>MATCHES</Text>
            <Text style={styles.statValue}>{stats?.matches ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>INNINGS</Text>
            <Text style={styles.statValue}>{stats?.inningsBatted ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RUNS</Text>
            <Text style={[styles.statValue, { color: Colors.primary }]}>{stats?.runs ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>HIGHEST</Text>
            <Text style={styles.statValue}>
              {stats?.highestScore ?? 0}
              {stats?.highestScoreNotOut ? '*' : ''}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>AVERAGE</Text>
            <Text style={styles.statValue}>{formatStat(stats?.average, 2)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>STRIKE RATE</Text>
            <Text style={styles.statValue}>{formatStat(stats?.strikeRate, 2)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>50s</Text>
            <Text style={styles.statValue}>{stats?.fifties ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>100s</Text>
            <Text style={styles.statValue}>{stats?.hundreds ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>FOURS (4s)</Text>
            <Text style={styles.statValue}>{stats?.fours ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SIXES (6s)</Text>
            <Text style={styles.statValue}>{stats?.sixes ?? 0}</Text>
          </View>
        </View>
      </View>

      {/* 4. Bowling Career Statistics */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="baseball-outline" size={18} color="#059669" />
          <Text style={styles.sectionTitle}>Bowling Career Statistics</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>OVERS</Text>
            <Text style={styles.statValue}>{formatStat(stats?.oversBowled, 1)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>MAIDENS</Text>
            <Text style={styles.statValue}>{stats?.maidens ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RUNS CONC</Text>
            <Text style={styles.statValue}>{stats?.runsConceded ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>WICKETS</Text>
            <Text style={[styles.statValue, { color: Colors.accentRed }]}>{stats?.wickets ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ECONOMY</Text>
            <Text style={styles.statValue}>{formatStat(stats?.bowlingEconomy, 2)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>AVERAGE</Text>
            <Text style={styles.statValue}>{formatStat(stats?.bowlingAverage, 2)}</Text>
          </View>
          <View style={[styles.statBox, { width: '100%' }]}>
            <Text style={styles.statLabel}>BEST BOWLING (BBI)</Text>
            <Text style={[styles.statValue, { color: Colors.pitchGreen }]}>
              {stats?.bestBowling && stats.bestBowling !== '0/0' ? stats.bestBowling : 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      {/* 5. Fielding Career Statistics */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-outline" size={18} color="#D97706" />
          <Text style={styles.sectionTitle}>Fielding Career Statistics</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>CATCHES</Text>
            <Text style={styles.statValue}>{stats?.catches ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>STUMPINGS</Text>
            <Text style={styles.statValue}>{stats?.stumpings ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RUN OUTS</Text>
            <Text style={styles.statValue}>{stats?.runOuts ?? 0}</Text>
          </View>
        </View>
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Player Profile</Text>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput style={styles.input} value={nameInput} onChangeText={setNameInput} />

              <Text style={styles.inputLabel}>Mobile Number</Text>
              <TextInput
                style={styles.input}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="e.g. +91 98765 43210"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Playing Role</Text>
              <View style={styles.optionsRow}>
                {(['batter', 'bowler', 'all-rounder', 'wicketkeeper'] as PlayingRole[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.optionBtn, roleInput === r && styles.optionBtnActive]}
                    onPress={() => setRoleInput(r)}
                  >
                    <Text style={[styles.optionText, roleInput === r && styles.optionTextActive]}>
                      {r.replace('-', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Batting Hand</Text>
              <View style={styles.optionsRow}>
                {(['right', 'left'] as BattingHand[]).map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.optionBtn, battingHandInput === h && styles.optionBtnActive]}
                    onPress={() => setBattingHandInput(h)}
                  >
                    <Text style={[styles.optionText, battingHandInput === h && styles.optionTextActive]}>
                      {h.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Bowling Style</Text>
              <View style={styles.optionsRow}>
                {(
                  ['fast', 'fast-medium', 'medium', 'spin-off', 'spin-leg', 'orthodox'] as BowlingStyle[]
                ).map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.optionBtn, bowlingStyleInput === b && styles.optionBtnActive]}
                    onPress={() => setBowlingStyleInput(b)}
                  >
                    <Text style={[styles.optionText, bowlingStyleInput === b && styles.optionTextActive]}>
                      {b.replace('-', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.canvas,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: theme.canvas,
    },
    notFoundText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 12,
    },
    backBtn: {
      marginTop: 16,
      backgroundColor: theme.brand,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    backBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    headerCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    playerName: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.textPrimary,
    },
    phoneText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    teamBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      backgroundColor: theme.surfaceAlt,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      gap: 6,
    },
    teamDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    teamBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    editIconBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stylesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    infoChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    sectionCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.textPrimary,
    },
    sparklineContainer: {
      paddingVertical: 6,
    },
    scoresRow: {
      flexDirection: 'row',
      gap: 10,
    },
    scorePillContainer: {
      alignItems: 'center',
      gap: 4,
    },
    scorePill: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.border,
    },
    scorePillFifty: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.brand,
    },
    scorePillHundred: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.brand,
    },
    scorePillText: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    scorePillTextHigh: {
      color: theme.brand,
    },
    scorePillSub: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    emptyNote: {
      color: theme.textSecondary,
      fontSize: 13,
      fontStyle: 'italic',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statBox: {
      width: '48%',
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.textPrimary,
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      marginTop: 10,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
    },
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    optionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    optionBtnActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    optionText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    optionTextActive: {
      color: '#FFFFFF',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 20,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    cancelBtnText: {
      fontWeight: '700',
      color: theme.textSecondary,
    },
    saveBtn: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.brand,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    saveBtnText: {
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });
