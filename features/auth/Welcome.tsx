import { LinearGradient } from 'expo-linear-gradient'
import { Link } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { CalendarCheck, Mail, NotebookPen, Users, type LucideIcon } from 'lucide-react-native'
import { useWindowDimensions, View } from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUniwind } from 'uniwind'
import { Logo } from '@/components/brand/Logo'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import { copy } from './copy'
import { useAgeRefused } from './AgeCheck'
import { GoogleButton } from './GoogleButton'
import { Notice } from './Notice'
import { useGoogleSignIn } from './useGoogleSignIn'

const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: NotebookPen, text: copy.welcome.features[0] },
  { icon: CalendarCheck, text: copy.welcome.features[1] },
  { icon: Users, text: copy.welcome.features[2] },
]

/**
 * First screen for someone signed out: the night-sky brand hero (ui-reference: dark hero cards for the moments that
 * matter) above a sheet whose first action is one tap — Continue with Google. Email sign-up and sign-in sit right
 * below it. A returning Google account lands on Home; a new one gives its details once.
 */
export function Welcome() {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { theme } = useUniwind()
  const google = useGoogleSignIn()
  // A device refused an account in the last day (lvn-backend ADR-0091): no email sign-up; signing in still works.
  const refused = useAgeRefused()
  const t = copy.welcome

  return (
    <View className="flex-1" style={{ backgroundColor: '#120F2E' }}>
      <StatusBar style="light" />
      <LinearGradient colors={['#120F2E', '#2B2560', '#4F46E5']} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
      {/* Soft light behind the logo: depth without an image. */}
      <View pointerEvents="none" className="absolute -right-24 -top-16 size-72 rounded-full" style={{ backgroundColor: 'rgba(129,140,248,0.18)' }} />
      <View pointerEvents="none" className="absolute -left-20 top-64 size-56 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />

      <View className="flex-1 justify-center gap-7 px-7" style={{ paddingTop: insets.top + 12 }}>
        <Animated.View entering={FadeInDown.duration(500)} className="flex-row items-center gap-3" accessible accessibilityRole="header" accessibilityLabel="LearnViaNotes">
          <Logo size={52} />
          <Text className="text-2xl font-extrabold tracking-tight text-white">
            LearnVia<Text className="text-2xl font-extrabold tracking-tight" style={{ color: '#A5B4FC' }}>Notes</Text>
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(500)} className="gap-3">
          <Text className="text-[34px] font-extrabold leading-[40px] tracking-tight text-white">{t.headline}</Text>
          <Text className="text-base leading-6" style={{ color: 'rgba(255,255,255,0.78)' }}>{t.lead}</Text>
        </Animated.View>

        {/* On short screens the sheet keeps its room and the highlights give way. */}
        {height >= 720 ? (
          <View className="gap-2.5">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <Animated.View
                key={text}
                entering={FadeInDown.delay(180 + i * 110).duration(500)}
                className="flex-row items-center gap-3 self-start rounded-2xl border px-3.5 py-2.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.14)' }}
              >
                <View className="size-8 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(165,180,252,0.18)' }}>
                  <Icon size={18} color="#C7D2FE" />
                </View>
                <Text className="text-[15px] font-medium text-white">{text}</Text>
              </Animated.View>
            ))}
          </View>
        ) : null}
      </View>

      <Animated.View entering={FadeInUp.delay(250).duration(550)} className="bg-card gap-3 rounded-t-[32px] px-6 pt-7" style={{ paddingBottom: insets.bottom + 20 }}>
        <View className="mb-1 gap-1">
          <Text className="text-xl font-bold tracking-tight" accessibilityRole="header">{t.sheetTitle}</Text>
          <Text className="text-muted-foreground text-sm">{t.sheetLead}</Text>
        </View>

        {refused ? <Notice tone="info">{`${copy.age.refusedTitle}. ${copy.age.refusedLead}`}</Notice> : null}
        {google.error ? <Notice>{google.error}</Notice> : null}
        {google.available ? (
          <GoogleButton testID="welcome-google" tone={theme === 'dark' ? 'light' : 'dark'} busy={google.busy} onPress={() => void google.signIn()} />
        ) : null}

        {refused ? null : (
          <Link href="/sign-up" asChild>
            <PressScale testID="welcome-email" accessibilityRole="button" accessibilityLabel={t.email} disabled={google.busy}>
              <View className={google.available ? 'border-border bg-muted/40 h-14 flex-row items-center justify-center gap-2.5 rounded-full border' : 'bg-primary h-14 flex-row items-center justify-center gap-2.5 rounded-full'}>
                <Mail size={18} color={google.available ? (theme === 'dark' ? '#F4F4F5' : '#1E1B2E') : '#FFFFFF'} />
                <Text className={google.available ? 'text-base font-semibold' : 'text-primary-foreground text-base font-semibold'}>{t.email}</Text>
              </View>
            </PressScale>
          </Link>
        )}

        <View className="flex-row items-center justify-center gap-1 pt-1">
          <Text className="text-muted-foreground text-sm">{t.haveAccount}</Text>
          <Link href="/sign-in" asChild>
            <PressScale testID="welcome-sign-in" feedback="none" accessibilityRole="link" hitSlop={12}>
              <Text className="text-primary text-sm font-semibold">{t.signIn}</Text>
            </PressScale>
          </Link>
        </View>

        <Text className="text-muted-foreground px-4 text-center text-xs leading-5">{t.legal}</Text>
      </Animated.View>
    </View>
  )
}
