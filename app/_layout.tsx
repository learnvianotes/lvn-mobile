import '../global.css'
import { ApolloProvider } from '@apollo/client/react'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { PortalHost } from '@rn-primitives/portal'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useCSSVariable, useUniwind } from 'uniwind'
import { NotesSync } from '@/features/notes/NotesSync'
import { createApolloClient } from '@/lib/apollo'
import { restoreSession, useSession } from '@/lib/auth/session'
import { startErrorReporting } from '@/lib/observability'

// First, so a crash during start-up is reported too (when this build has a Sentry DSN).
startErrorReporting()

// Keep the native splash (logo on the theme background) until the stored session is restored, then fade it quickly.
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
  const [client] = useState(createApolloClient)
  const status = useSession((s) => s.status)
  const registered = useSession((s) => s.registrationComplete !== false)

  useEffect(() => {
    void restoreSession()
  }, [])
  useEffect(() => {
    if (status !== 'restoring') void SplashScreen.hideAsync()
  }, [status])

  if (status === 'restoring') return null
  const signedIn = status === 'signed-in'
  return (
    <ApolloProvider client={client}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <View style={{ flex: 1, backgroundColor: navTheme.colors.background }}>
            <StatusBar style="auto" />
            {/* Who sees what (§7.1): signed out → sign-in screens; a provider account without its details → the
                details form; everyone else → the app. Switching a guard moves to the first screen allowed. */}
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }}>
              <Stack.Protected guard={signedIn && registered}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="notes" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="people" />
                <Stack.Screen name="u/[handle]" />
                <Stack.Screen name="groups/[id]" />
                <Stack.Screen name="verify" options={{ presentation: 'modal' }} />
              </Stack.Protected>
              <Stack.Protected guard={signedIn && !registered}>
                <Stack.Screen name="details" />
              </Stack.Protected>
              <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
            {/* Sheets and dialogs render here, above every screen (react-native-reusables convention). */}
            <PortalHost />
            {signedIn && registered ? <NotesSync /> : null}
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </ApolloProvider>
  )
}
