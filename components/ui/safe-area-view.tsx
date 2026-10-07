import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context'
import { withUniwind } from 'uniwind'

/**
 * react-native-safe-area-context's SafeAreaView with className support. Uniwind only binds React Native's own
 * components; without this wrapper, className (e.g. the theme background) is silently ignored on devices.
 */
export const SafeAreaView = withUniwind(RNSafeAreaView)
