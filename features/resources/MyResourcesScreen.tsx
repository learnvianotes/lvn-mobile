import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { ScreenHeader } from '@/features/shell/Form'
import { MyResourcesDocument } from '@/graphql/generated/graphql'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, TYPE_LABEL } from './copy'

const TONE = { PENDING: 'bg-secondary', APPROVED: 'bg-emerald-100', REJECTED: 'bg-red-100' } as const

/** The resources a person sent (lvn-backend ADR-0074), newest first, each with its state and, if rejected, why. */
export function MyResourcesScreen() {
  const insets = useSafeAreaInsets()
  const { data } = useQuery(MyResourcesDocument, { fetchPolicy: 'cache-and-network' })
  const list = data?.myResources ?? []
  return (
    <View className="bg-background flex-1">
      <ScreenHeader
        title="Your resources"
        right={
          <Pressable accessibilityRole="button" onPress={() => router.push('/resources/new')} className="bg-primary rounded-full px-3 py-1.5">
            <Text className="text-primary-foreground text-sm font-semibold">Add a resource</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        <Text className="text-muted-foreground text-sm">Books, courses, tools, software and hardware you sent to the catalogue. Moderators look at each one before it is public.</Text>
        {data && !list.length ? <Text className="text-muted-foreground py-8 text-center">You have not added a resource yet.</Text> : null}
        {list.map((r) => (
          <Pressable key={r.id} accessibilityRole="link" accessibilityLabel={r.title} onPress={() => router.push(`/resources/${r.id}`)} className="bg-card border-border gap-1 rounded-2xl border p-4">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-primary text-xs font-semibold uppercase">{TYPE_LABEL[r.type]}</Text>
              <Text className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', TONE[r.status])}>{STATUS_LABEL[r.status]}</Text>
            </View>
            <Text className="font-semibold">{r.title}</Text>
            <Text className="text-muted-foreground text-xs">{r.host}</Text>
            {r.status === 'REJECTED' && r.reason ? <Text className="text-sm text-red-700">{r.reason}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}
