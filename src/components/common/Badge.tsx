import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface BadgeProps {
  label: string;
  variant?: 'live' | 'break' | 'completed' | 'synced' | 'local' | 'outline' | 'neutral' | 'custom';
  color?: string;
  backgroundColor?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  color,
  backgroundColor,
  size = 'md',
  style,
  textStyle,
}) => {
  const { theme } = useTheme();

  let bg = backgroundColor || theme.raised;
  let textCol = color || theme.textSecondary;
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (variant === 'live') {
    bg = theme.statusLiveBg;
    textCol = theme.statusLive;
    borderColor = theme.statusLive;
    borderWidth = 1;
  } else if (variant === 'break') {
    bg = theme.statusBreakBg;
    textCol = theme.statusBreak;
    borderColor = theme.statusBreak;
    borderWidth = 1;
  } else if (variant === 'completed') {
    bg = theme.statusCompletedBg;
    textCol = theme.statusCompleted;
  } else if (variant === 'synced') {
    bg = theme.statusSyncedBg;
    textCol = theme.statusSynced;
  } else if (variant === 'local') {
    bg = theme.statusLocalBg;
    textCol = theme.statusLocal;
  } else if (variant === 'neutral') {
    bg = theme.raised;
    textCol = theme.textSecondary;
  } else if (variant === 'outline') {
    bg = 'transparent';
    textCol = color || theme.textSecondary;
    borderColor = theme.border;
    borderWidth = 1;
  }

  const paddingHorizontal = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;
  const paddingVertical = size === 'sm' ? 2 : size === 'lg' ? 4 : 3;
  const fontSize = size === 'sm' ? 10 : size === 'lg' ? 12 : 11;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          paddingHorizontal,
          paddingVertical,
          borderWidth,
          borderColor,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: textCol, fontSize }, textStyle]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 6,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
