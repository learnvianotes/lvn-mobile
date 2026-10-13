import { useQuery } from '@apollo/client/react'
import { router, useLocalSearchParams } from 'expo-router'
import { BookMarked, Clock, FileText, GraduationCap, Search, Users, X, Library } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { SearchDocument, type NoteKind, type NoteSource, type SearchQuery } from '@/graphql/generated/graphql'
import { forget, recentSearches, remember } from './recent'
import { track } from '@/lib/learning'

const KINDS: { kind: NoteKind; label: string }[] = [
  { kind: 'NOTE', label: 'Notes' },
  { kind: 'BLOG', label: 'Blog posts' },
  { kind: 'POST', label: 'Posts' },
  { kind: 'PROJECT', label: 'Projects' },
]
const SOURCES: { source: NoteSource; label: string }[] = [
  { source: 'MINE', label: 'Mine' },
  { source: 'SHARED', label: 'Shared with me' },
  { source: 'PUBLIC', label: 'Public' },
]
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.kind, k.label])) as Record<NoteKind, string>

/** A snippet from the API with its matches (U+E000 … U+E001) in bold. */
function Snippet({ text }: { text: string }) {
  return (
    <Text className="text-muted-foreground text-sm leading-5" numberOfLines={3}>
      {text.split(/(\uE000[^\uE001]*\uE001)/).map((part, i) =>
        part.startsWith('\uE000') ? (
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

function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${selected ? 'bg-primary' : 'border-border border'}`}>
      {icon}
      <Text className={selected ? 'text-primary-foreground text-xs font-semibold' : 'text-xs font-semibold'}>{label}</Text>
    </Pressable>
  )
}

/**
 * Explore (§13.1, lvn-backend ADR-0056): search notes, people, groups, classes and topics; kind and source chips narrow
 * the notes, a topic lists its notes, "More results" brings the next ones. Recent searches stay on the phone. Online.
 */
export function ExploreScreen() {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [settled, setSettled] = useState('')
  const [kinds, setKinds] = useState<NoteKind[]>([])
  const [sources, setSources] = useState<NoteSource[]>([])
  const [topic, setTopic] = useState<{ id: string; title: string } | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  // Home's search bar (focus), a recommendation's topic (topic, topicTitle) or its words (q) open Explore ready.
  const params = useLocalSearchParams<{ focus?: string; q?: string; topic?: string; topicTitle?: string }>()
  const input = useRef<TextInput>(null)
  useEffect(() => {
    if (params.focus) input.current?.focus()
  }, [params.focus])
  useEffect(() => {
    if (params.topic && params.topicTitle) setTopic({ id: params.topic, title: params.topicTitle })
  }, [params.topic, params.topicTitle])
  useEffect(() => {
    if (params.q) setQuery(params.q)
  }, [params.q])
  useEffect(() => {
    void recentSearches().then(setRecent)
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setSettled(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])
  // Words left in place for two seconds are a search made (SEARCH_PERFORMED, lvn-backend ADR-0067); not the words.
  useEffect(() => {
    if (settled.length < 2) return
    const t = setTimeout(() => void track('SEARCH_PERFORMED', { metadata: { scopes: 'ALL', words: settled.split(/\s+/).length } }), 2_000)
    return () => clearTimeout(t)
  }, [settled])
  const filtering = kinds.length > 0 || sources.length > 0 || !!topic
  const ready = settled.length >= 2 || filtering
  const variables = { query: settled, ...(filtering ? { filters: { kinds: kinds.length ? kinds : null, sources: sources.length ? sources : null, topicId: topic?.id ?? null } } : {}) }
  const { data, previousData, loading, error, fetchMore } = useQuery(SearchDocument, { variables, skip: !ready })
  const found = ready ? (data ?? previousData)?.search : undefined
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const primary = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  /** Opens a result, remembering what was searched for it. */
  const open = (path: string) => {
    if (settled.length >= 2) void remember(settled).then(setRecent)
    router.push(path as never)
  }
  const more = async () => {
    if (!found?.notesCursor) return
    setLoadingMore(true)
    try {
      await fetchMore({
        variables: { ...variables, after: found.notesCursor },
        updateQuery: (previous, { fetchMoreResult }) => {
          const prev = previous as SearchQuery
          const next = fetchMoreResult as SearchQuery
          return { search: { ...prev.search, notes: [...prev.search.notes, ...next.search.notes], notesCursor: next.search.notesCursor } }
        },
      })
    } finally {
      setLoadingMore(false)
    }
  }

  const places = [...(found?.groups ?? []).map((g) => ({ id: g.id, name: g.name, path: `/groups/${g.id}`, what: g.type === 'PROJECT' ? 'Project workspace' : g.privacy === 'PRIVATE' ? 'Private group' : 'Group', members: g.memberCount, icon: 'group' as const })), ...(found?.classrooms ?? []).map((c) => ({ id: c.id, name: c.name, path: `/classes/${c.id}`, what: 'Class', members: c.memberCount, icon: 'class' as const }))]

  const header = (
    <View className="gap-3">
      {found?.people.length ? (
        <View className="flex-row flex-wrap gap-2">
          {found.people.map((p) => (
            <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`${p.displayName}, @${p.handle}`} onPress={() => open(`/u/${p.handle}`)} className="bg-card border-border flex-row items-center gap-2 rounded-full border py-1 pl-1 pr-3">
              <View className="bg-secondary size-7 items-center justify-center rounded-full">
                <Text className="text-secondary-foreground text-xs font-bold">{p.displayName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text className="text-sm font-semibold">{p.displayName}</Text>
              {p.globalRole === 'TEACHER' ? <Text className="text-primary text-[10px] font-bold uppercase">Teacher</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {places.length ? (
        <View className="gap-2">
          <Text className="text-muted-foreground text-xs font-semibold uppercase" accessibilityRole="header">
            Groups and classes
          </Text>
          {places.map((p) => (
            <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`${p.name}, ${p.what}, ${p.members} ${p.members === 1 ? 'member' : 'members'}`} onPress={() => open(p.path)} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border px-4 py-3">
              {p.icon === 'group' ? <Users size={16} color={primary} /> : <GraduationCap size={16} color={primary} />}
              <View className="flex-1">
                <Text className="font-semibold" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text className="text-muted-foreground text-xs">
                  {p.what} · {p.members} {p.members === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {found?.resources.length ? (
        <View className="gap-2">
          <Text className="text-muted-foreground text-xs font-semibold uppercase" accessibilityRole="header">
            Resources
          </Text>
          {found.resources.map((r) => (
            <Pressable key={r.id} accessibilityRole="link" accessibilityLabel={`${r.title}, ${r.host}`} onPress={() => open(`/resources/${r.id}`)} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border px-4 py-3">
              <Library size={16} color={primary} />
              <View className="flex-1">
                <Text className="font-semibold" numberOfLines={1}>
                  {r.title}
                </Text>
                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                  {r.author ? `${r.author} · ` : ''}
                  {r.host}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {found?.topics.length ? (
        <View className="flex-row flex-wrap gap-2">
          {found.topics.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`Notes about ${t.title}`}
              onPress={() => {
                setTopic({ id: t.id, title: t.title })
                setQuery('')
                setSettled('')
              }}
              className="bg-secondary flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            >
              <BookMarked size={14} color={primary} />
              <Text className="text-secondary-foreground text-sm">{t.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {found ? (
        <Text className="text-muted-foreground text-xs font-semibold uppercase" accessibilityRole="header">
          {settled.length < 2 && filtering ? 'Notes, newest first' : 'Notes'}
        </Text>
      ) : null}
    </View>
  )

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top + 12 }}>
      <View className="gap-3 px-4 pb-2">
        <Text className="text-2xl font-extrabold" accessibilityRole="header">
          Explore
        </Text>
        <View className="bg-card border-border flex-row items-center gap-2 rounded-2xl border px-3">
          <Search size={18} color={muted} />
          <TextInput
            ref={input}
            accessibilityLabel="Search notes, people, groups and topics"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void remember(query).then(setRecent)}
            placeholder="Search notes, people, groups and topics…"
            placeholderTextColor={muted}
            className="text-foreground flex-1 py-3 text-base"
            returnKeyType="search"
            autoCorrect={false}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear the search" hitSlop={8} onPress={() => setQuery('')}>
              <X size={18} color={muted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {KINDS.map(({ kind, label }) => (
            <Chip key={kind} label={label} selected={kinds.includes(kind)} onPress={() => setKinds(toggle(kinds, kind))} />
          ))}
          <View className="bg-border mx-1 w-px" />
          {SOURCES.map(({ source, label }) => (
            <Chip key={source} label={label} selected={sources.includes(source)} onPress={() => setSources(toggle(sources, source))} />
          ))}
        </ScrollView>
        {topic ? (
          <View className="flex-row">
            <Chip label={`About ${topic.title}`} selected onPress={() => setTopic(null)} icon={<X size={12} color="white" />} />
          </View>
        ) : null}
      </View>
      {!ready ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 8 }} keyboardShouldPersistTaps="handled">
          {recent.length ? (
            <>
              <View className="flex-row items-center justify-between">
                <Text className="text-muted-foreground text-xs font-semibold uppercase" accessibilityRole="header">
                  Recent searches
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Clear recent searches" onPress={() => void forget(null).then(setRecent)}>
                  <Text className="text-primary text-xs font-semibold">Clear</Text>
                </Pressable>
              </View>
              {recent.map((r) => (
                <View key={r} className="flex-row items-center gap-3">
                  <Pressable accessibilityRole="button" accessibilityLabel={`Search for “${r}” again`} onPress={() => setQuery(r)} className="flex-1 flex-row items-center gap-3 py-2">
                    <Clock size={16} color={muted} />
                    <Text className="flex-1" numberOfLines={1}>
                      {r}
                    </Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove “${r}” from recent searches`} hitSlop={8} onPress={() => void forget(r).then(setRecent)}>
                    <X size={16} color={muted} />
                  </Pressable>
                </View>
              ))}
            </>
          ) : (
            <Text className="text-muted-foreground py-8 text-center text-sm">Type to search notes, people, groups and topics, or choose a kind of note above.</Text>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={found?.notes ?? []}
          keyExtractor={(h) => h.note.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text className="text-muted-foreground py-8 text-center text-sm">
              {error ? 'Search needs the internet. Your own notes are in My notes.' : loading ? 'Searching…' : settled ? `Nothing found for “${settled}”.` : 'No notes match these filters.'}
            </Text>
          }
          ListFooterComponent={
            found?.notesCursor ? (
              <Pressable accessibilityRole="button" accessibilityLabel={loadingMore ? 'Loading more results' : 'More results'} accessibilityState={{ disabled: loadingMore }} disabled={loadingMore} onPress={() => void more()} className="border-border self-center rounded-full border px-4 py-2">
                <Text className="text-sm font-semibold">{loadingMore ? 'Loading…' : 'More results'}</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={item.note.title || 'Untitled note'} onPress={() => open(`/notes/${item.note.id}`)} className="bg-card border-border gap-1.5 rounded-2xl border p-4">
              <View className="flex-row items-center gap-2">
                <FileText size={16} color={primary} />
                <Text className="flex-1 font-semibold" numberOfLines={1}>
                  {item.note.title || 'Untitled note'}
                </Text>
                {item.note.kind !== 'NOTE' ? <Text className="text-muted-foreground text-[11px]">{KIND_LABEL[item.note.kind]}</Text> : null}
              </View>
              {item.snippet ? <Snippet text={item.snippet} /> : null}
              <Text className="text-muted-foreground text-xs">by {item.note.owner.displayName}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
