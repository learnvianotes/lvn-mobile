import { Link } from 'expo-router'
import { View } from 'react-native'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { SafeAreaView } from '@/components/ui/safe-area-view'
import { Text } from '@/components/ui/text'
import { copy } from './copy'

/** First screen for someone signed out: the brand and two ways in. */
export function Welcome() {
  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center justify-center gap-5 px-8">
        <Logo size={88} />
        <Text className="text-3xl font-extrabold tracking-tight" accessibilityRole="header">LearnViaNotes</Text>
        <Text className="text-muted-foreground text-center text-base">{copy.welcome.lead}</Text>
      </View>
      <View className="gap-3 px-6 pb-8">
        <Link href="/sign-up" asChild>
          <Button size="lg">
            <Text>{copy.welcome.create}</Text>
          </Button>
        </Link>
        <Link href="/sign-in" asChild>
          <Button size="lg" variant="outline">
            <Text>{copy.welcome.signIn}</Text>
          </Button>
        </Link>
      </View>
    </SafeAreaView>
  )
}
