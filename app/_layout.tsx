import '../global.css'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { PortalHost } from '@rn-primitives/portal'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useMemo } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useCSSVariable, useUniwind } from 'uniwind'

// Keep the native splash (logo on the theme background) until the first frame is laid out, then fade it quickly.
void SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions({ duration: 220, fade: true })

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
  const onReady = useCallback(() => void SplashScreen.hideAsync(), [])
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <View style={{ flex: 1, backgroundColor: navTheme.colors.background }} onLayout={onReady}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }} />
          {/* Sheets and dialogs render here, above every screen (react-native-reusables convention). */}
          <PortalHost />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
