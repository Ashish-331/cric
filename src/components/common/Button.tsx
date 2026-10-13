import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'wicket' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const { theme } = useTheme();

  let bg = theme.brand;
  let textColor = theme.brandText;
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (variant === 'secondary') {
    bg = theme.raised;
    textColor = theme.textPrimary;
    borderColor = theme.border;
    borderWidth = 1;
  } else if (variant === 'outline') {
    bg = 'transparent';
    textColor = theme.brand;
    borderColor = theme.brand;
    borderWidth = 1.5;
  } else if (variant === 'danger' || variant === 'wicket') {
    bg = theme.statusError;
    textColor = '#FFFFFF';
  } else if (variant === 'subtle') {
    bg = theme.brandTint;
    textColor = theme.brand;
  }

  const minHeight = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  const paddingVertical = size === 'sm' ? 6 : size === 'lg' ? 14 : 10;
  const paddingHorizontal = size === 'sm' ? 12 : size === 'lg' ? 24 : 16;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? (theme.raised) : bg,
          borderColor: disabled ? theme.border : borderColor,
          borderWidth,
          paddingVertical,
          paddingHorizontal,
          minHeight,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              {
                color: disabled ? theme.textMuted : textColor,
                fontSize,
                marginLeft: icon ? 6 : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
