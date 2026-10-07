import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

/**
 * Short, purposeful haptics (ADR-0029, ADR-0030): a 10–20 ms tick for selections and reviews, a light impact for the
 * create button, a success pattern only for real milestones. Android uses the platform haptics API, not the vibrator.
 */
export const haptic = {
  tick() {
    if (Platform.OS === 'web') return
    void (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
      : Haptics.selectionAsync())
  },
  press() {
    if (Platform.OS === 'web') return
    void (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
  },
  success() {
    if (Platform.OS === 'web') return
    void (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
  },
}
