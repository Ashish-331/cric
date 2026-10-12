import React, { useState } from 'react';
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
import { Badge } from '../../components/common/Badge';

export default function GoLiveScreen() {
  const { matches, userProfile } = useCricket();
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [broadcastActive, setBroadcastActive] = useState<boolean>(false);

  const ongoingMatches = matches.filter(
    (m) => m.status === 'live' || m.status === 'innings_break' || m.status === 'scheduled'
  );

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || ongoingMatches[0];

  const handleStartScoreBroadcast = () => {
    if (!selectedMatch) {
      Alert.alert('No Match Selected', 'Please organize or select a match to start broadcasting.');
      return;
    }
    setBroadcastActive(true);
    Alert.alert(
      'Live Score Broadcasting Active 📡',
      `Live ball-by-ball score broadcast is running for ${selectedMatch.title}. Spectators can view live updates on their phones in real-time!`
    );
  };

  const handleSharePublicStream = async () => {
    if (!selectedMatch) return;
    try {
      await Share.share({
        title: `Live Match: ${selectedMatch.title}`,
        message: `Follow live cricket score on Cric: ${selectedMatch.title} — https://cric.app/match/${selectedMatch.id}`,
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
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Go Live & Broadcast</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Broadcast Status Card */}
        <View style={styles.broadcastStatusCard}>
          <View style={styles.statusHeaderRow}>
            <View style={[styles.pulseDot, { backgroundColor: broadcastActive ? '#00E676' : '#94A3B8' }]} />
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
                <Ionicons name="people" size={16} color="#00E5FF" />
                <Text style={styles.activeStatText}>Public Spectator Access Enabled</Text>
              </View>
              <View style={[styles.activeStat, { marginTop: 6 }]}>
                <Ionicons name="sync" size={16} color="#00E676" />
                <Text style={styles.activeStatText}>Zero-latency scorebook sync</Text>
              </View>
            </View>
          )}

          <View style={styles.actionRow}>
            {!broadcastActive ? (
              <TouchableOpacity
                style={styles.startBroadcastBtn}
                onPress={handleStartScoreBroadcast}
              >
                <Ionicons name="radio" size={18} color="#070D1E" />
                <Text style={styles.startBroadcastBtnText}>Start Live Score Sharing</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.broadcastControlRow}>
                <TouchableOpacity
                  style={styles.shareStreamBtn}
                  onPress={handleSharePublicStream}
                >
                  <Ionicons name="share-social" size={16} color="#FFF" />
                  <Text style={styles.shareStreamBtnText}>Share Match Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={() => setBroadcastActive(false)}
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
            <Ionicons name="videocam-outline" size={20} color="#FFB300" />
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
            <Ionicons name="shield-outline" size={16} color="#00E676" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#070D1E',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  broadcastStatusCard: {
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
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
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  statusMatchTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statusMatchVenue: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  activeStatsRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#121C38',
  },
  activeStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeStatText: {
    fontSize: 12,
    color: '#E2E8F0',
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
    backgroundColor: '#00E676',
    paddingVertical: 12,
    borderRadius: 8,
  },
  startBroadcastBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#070D1E',
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
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  shareStreamBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    marginLeft: 6,
  },
  stopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E2C4F',
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF1744',
  },
  videoGatedCard: {
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
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
    color: '#FFFFFF',
    marginLeft: 6,
  },
  blockedBadge: {
    backgroundColor: '#3F1219',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  blockedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F87171',
  },
  videoExplanationText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginTop: 4,
  },
  budgetPolicyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#070D1E',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#121C38',
  },
  budgetPolicyText: {
    fontSize: 11,
    color: '#E2E8F0',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  matchSelectSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
  },
  matchOptionCard: {
    backgroundColor: '#0C142B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  selectedMatchOption: {
    borderColor: '#00E676',
    backgroundColor: '#071520',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  optionMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  createMatchBtn: {
    marginTop: 10,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createMatchBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
});
