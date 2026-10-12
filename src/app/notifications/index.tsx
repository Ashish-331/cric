import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [entryUpdates, setEntryUpdates] = useState(true);
  const [scorerNotices, setScorerNotices] = useState(true);
  const [quietHours, setQuietHours] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Notice Channel Settings */}
        <Text style={styles.sectionTitle}>TRANSACTIONAL ALERTS</Text>

        <View style={styles.prefCard}>
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Text style={styles.prefTitle}>Match Fixtures & Live Wickets</Text>
              <Text style={styles.prefSub}>
                Updates when your registered team fixture starts or finishes.
              </Text>
            </View>
            <Switch
              value={matchAlerts}
              onValueChange={setMatchAlerts}
              trackColor={{ false: '#1E2C4F', true: '#00E676' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.prefRow, { borderTopWidth: 1, borderTopColor: '#121C38', marginTop: 12, paddingTop: 12 }]}>
            <View style={styles.prefInfo}>
              <Text style={styles.prefTitle}>Tournament & Squad Approvals</Text>
              <Text style={styles.prefSub}>
                Notices when captains submit entries or organizers approve lineups.
              </Text>
            </View>
            <Switch
              value={entryUpdates}
              onValueChange={setEntryUpdates}
              trackColor={{ false: '#1E2C4F', true: '#00E676' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.prefRow, { borderTopWidth: 1, borderTopColor: '#121C38', marginTop: 12, paddingTop: 12 }]}>
            <View style={styles.prefInfo}>
              <Text style={styles.prefTitle}>Scorer Assignment & Handover</Text>
              <Text style={styles.prefSub}>
                Alerts when official scoring authority is granted or modified.
              </Text>
            </View>
            <Switch
              value={scorerNotices}
              onValueChange={setScorerNotices}
              trackColor={{ false: '#1E2C4F', true: '#00E676' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Quiet Hours */}
        <Text style={styles.sectionTitle}>QUIET HOURS</Text>
        <View style={styles.prefCard}>
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Text style={styles.prefTitle}>Mute Overnight Push Notices</Text>
              <Text style={styles.prefSub}>
                Silence notifications between 10:00 PM and 7:00 AM local time.
              </Text>
            </View>
            <Switch
              value={quietHours}
              onValueChange={setQuietHours}
              trackColor={{ false: '#1E2C4F', true: '#00E676' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Cost & Policy Disclosure */}
        <View style={styles.disclosureBox}>
          <Ionicons name="information-circle-outline" size={16} color="#00E5FF" />
          <Text style={styles.disclosureText}>
            Zero-SMS Policy: All routine updates use instant in-app alerts and web/native notifications. SMS OTP is reserved exclusively for account authentication.
          </Text>
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  prefCard: {
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginBottom: 16,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefInfo: {
    flex: 1,
    marginRight: 16,
  },
  prefTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  prefSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 16,
  },
  disclosureBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0C142B',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginTop: 8,
  },
  disclosureText: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});
