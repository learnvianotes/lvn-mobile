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
