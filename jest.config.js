/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // tests/unit and tests/components run here; tests/e2e holds Maestro flows for a device or emulator.
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/{unit,components}/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^lucide-react-native$': '<rootDir>/tests/support/mocks/lucide-react-native.js',
    '\\.css$': '<rootDir>/tests/support/mocks/style.js',
  },
  setupFiles: ['<rootDir>/tests/support/setup.ts'],
  // ES-module packages Jest must transform (jest-expo's list plus our UI stack, ADR-0029).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|uniwind|@rn-primitives/.*|standard-navigation|@sentry/.*)',
  ],
}
