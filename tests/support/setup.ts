// Jest only: Reanimated and its worklets runtime have no native module in Node, and Uniwind has no compiled
// stylesheet here — components fall back to their default colours when a CSS variable is unknown.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))
// The mock module itself gains useReducedMotion, so expo-router/testing-library's own Reanimated mock (which
// returns the same module) has it too.
require('react-native-reanimated/mock').useReducedMotion = () => false
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('uniwind', () => ({
  ...jest.requireActual('uniwind'),
  useCSSVariable: (name: string | string[]) => (Array.isArray(name) ? name.map(() => undefined) : undefined),
}))

// The public build values a development build would inline (env/development.env).
Object.assign(process.env, {
  EXPO_PUBLIC_APP_ENV: 'development',
  EXPO_PUBLIC_WEB_URL: 'http://web.test',
  EXPO_PUBLIC_API_URL: 'http://api.test/graphql',
})

// expo-secure-store has no Keychain/Keystore in Node: an in-memory store per test file (tests/support/secure-store.ts).
jest.mock('expo-secure-store', () => require('./secure-store').secureStore)

// Theme uses the web localStorage keys. Native installs them via expo-sqlite; tests keep an in-memory Storage.
jest.mock('expo-sqlite/localStorage/install', () => ({}))
const memory = new Map<string, string>()
const memoryStorage = {
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (index: number) => Array.from(memory.keys())[index] ?? null,
  get length() {
    return memory.size
  },
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: memoryStorage })

// No native splash screen in Node (its JS warns that options need a development build).
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(async () => true), hideAsync: jest.fn(async () => undefined), setOptions: jest.fn() }))

// No network state in Node: a listener that never fires. Notes sync (features/notes) stays idle in component tests,
// which hold no real access token; its logic is tested in tests/unit/notes.
jest.mock('expo-network', () => ({ addNetworkStateListener: () => ({ remove: () => undefined }), getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }) }))

// Push (ADR-0050): no native module under Jest; tests that need it override these.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getDevicePushTokenAsync: jest.fn(async () => ({ type: 'android', data: '' })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
}))

// Media (lvn-backend P3m): no native players or pickers in Node. The players are stand-ins tests can drive; the pickers
// cancel unless a test says otherwise.
jest.mock('expo-video', () => {
  const { createElement } = require('react')
  const { View } = require('react-native')
  return { useVideoPlayer: jest.fn((source: unknown) => ({ source, play: jest.fn(), pause: jest.fn() })), VideoView: (props: { accessibilityLabel?: string }) => createElement(View, { accessibilityLabel: props.accessibilityLabel, testID: 'video-view' }) }
})
jest.mock('expo-audio', () => {
  const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => undefined) }
  // Voice notes (ADR-0062): a recorder that "records" to a fixed file.
  const recorder = { uri: null as string | null, prepareToRecordAsync: jest.fn(async () => undefined), record: jest.fn(), stop: jest.fn(async () => void (recorder.uri = 'file:///voice.m4a')) }
  return {
    useAudioPlayer: jest.fn(() => player),
    useAudioPlayerStatus: jest.fn(() => ({ playing: false, currentTime: 0, duration: 95 })),
    useAudioRecorder: jest.fn(() => recorder),
    RecordingPresets: { HIGH_QUALITY: {} },
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setAudioModeAsync: jest.fn(async () => undefined),
  }
})
jest.mock('expo-image', () => {
  const { createElement } = require('react')
  const { View } = require('react-native')
  return { Image: (props: { accessibilityLabel?: string; source: { uri: string } }) => createElement(View, { accessibilityRole: 'image', accessibilityLabel: props.accessibilityLabel, testID: `image:${props.source.uri}` }) }
})
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}))
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })) }))
