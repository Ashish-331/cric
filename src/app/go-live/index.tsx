import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { useTheme } from '../../theme/useTheme';
import { ThemeColors } from '../../theme/tokens';
import { Badge } from '../../components/common/Badge';
import { supabase } from '../../services/supabaseClient';
import { toCanonicalUUID } from '../../utils/uuid';
import { PlayerPerformanceService } from '../../services/playerPerformanceService';
import { StorageService } from '../../storage/storageService';
import { Match } from '../../types/cricket';

export default function GoLiveScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { matches, userProfile, teams, tournaments } = useCricket();
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [broadcastActive, setBroadcastActive] = useState<boolean>(false);
  const [currentShareToken, setCurrentShareToken] = useState<string | null>(null);

  const authorizedMatches = userProfile?.id
    ? PlayerPerformanceService.getFilteredMatchesForUser(
        userProfile.id,
        'your',
        matches,
        teams,
        tournaments,
        userProfile.claimedPlayerId ? [userProfile.claimedPlayerId] : []
      )
    : [];

  const ongoingMatches = authorizedMatches.filter(
    (m) => m.status === 'live' || m.status === 'innings_break' || m.status === 'scheduled'
  );

  const selectedMatch = authorizedMatches.find((m) => m.id === selectedMatchId) || ongoingMatches[0];

  const handleStartScoreBroadcast = async () => {
    if (!selectedMatch) {
      Alert.alert('No Match Selected', 'Please organize or select a match to start broadcasting.');
      return;
    }
    const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setBroadcastActive(true);
    setCurrentShareToken(token);

    const updatedMatch: Match = {
      ...selectedMatch,
      shareToken: token,
      isShareActive: true,
      lastUpdated: Date.now(),
    };
    await StorageService.saveMatch(updatedMatch);

    try {
      await supabase.from('live_broadcasts').insert({
        match_id: toCanonicalUUID(selectedMatch.id),
        broadcast_mode: 'score_only',
        status: 'active',
        audience_visibility: 'public',
        created_by_account_id: userProfile?.id || null,
      });

      await supabase.from('match_share_sessions').insert({
        match_id: toCanonicalUUID(selectedMatch.id),
        share_token: token,
        is_active: true,
        created_by: userProfile?.id || null,
      });
    } catch (e) {
      console.warn('Notice: broadcast logged locally (offline):', e);
    }

    Alert.alert(
      'Live Score Broadcasting Active 📡',
      `Live ball-by-ball score broadcast is running for ${selectedMatch.title}. Spectators can view live updates on their phones in real-time!`
    );
  };

  const handleStopScoreBroadcast = async () => {
    if (!selectedMatch) return;
    setBroadcastActive(false);

    const updatedMatch: Match = {
      ...selectedMatch,
      isShareActive: false,
      lastUpdated: Date.now(),
    };
    await StorageService.saveMatch(updatedMatch);

    try {
      if (currentShareToken || selectedMatch.shareToken) {
        const token = currentShareToken || selectedMatch.shareToken;
        await supabase
          .from('match_share_sessions')
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq('share_token', token);
      }
      await supabase
        .from('live_broadcasts')
        .update({ status: 'completed' })
        .eq('match_id', toCanonicalUUID(selectedMatch.id))
        .eq('status', 'active');
    } catch (e) {
      console.warn('Notice: broadcast stop logged locally (offline):', e);
    }

    setCurrentShareToken(null);
    Alert.alert('Broadcast Ended 🛑', 'The live score broadcast and share link have been stopped.');
  };

  const handleSharePublicStream = async () => {
    if (!selectedMatch) return;
    const token = currentShareToken || selectedMatch.shareToken;
    const shareUrl = token
      ? `https://cric.app/match/${selectedMatch.id}?share=${token}`
      : `https://cric.app/match/${selectedMatch.id}`;

    try {
      await Share.share({
        title: `Live Match: ${selectedMatch.title}`,
        message: `Follow live cricket score on Cric: ${selectedMatch.title} — ${shareUrl}`,
      });
    } catch (err: any) {
      console.warn('Share error:', err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Go Live & Broadcast</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Broadcast Status Card */}
        <View style={styles.broadcastStatusCard}>
          <View style={styles.statusHeaderRow}>
            <View style={[styles.pulseDot, { backgroundColor: broadcastActive ? theme.primary : theme.textMuted }]} />
            <Text style={styles.statusHeaderText}>
              {broadcastActive ? 'BROADCASTING LIVE SCORE' : 'READY TO BROADCAST'}
            </Text>
            <View style={{ flex: 1 }} />
            <Badge
              label={broadcastActive ? 'ON AIR' : 'OFFLINE'}
              variant={broadcastActive ? 'live' : 'local'}
              size="sm"
            />
          </View>

          <Text style={styles.statusMatchTitle}>
            {selectedMatch ? selectedMatch.title : 'No active match selected'}
          </Text>
          <Text style={styles.statusMatchVenue}>
            {selectedMatch ? `${selectedMatch.venue} • ${selectedMatch.format.toUpperCase()} (${selectedMatch.rules.totalOvers} ov)` : 'Create a match to begin'}
          </Text>

          {broadcastActive && (
            <View style={styles.activeStatsRow}>
              <View style={styles.activeStat}>
                <Ionicons name="people" size={16} color={theme.primary} />
                <Text style={styles.activeStatText}>Public Spectator Access Enabled</Text>
              </View>
              <View style={[styles.activeStat, { marginTop: 6 }]}>
                <Ionicons name="sync" size={16} color={theme.primary} />
                <Text style={styles.activeStatText}>Live ball-by-ball score updates</Text>
              </View>
            </View>
          )}

          <View style={styles.actionRow}>
            {!broadcastActive ? (
              <TouchableOpacity
                style={styles.startBroadcastBtn}
                onPress={handleStartScoreBroadcast}
              >
                <Ionicons name="radio" size={18} color={theme.surface} />
                <Text style={styles.startBroadcastBtnText}>Start Live Score Sharing</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.broadcastControlRow}>
                <TouchableOpacity
                  style={styles.shareStreamBtn}
                  onPress={handleSharePublicStream}
                >
                  <Ionicons name="share-social" size={16} color={theme.surface} />
                  <Text style={styles.shareStreamBtnText}>Share Match Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={handleStopScoreBroadcast}
                >
                  <Text style={styles.stopBtnText}>Stop Sharing</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Video Transport Disclosure Box (Gated & Truthful) */}
        <View style={styles.videoGatedCard}>
          <View style={styles.videoHeaderRow}>
            <Ionicons name="videocam-outline" size={20} color={theme.warning} />
            <Text style={styles.videoHeaderTitle}>Video Live Streaming Status</Text>
            <View style={{ flex: 1 }} />
            <View style={styles.blockedBadge}>
              <Text style={styles.blockedBadgeText}>BLOCKED (UNCONFIGURED)</Text>
            </View>
          </View>

          <Text style={styles.videoExplanationText}>
            Video transport and transcoding requires an approved cloud video provider (e.g. AWS IVS, Cloudflare Stream, or YouTube RTMP) and dedicated bandwidth budget.
          </Text>

          <View style={styles.budgetPolicyBox}>
            <Ionicons name="shield-outline" size={16} color={theme.primary} />
            <Text style={styles.budgetPolicyText}>
              Zero-fee guarantee: Cric never enables paid third-party streaming resources without explicit administrative provider and egress cost approval. Free live score broadcasting remains 100% active.
            </Text>
          </View>
        </View>

        {/* Select Match to Broadcast */}
        <View style={styles.matchSelectSection}>
          <Text style={styles.sectionTitle}>SELECT MATCH TO BROADCAST</Text>

          {ongoingMatches.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No matches scheduled or ongoing.</Text>
              <TouchableOpacity
                style={styles.createMatchBtn}
                onPress={() => router.push('/(tabs)/new-match')}
              >
                <Text style={styles.createMatchBtnText}>Start a Match</Text>
              </TouchableOpacity>
            </View>
          ) : (
            ongoingMatches.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.matchOptionCard,
                  selectedMatch?.id === m.id && styles.selectedMatchOption,
                ]}
                onPress={() => setSelectedMatchId(m.id)}
              >
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>{m.title}</Text>
                  <Badge
                    label={m.status === 'live' ? 'LIVE' : m.status.toUpperCase()}
                    variant={m.status === 'live' ? 'live' : 'break'}
                    size="sm"
                  />
                </View>
                <Text style={styles.optionMeta}>
                  {m.venue} • {m.team1.shortName} vs {m.team2.shortName}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: {
      padding: 6,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: 0.3,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    broadcastStatusCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    statusHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    pulseDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },
    statusHeaderText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textSecondary,
      letterSpacing: 0.5,
    },
    statusMatchTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
      marginTop: 4,
    },
    statusMatchVenue: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    activeStatsRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    activeStat: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    activeStatText: {
      fontSize: 12,
      color: theme.text,
      marginLeft: 8,
      fontWeight: '600',
    },
    actionRow: {
      marginTop: 16,
    },
    startBroadcastBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 8,
      minHeight: 48,
    },
    startBroadcastBtnText: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.surface,
      marginLeft: 6,
    },
    broadcastControlRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    shareStreamBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 8,
      marginRight: 8,
      minHeight: 44,
    },
    shareStreamBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.surface,
      marginLeft: 6,
    },
    stopBtn: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.danger,
      minHeight: 44,
      justifyContent: 'center',
    },
    stopBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.danger,
    },
    videoGatedCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    videoHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    videoHeaderTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
      marginLeft: 6,
    },
    blockedBadge: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.warning,
    },
    blockedBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: theme.warning,
    },
    videoExplanationText: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
      marginTop: 4,
    },
    budgetPolicyBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.surfaceAlt,
      padding: 10,
      borderRadius: 8,
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    budgetPolicyText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginLeft: 8,
      flex: 1,
      lineHeight: 16,
    },
    matchSelectSection: {
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    matchOptionCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectedMatchOption: {
      borderColor: theme.primary,
      backgroundColor: theme.primarySubtle,
    },
    optionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    optionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    optionMeta: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    emptyBox: {
      padding: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    createMatchBtn: {
      marginTop: 10,
      backgroundColor: theme.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
      minHeight: 40,
      justifyContent: 'center',
    },
    createMatchBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.surface,
    },
  });
