import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../../utils/colors';

interface BadgeProps {
  label: string;
  variant?: 'live' | 'break' | 'completed' | 'synced' | 'local' | 'outline' | 'custom';
  color?: string;
  backgroundColor?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'custom',
  color,
  backgroundColor,
  size = 'md',
  style,
}) => {
  let bg = backgroundColor || Colors.pitchGreen;
  let textCol = color || Colors.textLight;

  if (variant === 'live') {
    bg = Colors.statusLive;
    textCol = '#FFFFFF';
  } else if (variant === 'break') {
    bg = Colors.statusBreak;
    textCol = '#FFFFFF';
  } else if (variant === 'completed') {
    bg = Colors.statusCompleted;
    textCol = '#FFFFFF';
  } else if (variant === 'synced') {
    bg = '#E0F2FE';
    textCol = '#0369A1';
  } else if (variant === 'local') {
    bg = '#F1F5F9';
    textCol = '#475569';
  } else if (variant === 'outline') {
    bg = 'transparent';
    textCol = color || Colors.textSecondary;
  }

  const paddingHorizontal = size === 'sm' ? 6 : size === 'lg' ? 12 : 8;
  const paddingVertical = size === 'sm' ? 2 : size === 'lg' ? 4 : 3;
  const fontSize = size === 'sm' ? 10 : size === 'lg' ? 13 : 11;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          paddingHorizontal,
          paddingVertical,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: variant === 'outline' ? textCol : 'transparent',
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: textCol, fontSize }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
