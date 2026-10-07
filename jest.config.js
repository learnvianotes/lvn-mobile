/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^lucide-react-native$': '<rootDir>/tests/__mocks__/lucide-react-native.tsx',
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/e2e/'],
  // ES-module packages Jest must transform (jest-expo's list plus our UI stack, ADR-0029).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|uniwind|@rn-primitives/.*)',
  ],
}
