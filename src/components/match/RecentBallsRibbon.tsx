import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Delivery } from '../../types/cricket';
import { useTheme } from '../../theme/useTheme';

interface RecentBallsRibbonProps {
  deliveries: Delivery[];
}

export const RecentBallsRibbon: React.FC<RecentBallsRibbonProps> = ({ deliveries }) => {
  const { theme } = useTheme();

  // Show last 12 deliveries
  const recent = (deliveries || []).slice(-12);

  const getBallBadgeInfo = (d: Delivery) => {
    if (d.isWicket) {
      return { label: 'W', bg: theme.ballWicket, text: theme.ballWicketText };
    }
    if (d.isSix) {
      return { label: '6', bg: theme.ballSix, text: theme.ballSixText };
    }
    if (d.isBoundary) {
      return { label: '4', bg: theme.ballFour, text: theme.ballFourText };
    }
    if (d.extraType === 'wide') {
      const extraTxt = d.runsExtra > 1 ? `Wd+${d.runsExtra - 1}` : 'Wd';
      return { label: extraTxt, bg: theme.ballExtra, text: theme.ballExtraText };
    }
    if (d.extraType === 'noBall') {
      const extraTxt = d.runsBat > 0 ? `Nb+${d.runsBat}` : 'Nb';
      return { label: extraTxt, bg: theme.ballExtra, text: theme.ballExtraText };
    }
    if (d.extraType === 'bye') {
      return { label: `B${d.runsExtra}`, bg: theme.ballExtra, text: theme.ballExtraText };
    }
    if (d.extraType === 'legBye') {
      return { label: `Lb${d.runsExtra}`, bg: theme.ballExtra, text: theme.ballExtraText };
    }
    if (d.runsBat === 0) {
      return { label: '•', bg: theme.ballDot, text: theme.ballDotText };
    }
    return { label: `${d.runsBat}`, bg: theme.ballRun, text: theme.ballRunText };
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>This Over:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {recent.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>Over just begun</Text>
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginRight: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '800',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
