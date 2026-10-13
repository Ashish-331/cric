import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [entryUpdates, setEntryUpdates] = useState(true);
  const [scorerNotices, setScorerNotices] = useState(true);
  const [quietHours, setQuietHours] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.canvas,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Notice Channel Settings */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TRANSACTIONAL ALERTS</Text>

        <View
          style={[
            styles.prefCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>Match Fixtures & Live Scores</Text>
              <Text style={[styles.prefSub, { color: colors.textSecondary }]}>
                Updates when your registered team fixture starts or finishes.
              </Text>
            </View>
            <Switch
              value={matchAlerts}
              onValueChange={setMatchAlerts}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor={colors.surface}
            />
          </View>

          <View
            style={[
              styles.prefRow,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 14, paddingTop: 14 },
            ]}
          >
            <View style={styles.prefInfo}>
              <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>Tournament & Lineup Updates</Text>
              <Text style={[styles.prefSub, { color: colors.textSecondary }]}>
                Notices when captains submit entries or organizers approve lineups.
              </Text>
            </View>
            <Switch
              value={entryUpdates}
              onValueChange={setEntryUpdates}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor={colors.surface}
            />
          </View>

          <View
            style={[
              styles.prefRow,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 14, paddingTop: 14 },
            ]}
          >
            <View style={styles.prefInfo}>
              <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>Scorer Assignment & Handover</Text>
              <Text style={[styles.prefSub, { color: colors.textSecondary }]}>
                Alerts when official scoring authority is granted or modified.
              </Text>
            </View>
            <Switch
              value={scorerNotices}
              onValueChange={setScorerNotices}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Quiet Hours */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>QUIET HOURS</Text>
        <View
          style={[
            styles.prefCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>Mute Overnight Notifications</Text>
              <Text style={[styles.prefSub, { color: colors.textSecondary }]}>
                Silence notifications between 10:00 PM and 7:00 AM local time.
              </Text>
            </View>
            <Switch
              value={quietHours}
              onValueChange={setQuietHours}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Policy Disclosure */}
        <View
          style={[
            styles.disclosureBox,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.brand} />
          <Text style={[styles.disclosureText, { color: colors.textSecondary }]}>
            All routine match updates use instant in-app alerts and notifications. Verified email is used for account security.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  prefCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
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
    fontWeight: '700',
  },
  prefSub: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  disclosureBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  disclosureText: {
    fontSize: 12,
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
});
