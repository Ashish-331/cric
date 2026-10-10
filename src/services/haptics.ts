import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * CricketHaptics
 * Safe, cross-platform tactile vibrations for real-time scoring actions.
 * Silently catches and no-ops on platforms or devices without haptics support.
 */
export class CricketHaptics {
  /** Light tap for normal selection or dot ball */
  static async dot(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // no-op
    }
  }

  /** Subtle feedback for 1, 2, or 3 runs */
  static async runs(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      // no-op
    }
  }

  /** Crisp double-tap notification for 4 Boundary */
  static async boundaryFour(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // no-op
    }
  }

  /** Heavy impact vibration for 6 Maximum */
  static async maximumSix(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch {
      // no-op
    }
  }

  /** Heavy warning vibration for Wickets */
  static async wicket(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      // no-op
    }
  }

  /** Warning vibration for 1-Tap Undo */
  static async undo(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch {
      // no-op
    }
  }

  /** Multi-pattern pulse for 50 / 100 / Victory Milestones */
  static async milestone(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(async () => {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch {
            // no-op
          }
        }, 150);
      }
    } catch {
      // no-op
    }
  }

  /** Toggle feedback */
  static async toggle(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.selectionAsync();
      }
    } catch {
      // no-op
    }
  }
}
