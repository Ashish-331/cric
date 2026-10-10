import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../utils/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'light' | 'dark';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'light' }) => {
  return (
    <View
      style={[
        styles.card,
        variant === 'dark' ? styles.darkCard : styles.lightCard,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  lightCard: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  darkCard: {
    backgroundColor: Colors.darkCard,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
});
