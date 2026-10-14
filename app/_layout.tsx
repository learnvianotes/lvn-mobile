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
import { watchTimeZone } from '@/lib/learning'
import { restoreSession, useSession } from '@/lib/auth/session'
import { startErrorReporting } from '@/lib/observability'
import { TermsGate } from '@/features/auth/TermsGate'
import { PushSetup } from '@/features/push/push'
import { OfflineBanner } from '@/features/shell/OfflineBanner'

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
  // Days and countdowns in the phone's zone from the first screen (lvn-backend ADR-0067, ADR-0070).
  useEffect(() => watchTimeZone(), [])
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
            {/* Offline, a strip under the status bar pushes every signed-in screen down (P9e). */}
            <OfflineBanner enabled={signedIn && registered}>
              {/* Who sees what (§7.1): signed out → sign-in screens; a provider account without its details → the
                  details form; everyone else → the app. Switching a guard moves to the first screen allowed. */}
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }}>
                <Stack.Protected guard={signedIn && registered}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="notes" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="notification-settings" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="history" />
                  <Stack.Screen name="subjects" />
                  <Stack.Screen name="rhythm" />
                  <Stack.Screen name="achievements" />
                  <Stack.Screen name="contests" />
                  <Stack.Screen name="focus" options={{ animation: 'fade' }} />
                  <Stack.Screen name="teach" />
                  <Stack.Screen name="resources/index" />
                  <Stack.Screen name="resources/saved" />
                  <Stack.Screen name="saved" />
                  <Stack.Screen name="resources/new" />
                  <Stack.Screen name="resources/mine" />
                  <Stack.Screen name="resources/[id]/index" />
                  <Stack.Screen name="resources/[id]/edit" />
                  <Stack.Screen name="exams/index" />
                  <Stack.Screen name="exams/[id]" />
                  <Stack.Screen name="review" />
                  <Stack.Screen name="people" />
                  <Stack.Screen name="skills" />
                  <Stack.Screen name="admin/moderation" />
                  <Stack.Screen name="admin/verification" />
                  <Stack.Screen name="u/[handle]" />
                  <Stack.Screen name="groups/new" />
                  <Stack.Screen name="groups/[id]" />
                  <Stack.Screen name="groups/[id]/doubts/[doubtId]" />
                  <Stack.Screen name="classes/new" />
                  <Stack.Screen name="classes/[id]" />
                  <Stack.Screen name="classes/join/[code]" />
                  <Stack.Screen name="verify" options={{ presentation: 'modal' }} />
                </Stack.Protected>
                <Stack.Protected guard={signedIn && !registered}>
                  <Stack.Screen name="details" />
                </Stack.Protected>
                <Stack.Protected guard={!signedIn}>
                  <Stack.Screen name="(auth)" />
                </Stack.Protected>
              </Stack>
            </OfflineBanner>
            {/* Sheets and dialogs render here, above every screen (react-native-reusables convention). */}
            <PortalHost />
            {signedIn && registered ? <NotesSync /> : null}
            {signedIn && registered ? <PushSetup /> : null}
            {signedIn && registered ? <TermsGate /> : null}
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </ApolloProvider>
  )
}
