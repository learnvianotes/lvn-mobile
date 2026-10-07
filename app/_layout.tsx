import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useColors } from '@/lib/theme'

/**
 * Root navigator. The five tabs from spec §13.1 (Home · Explore · Create · Community · Profile) arrive as
 * an (app)/(tabs) group in Phase 1–2, together with the backend features behind them (§20: no screen
 * without its backend).
 */
export default function RootLayout() {
  const colors = useColors()
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaProvider>
  )
}
