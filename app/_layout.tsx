import '../global.css'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { PortalHost } from '@rn-primitives/portal'
import { StatusBar } from 'expo-status-bar'
import { useMemo } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useCSSVariable, useUniwind } from 'uniwind'

/** Navigation containers use our tokens, so no screen falls back to React Navigation's default grey. */
function useNavigationTheme() {
  const { theme } = useUniwind()
  const [background, card, text, border, primary, notification] = useCSSVariable([
    '--color-background',
    '--color-card',
    '--color-foreground',
    '--color-border',
    '--color-primary',
    '--color-rose',
  ]) as (string | undefined)[]
  return useMemo(() => {
    const base = theme === 'dark' ? DarkTheme : DefaultTheme
    return {
      ...base,
      colors: {
        ...base.colors,
        background: background ?? base.colors.background,
        card: card ?? base.colors.card,
        text: text ?? base.colors.text,
        border: border ?? base.colors.border,
        primary: primary ?? base.colors.primary,
        notification: notification ?? base.colors.notification,
      },
    }
  }, [theme, background, card, text, border, primary, notification])
}

export default function RootLayout() {
  const navTheme = useNavigationTheme()
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <View style={{ flex: 1, backgroundColor: navTheme.colors.background }}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }} />
          {/* Sheets and dialogs render here, above every screen (react-native-reusables convention). */}
          <PortalHost />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
