import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'raised' | 'outlined' | 'light' | 'dark';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default' }) => {
  const { theme } = useTheme();

  let bg = theme.surface;
  let borderColor = theme.border;

  if (variant === 'raised') {
    bg = theme.raised;
    borderColor = theme.border;
  } else if (variant === 'dark') {
    // Legacy support
    bg = theme.surface;
    borderColor = theme.border;
  } else if (variant === 'light') {
    // Legacy support
    bg = theme.surface;
    borderColor = theme.border;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    padding: 14,
    marginVertical: 4,
    borderWidth: 1,
  },
});
