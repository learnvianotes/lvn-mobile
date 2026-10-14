import { useMutation, useQuery } from '@apollo/client/react'
import { Plus, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { FindTopicsDocument, MyInterestsDocument, SetInterestsDocument } from '@/graphql/generated/graphql'

const card = 'bg-card border-border gap-3 rounded-2xl border p-5'
const field = 'text-foreground border-border bg-background rounded-xl border px-3 py-2.5 text-base'

/**
 * The topics a person follows (lvn-backend ADR-0076), in Settings: Community's For You shows public notes on them, with
 * their exams' topics and what they read lately. Private; each change is saved at once.
 */
export function InterestsCard() {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const primary = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const { data } = useQuery(MyInterestsDocument, { fetchPolicy: 'cache-and-network' })
  // The profile comes back without the viewer around it: the list is asked for again.
  const [save, saving] = useMutation(SetInterestsDocument, { refetchQueries: [MyInterestsDocument], awaitRefetchQueries: true })
  const [query, setQuery] = useState('')
  const [settled, setSettled] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  const found = useQuery(FindTopicsDocument, { variables: { query: settled }, skip: settled.length < 2 }).data?.findTopics ?? []
  const chosen = (data?.viewer?.profile?.interests ?? []).flatMap((x) => (x ? [x] : []))
  const ids = chosen.map((x) => x.id)
  const set = async (next: string[]) => {
    setError(null)
    const res = await save({ variables: { ids: next } }).catch(() => null)
    setError(res?.data?.updateProfile.userErrors[0]?.message ?? (res ? null : 'That did not work. Try again.'))
  }
  return (
    <View className={card}>
      <Text className="text-base font-semibold" accessibilityRole="header">
        Topics you follow
      </Text>
      <Text className="text-muted-foreground text-sm">Community’s For You shows public notes on these, with your exams’ topics and what you read lately. Only you see them.</Text>
      {chosen.length ? (
        <View className="flex-row flex-wrap gap-2">
          {chosen.map((topic) => (
            <View key={topic.id} className="bg-secondary flex-row items-center gap-1 rounded-full py-1 pl-3 pr-1">
              <Text className="text-primary text-sm">{topic.title}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${topic.title}`} disabled={saving.loading} onPress={() => void set(ids.filter((id) => id !== topic.id))} hitSlop={6} className="rounded-full p-1">
                <X size={14} color={primary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-muted-foreground text-sm">No topics chosen yet.</Text>
      )}
      <TextInput accessibilityLabel="Add a topic" placeholder="Search topics, e.g. Heaps" placeholderTextColor={muted} className={field} value={query} onChangeText={setQuery} autoCorrect={false} />
      {found
        .filter((topic) => !ids.includes(topic.id))
        .slice(0, 8)
        .map((topic) => (
          <Pressable
            key={topic.id}
            accessibilityRole="button"
            accessibilityLabel={`Follow ${topic.title}`}
            disabled={saving.loading}
            onPress={() => void set([...ids, topic.id]).then(() => setQuery(''))}
            className="border-border flex-row items-center gap-2 rounded-xl border px-3 py-2"
          >
            <Plus size={16} color={primary} />
            <Text className="flex-1">
              {topic.title} <Text className="text-muted-foreground text-xs">· {topic.subject.title}</Text>
            </Text>
          </Pressable>
        ))}
      {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
    </View>
  )
}
