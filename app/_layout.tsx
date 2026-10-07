import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'

export default function RootLayout() {
  const background = String(useCSSVariable('--color-background') ?? '#f7f7fb')
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }} />
    </SafeAreaProvider>
  )
}
