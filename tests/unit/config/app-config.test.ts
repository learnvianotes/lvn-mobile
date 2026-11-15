import appConfig from '../../../app.config'

/** The app's config plugins (Expo prebuild): what they put in the Android manifest. */
const plugins = () => (appConfig({ config: {} } as never).plugins ?? []).map((p) => (Array.isArray(p) ? p : [p, undefined]) as [string, Record<string, unknown> | undefined])

it('adds the reversed iOS client id as a URL scheme, and only when that id is set', () => {
  const previous = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '123-abc.apps.googleusercontent.com'
  const plugin = plugins().find(([name]) => name === '@react-native-google-signin/google-signin')
  expect(plugin?.[1]).toEqual({ iosUrlScheme: 'com.googleusercontent.apps.123-abc' })
  if (previous === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = previous
  expect(plugins().some(([name]) => name === '@react-native-google-signin/google-signin')).toBe(false)
})

it('keeps the microphone permission voice notes record with (lvn-backend ADR-0062)', () => {
  const all = plugins()
  expect(all.find(([name]) => name === 'expo-audio')?.[1]?.microphonePermission).toEqual(expect.any(String))
  // A plugin given `microphonePermission: false` writes RECORD_AUDIO tools:node="remove", which strips it for every plugin.
  expect(all.filter(([, options]) => options?.microphonePermission === false).map(([name]) => name)).toEqual([])
})

it('registers the share target for this variant, without changing the app version', () => {
  const plugin = plugins().find(([name]) => name === 'expo-share-intent')
  expect(plugin?.[1]).toEqual(expect.objectContaining({
    iosAppGroupIdentifier: 'group.com.learnvianotes.dev',
    iosShareExtensionBundleIdentifier: 'com.learnvianotes.dev.share-extension',
    androidMainActivityAttributes: { 'android:launchMode': 'singleTask' },
  }))
  const filters = plugin?.[1]?.androidIntentFilters as string[]
  expect(filters).toEqual(expect.arrayContaining(['image/*', 'application/pdf', 'text/plain', 'application/msword']))
  expect(plugin?.[1]?.iosActivationRules).toEqual(expect.stringContaining('public.image'))
  expect(plugin?.[1]?.iosActivationRules).toEqual(expect.stringContaining('com.adobe.pdf'))
  const config = appConfig({ config: {} } as never)
  expect(config.version).toBe('0.1.4')
  expect(config.android?.versionCode).toBe(6)
})

it('ships 0.1.4 (versionCode 6) without background playback or the Play-blocked permissions', () => {
  const config = appConfig({ config: {} } as never)
  expect(config.version).toBe('0.1.4')
  expect(config.android?.versionCode).toBe(6)
  expect(plugins().find(([name]) => name === 'expo-audio')?.[1]?.enableBackgroundPlayback).toBe(false)
  expect(config.android?.blockedPermissions).toEqual([
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ])
})
