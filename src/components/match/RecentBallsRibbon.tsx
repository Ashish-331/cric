import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Delivery } from '../../types/cricket';
import { Colors } from '../../utils/colors';

interface RecentBallsRibbonProps {
  deliveries: Delivery[];
}

export const RecentBallsRibbon: React.FC<RecentBallsRibbonProps> = ({ deliveries }) => {
  // Show last 12 deliveries
  const recent = (deliveries || []).slice(-12);

  const getBallBadgeInfo = (d: Delivery) => {
    if (d.isWicket) {
      return { label: 'W', bg: Colors.wicketBadge, text: '#FFF' };
    }
    if (d.isSix) {
      return { label: '6', bg: Colors.sixMaximum, text: '#FFF' };
    }
    if (d.isBoundary) {
      return { label: '4', bg: Colors.fourBoundary, text: '#FFF' };
    }
    if (d.extraType === 'wide') {
      const extraTxt = d.runsExtra > 1 ? `Wd+${d.runsExtra - 1}` : 'Wd';
      return { label: extraTxt, bg: Colors.extraBadge, text: '#FFF' };
    }
    if (d.extraType === 'noBall') {
      const extraTxt = d.runsBat > 0 ? `Nb+${d.runsBat}` : 'Nb';
      return { label: extraTxt, bg: Colors.extraBadge, text: '#FFF' };
    }
    if (d.extraType === 'bye') {
      return { label: `B${d.runsExtra}`, bg: Colors.extraBadge, text: '#FFF' };
    }
    if (d.extraType === 'legBye') {
      return { label: `Lb${d.runsExtra}`, bg: Colors.extraBadge, text: '#FFF' };
    }
    if (d.runsBat === 0) {
      return { label: '•', bg: '#475569', text: '#FFF' };
    }
    return { label: `${d.runsBat}`, bg: Colors.singleRun, text: '#FFF' };
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Over:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {recent.length === 0 ? (
          <Text style={styles.emptyText}>Over just begun</Text>
        ) : (
          recent.map((d, index) => {
            const badge = getBallBadgeInfo(d);
            return (
              <View
                key={d.id || `ball_${index}`}
                style={[styles.badge, { backgroundColor: badge.bg }]}
              >
                <Text style={[styles.badgeText, { color: badge.text }]}>
                  {badge.label}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginVertical: 6,
  },
  title: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 10,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '800',
    fontSize: 12,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
