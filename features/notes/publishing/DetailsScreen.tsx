import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Choices, Field, Outcome, Pill, ScreenHeader } from '@/features/shell/Form'
import { FindTopicsDocument, OrganiseDocument, PhoneNoteMetaDocument, UpdateNoteDetailsDocument } from '@/graphql/generated/graphql'
import { syncNow } from '../sync/engine'

type Topic = { id: string; title: string; subject: string }

/**
 * Where a note lives and what it is about, on the phone (lvn-backend ADR-0052): its folder, tags and topics, saved on
 * the server like the web's details dialog (last writer wins, §13.2), then pulled so the list can filter by them.
 */
export function DetailsScreen({ id }: { id: string }) {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const meta = useQuery(PhoneNoteMetaDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const organise = useQuery(OrganiseDocument, { fetchPolicy: 'cache-and-network' })
  const [save, saving] = useMutation(UpdateNoteDetailsDocument)
  const [folderId, setFolderId] = useState('')
  const [tags, setTags] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [query, setQuery] = useState('')
  const [settled, setSettled] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const found = useQuery(FindTopicsDocument, { variables: { query: settled }, skip: settled.length < 2 })
  const m = meta.data?.note
  useEffect(() => {
    if (!m || loaded) return
    setFolderId(m.folder?.id ?? '')
    setTags(m.tags.map((t) => t.name).join(', '))
    setTopics(m.topics.map((t) => ({ id: t.id, title: t.title, subject: t.subject.title })))
    setLoaded(true)
  }, [m, loaded])
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  const folders = organise.data?.myFolders ?? []
  const depth = (fid: string | null | undefined): number => (fid ? 1 + depth(folders.find((f) => f.id === fid)?.parentId) : 0)
  const submit = async () => {
    const problem = await attempt(
      () => save({ variables: { input: { noteId: id, folderId: folderId || null, tagNames: tags.split(',').map((s) => s.trim()).filter(Boolean), topicIds: topics.map((t) => t.id) } } }),
      'The details could not be saved. Try again.',
    )
    if (problem) return setError(problem)
    await syncNow(client)
    router.back()
  }
  if (!m) return <View className="bg-background flex-1"><ScreenHeader title="Note details" />{meta.error ? <Text className="text-muted-foreground px-6 py-16 text-center">Connect to the internet to change the note&apos;s details.</Text> : null}</View>
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Note details" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Choices label="Folder" value={folderId} onChange={setFolderId} options={[{ value: '', label: 'No folder' }, ...folders.map((f) => ({ value: f.id, label: `${'  '.repeat(Math.max(0, depth(f.parentId)))}${f.name}` }))]} />
        <Field label="Tags" hint="Separate tags with commas." value={tags} onChangeText={setTags} autoCapitalize="none" placeholder="exam, revision" />
        <View className="gap-2">
          <Text className="text-sm font-semibold">Topics</Text>
          <Text className="text-muted-foreground text-xs">Up to 10 topics, so your note shows up where it belongs.</Text>
          <View className="flex-row flex-wrap gap-2">
            {topics.map((t) => (
              <View key={t.id} className="bg-secondary flex-row items-center gap-1 rounded-full py-1 pl-3 pr-1">
                <Text className="text-secondary-foreground text-sm">
                  {t.title} <Text className="text-muted-foreground text-xs">· {t.subject}</Text>
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${t.title}`} onPress={() => setTopics((list) => list.filter((x) => x.id !== t.id))} className="p-1">
                  <X size={14} color={muted} />
                </Pressable>
              </View>
            ))}
          </View>
          {topics.length < 10 ? <Field label="Search topics" placeholder="Search topics, e.g. binary search" value={query} onChangeText={setQuery} autoCorrect={false} /> : null}
          {settled.length >= 2 && found.data ? (
            found.data.findTopics.length ? (
              found.data.findTopics
                .filter((t) => !topics.some((x) => x.id === t.id))
                .slice(0, 8)
                .map((t) => (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${t.title}`}
                    onPress={() => {
                      setTopics((list) => [...list, { id: t.id, title: t.title, subject: t.subject.title }].slice(0, 10))
                      setQuery('')
                    }}
                    className="border-border rounded-xl border px-3 py-2"
                  >
                    <Text>
                      {t.title} <Text className="text-muted-foreground text-xs">· {t.subject.title}</Text>
                    </Text>
                  </Pressable>
                ))
            ) : (
              <Text className="text-muted-foreground text-sm">No topic matches.</Text>
            )
          ) : null}
        </View>
        <Outcome message={error ? { ok: false, text: error } : null} />
        <View className="flex-row">
          <Pill label="Save" primary disabled={saving.loading} onPress={() => void submit()} />
        </View>
      </ScrollView>
    </View>
  )
}
