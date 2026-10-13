import appConfig from '../../../app.config'

/** The app's config plugins (Expo prebuild): what they put in the Android manifest. */
const plugins = () => (appConfig({ config: {} } as never).plugins ?? []).map((p) => (Array.isArray(p) ? p : [p, undefined]) as [string, Record<string, unknown> | undefined])

it('keeps the microphone permission voice notes record with (lvn-backend ADR-0062)', () => {
  const all = plugins()
  expect(all.find(([name]) => name === 'expo-audio')?.[1]?.microphonePermission).toEqual(expect.any(String))
  // A plugin given `microphonePermission: false` writes RECORD_AUDIO tools:node="remove", which strips it for every plugin.
  expect(all.filter(([, options]) => options?.microphonePermission === false).map(([name]) => name)).toEqual([])
})
