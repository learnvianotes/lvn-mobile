import { Link, router } from 'expo-router'
import { BookOpen, CalendarCheck, GraduationCap, MessagesSquare, NotebookPen, Users, type LucideIcon } from 'lucide-react-native'
import { useRef } from 'react'
import { Linking, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { LandingArt } from '@/features/marketing/LandingArt'
import { PublicHeader } from '@/features/shell/PublicHeader'
import { env } from '@/lib/env'
import { useTheme } from '@/lib/theme'
import { useAgeRefused } from './AgeCheck'
import { copy } from './copy'
import { GoogleButton } from './GoogleButton'
import { Notice } from './Notice'
import { useGoogleSignIn } from './useGoogleSignIn'

const TILES: { title: string; body: string; icon: LucideIcon }[] = [
  { title: 'Smart Notes', body: 'Cards, code and pictures', icon: NotebookPen },
  { title: 'AI Learning', body: 'Ask about your notes', icon: MessagesSquare },
  { title: 'Study Groups', body: 'Learn with peers', icon: Users },
  { title: 'Exam Prep', body: 'A plan for the day', icon: CalendarCheck },
  { title: 'Quizzes & Flashcards', body: 'Remember what you read', icon: BookOpen },
  { title: 'Community', body: 'Share and discuss', icon: GraduationCap },
]

const LEGAL = [
  { label: 'Terms of Service', path: '/legal/terms' },
  { label: 'Privacy Policy', path: '/legal/privacy' },
  { label: 'Content licence', path: '/legal/content-licence' },
  { label: 'Grievance Redressal', path: '/legal/grievance' },
]

/**
 * Signed-out home. The same column as the web landing on a phone: public header, one heading,
 * the note illustration, six equal tiles. Google stays available here when the API offers it.
 */
export function Welcome() {
  const google = useGoogleSignIn()
  const refused = useAgeRefused()
  const { scheme } = useTheme()
  const scroll = useRef<ScrollViewInstance>(null)
  const featuresY = useRef(0)
  const brand = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const open = (path: string) => void Linking.openURL(`${env.EXPO_PUBLIC_WEB_URL}${path}`)
  return (
    <View className="bg-background flex-1">
      <PublicHeader onFeatures={() => scroll.current?.scrollTo({ y: featuresY.current, animated: true })} />
      <ScrollView ref={scroll} contentContainerClassName="gap-6 px-4 pb-12 pt-6">
        <View className="bg-secondary self-start rounded-full px-3 py-1">
          <Text className="text-primary text-xs font-semibold">Built by students, learn together</Text>
        </View>
        <View className="gap-3">
          <Text className="text-4xl font-extrabold leading-[40px] tracking-tight" accessibilityRole="header">
            Your Learning Community for a <Text className="text-primary text-4xl font-extrabold leading-[40px] tracking-tight">Brighter Tomorrow</Text>
          </Text>
          <Text className="text-muted-foreground text-base leading-6">Create notes, share knowledge, prepare for exams, learn with AI and grow together.</Text>
        </View>
        {refused ? <Notice tone="info">{`${copy.age.refusedTitle}. ${copy.age.refusedLead}`}</Notice> : null}
        {google.error ? <Notice>{google.error}</Notice> : null}
        <View className="gap-3">
          {refused ? null : (
            <Link href="/sign-up" asChild>
              <Pressable testID="welcome-email" accessibilityRole="button" accessibilityLabel="Get Started Free" className="bg-primary h-12 items-center justify-center rounded-full">
                <Text className="text-primary-foreground text-base font-semibold">Get Started Free</Text>
              </Pressable>
            </Link>
          )}
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-muted-foreground text-sm">Already have an account?</Text>
            <Link href="/sign-in" asChild>
              <Pressable testID="welcome-sign-in" accessibilityRole="link" className="min-h-10 justify-center">
                <Text className="text-primary text-sm font-semibold">Sign in</Text>
              </Pressable>
            </Link>
          </View>
          <Pressable accessibilityRole="link" accessibilityLabel="Browse subjects" onPress={() => router.push('/sign-in')} className="min-h-10 flex-row items-center">
            <Text className="text-primary text-sm font-semibold">Browse subjects →</Text>
          </Pressable>
          {google.available ? <GoogleButton testID="welcome-google" tone={scheme === 'dark' ? 'light' : 'dark'} busy={google.busy} onPress={() => void google.signIn()} /> : null}
        </View>
        <LandingArt />
        <View accessibilityLabel="What you can do" onLayout={(e) => { featuresY.current = e.nativeEvent.layout.y }} className="gap-3">
          <Text className="text-lg font-bold" accessibilityRole="header">
            What you can do
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {TILES.map(({ title, body, icon: Icon }) => (
              <Pressable key={title} accessibilityRole="link" accessibilityLabel={title} onPress={() => router.push('/sign-in')} className="bg-card border-border w-[47%] gap-2 rounded-2xl border p-4">
                <View className="bg-secondary size-10 items-center justify-center rounded-xl">
                  <Icon size={20} color={brand} />
                </View>
                <Text className="font-semibold">{title}</Text>
                <Text className="text-muted-foreground text-xs">{body}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View className="border-border gap-2 border-t pt-6">
          <Text className="font-bold">LearnViaNotes</Text>
          <Text className="text-muted-foreground text-sm">Notes are free to read. Your own notes, groups and classrooms are on the way.</Text>
          <View className="flex-row flex-wrap gap-x-4 gap-y-2">
            {LEGAL.map((item) => (
              <Pressable key={item.path} accessibilityRole="link" accessibilityLabel={item.label} onPress={() => open(item.path)} className="min-h-10 justify-center">
                <Text className="text-muted-foreground text-sm">{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
