import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'
import { haptic } from '@/lib/haptics'

jest.mock('expo-haptics', () => ({
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  AndroidHaptics: { Segment_Tick: 'tick', Virtual_Key: 'key', Confirm: 'confirm' },
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}))

const os = (value: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value, configurable: true })
const original = Platform.OS

afterEach(() => {
  os(original)
  jest.clearAllMocks()
})

describe('haptic', () => {
  it('uses the Android haptics API on Android, never the vibrator', () => {
    os('android')
    haptic.tick()
    haptic.press()
    haptic.success()
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(1, 'tick')
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(2, 'key')
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(3, 'confirm')
  })

  it('uses selection, light impact and success feedback on iOS', () => {
    os('ios')
    haptic.tick()
    haptic.press()
    haptic.success()
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1)
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light')
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success')
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled()
  })

  it('does nothing on the web', () => {
    os('web')
    haptic.tick()
    haptic.press()
    haptic.success()
    for (const fn of Object.values(Haptics)) if (jest.isMockFunction(fn)) expect(fn).not.toHaveBeenCalled()
  })
})
