import { useApolloClient } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { FlatList, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { useLocal } from './hooks'
import * as db from './store/db'
import { syncNow } from './sync/engine'

const KIND = { CREATE_NOTE: 'Creating the note', UPDATE_NOTE: 'Saving changes', TRASH_NOTE: 'Moving it to the trash', RESTORE_NOTE: 'Restoring it' } as const

/**
 * Changes the server refused (§13.2: "a draft is never discarded without the user confirming"): what and why, and
 * the choice to let it go — the note then comes back as the server has it.
 */
export function AttentionScreen() {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const entries = useLocal(() => db.outbox('ATTENTION'), [])
  const titles = useLocal(() => db.listNotes(false).then((n) => new Map(n.map((x) => [x.id, x.title]))), [])
  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top + 6 }}>
      <View className="flex-row items-center gap-2 px-3 pb-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-xl font-extrabold" accessibilityRole="header">
          Needs attention
        </Text>
      </View>
      <FlatList
        data={entries ?? []}
        keyExtractor={(e) => e.op.clientOpId}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text className="text-muted-foreground py-10 text-center">Everything was saved.</Text>}
        renderItem={({ item }) => (
          <View className="bg-card border-border gap-2 rounded-2xl border p-4">
            <Text className="font-semibold">{titles?.get(item.op.noteId) || 'A note'}</Text>
            <Text className="text-muted-foreground text-sm">
              {KIND[item.op.kind]}: {item.message}
            </Text>
            <View className="flex-row gap-2">
              <Pressable accessibilityRole="button" onPress={() => router.push(`/notes/${item.op.noteId}`)} className="bg-secondary rounded-full px-3 py-1.5">
                <Text className="text-secondary-foreground text-sm font-semibold">Open the note</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void db.discard(item.op.clientOpId).then(() => syncNow(client))} className="rounded-full px-3 py-1.5">
                <Text className="text-destructive text-sm font-semibold">Let this change go</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  )
}
