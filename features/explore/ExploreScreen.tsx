import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { BookMarked, FileText, Search } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { SearchNotesDocument } from '@/graphql/generated/graphql'

/** A snippet from the API with its matches (U+E000 … U+E001) in bold. */
function Snippet({ text }: { text: string }) {
  return (
    <Text className="text-muted-foreground text-sm leading-5" numberOfLines={3}>
      {text.split(/([^]*)/).map((part, i) =>
        part.startsWith('') ? (
          <Text key={i} className="text-foreground font-semibold">
            {part.slice(1, -1)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  )
}

/** Explore (§13.1): search public notes, your own and the ones shared with you (lvn-backend §10.4); online. */
export function ExploreScreen() {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [settled, setSettled] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSettled(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])
  const ready = settled.length >= 2
  const { data, previousData, loading, error } = useQuery(SearchNotesDocument, { variables: { query: settled }, skip: !ready })
  const found = ready ? (data ?? previousData)?.search : undefined
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const primary = String(useCSSVariable('--color-primary') ?? '#4f46e5')

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top + 12 }}>
      <View className="gap-3 px-4 pb-2">
        <Text className="text-2xl font-extrabold" accessibilityRole="header">
          Explore
        </Text>
        <View className="bg-card border-border flex-row items-center gap-2 rounded-2xl border px-3">
          <Search size={18} color={muted} />
          <TextInput accessibilityLabel="Search notes, people and topics" value={query} onChangeText={setQuery} placeholder="Search notes, people and topics…" placeholderTextColor={muted} className="text-foreground flex-1 py-3 text-base" returnKeyType="search" autoCorrect={false} />
        </View>
        {found?.people.length ? (
          <View className="flex-row flex-wrap gap-2">
            {found.people.map((p) => (
              <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`${p.displayName}, @${p.handle}`} onPress={() => router.push(`/u/${p.handle}`)} className="bg-card border-border flex-row items-center gap-2 rounded-full border py-1 pl-1 pr-3">
                <View className="bg-secondary size-7 items-center justify-center rounded-full">
                  <Text className="text-secondary-foreground text-xs font-bold">{p.displayName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text className="text-sm font-semibold">{p.displayName}</Text>
                {p.globalRole === 'TEACHER' ? <Text className="text-primary text-[10px] font-bold uppercase">Teacher</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        {found?.topics.length ? (
          <View className="flex-row flex-wrap gap-2">
            {found.topics.map((t) => (
              <Pressable key={t.id} accessibilityRole="button" onPress={() => setQuery(t.title)} className="bg-secondary flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
                <BookMarked size={14} color={primary} />
                <Text className="text-secondary-foreground text-sm">{t.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <FlatList
        data={found?.notes ?? []}
        keyExtractor={(h) => h.note.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text className="text-muted-foreground py-8 text-center text-sm">
            {error ? 'Search needs the internet. Your own notes are in My notes.' : !ready ? 'Type to search notes, people and topics.' : loading ? 'Searching…' : `Nothing found for “${settled}”.`}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={item.note.title || 'Untitled note'} onPress={() => router.push(`/notes/${item.note.id}`)} className="bg-card border-border gap-1.5 rounded-2xl border p-4">
            <View className="flex-row items-center gap-2">
              <FileText size={16} color={primary} />
              <Text className="flex-1 font-semibold" numberOfLines={1}>
                {item.note.title || 'Untitled note'}
              </Text>
            </View>
            <Snippet text={item.snippet} />
            <Text className="text-muted-foreground text-xs">by {item.note.owner.displayName}</Text>
          </Pressable>
        )}
      />
    </View>
  )
}
