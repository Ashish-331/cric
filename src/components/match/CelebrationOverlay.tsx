import React, { useEffect, useRef } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  View,
} from 'react-native';

export type CelebrationType = 'four' | 'six' | 'wicket' | 'fifty' | 'hundred' | 'win';

interface CelebrationOverlayProps {
  visible: boolean;
  type: CelebrationType | null;
  title?: string;
  subtitle?: string;
  mode?: 'modal' | 'toast';
  onDismiss: () => void;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  visible,
  type,
  title,
  subtitle,
  mode = 'toast',
  onDismiss,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && type) {
      scaleAnim.setValue(0.4);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 1.8 seconds
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, 1800);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [visible, type]);

  const handleDismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  if (!visible || !type) return null;

  const getConfig = () => {
    switch (type) {
      case 'four':
        return {
          bg: '#00E676',
          textColor: '#070D1E',
          icon: 'tennis',
          mainText: title || 'FOUR!',
          sub: subtitle || 'BOUNDARY CRACKED TO THE ROPE!',
        };
      case 'six':
        return {
          bg: '#D500F9',
          textColor: '#FFFFFF',
          icon: 'rocket',
          mainText: title || 'SIX!',
          sub: subtitle || 'MASSIVE MAXIMUM OUT OF THE GROUND!',
        };
      case 'wicket':
        return {
          bg: '#FF1744',
          textColor: '#FFFFFF',
          icon: 'flame',
          mainText: title || 'WICKET!',
          sub: subtitle || 'TIMBER! THE BATTLE IS WON!',
        };
      case 'fifty':
        return {
          bg: '#00E676',
          textColor: '#070D1E',
          icon: 'trophy',
          mainText: title || 'FIFTY! 50',
          sub: subtitle || 'SPLENDID HALF-CENTURY MILESTONE!',
        };
      case 'hundred':
        return {
          bg: '#FFB300',
          textColor: '#070D1E',
          icon: 'medal',
          mainText: title || 'CENTURY! 100',
          sub: subtitle || 'ROARING HUNDRED! STANDING OVATION!',
        };
      case 'win':
        return {
          bg: '#00E5FF',
          textColor: '#070D1E',
          icon: 'trophy',
          mainText: title || 'VICTORY!',
          sub: subtitle || 'MATCH CONCLUDED IN SENSATIONAL FASHION!',
        };
    }
  };

  const config = getConfig();
  const isToast = mode === 'toast';

  if (isToast) {
    return (
      <View style={styles.toastContainer} pointerEvents="box-none">
        <TouchableOpacity activeOpacity={0.9} onPress={handleDismiss}>
          <Animated.View
            style={[
              styles.toastCard,
              {
                backgroundColor: config.bg,
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <Text style={[styles.toastMainText, { color: config.textColor }]}>
              {config.mainText}
            </Text>
            <Text style={[styles.toastSubText, { color: config.textColor }]}>
              {config.sub}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.backdrop}
      onPress={handleDismiss}
    >
      <Animated.View
        style={[
          styles.celebrationCard,
          {
            backgroundColor: config.bg,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Text style={[styles.mainText, { color: config.textColor }]}>
          {config.mainText}
        </Text>
        <Text style={[styles.subText, { color: config.textColor }]}>
          {config.sub}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    maxWidth: '90%',
  },
  toastMainText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  toastSubText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 13, 30, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  celebrationCard: {
    paddingVertical: 24,
    paddingHorizontal: 36,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    maxWidth: '85%',
  },
  mainText: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  subText: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
