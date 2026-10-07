// Jest only: Reanimated and its worklets runtime have no native module in Node, and Uniwind has no compiled
// stylesheet here — components fall back to their default colours when a CSS variable is unknown.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }))
jest.mock('uniwind', () => ({
  ...jest.requireActual('uniwind'),
  useCSSVariable: (name: string | string[]) => (Array.isArray(name) ? name.map(() => undefined) : undefined),
}))
