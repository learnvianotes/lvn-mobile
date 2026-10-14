import { useMutation, useQuery } from '@apollo/client/react'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Bookmark, BookmarkCheck, BookOpen, Cpu, GraduationCap, Library, Wrench } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ScreenHeader } from '@/features/shell/Form'
import { LoadState } from '@/features/shell/LoadState'
import { ResourcesDocument, SavedResourcesDocument, SaveResourceDocument, UnsaveResourceDocument, type ResourceFieldsFragment, type ResourceSort, type ResourceType } from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { TYPE_LABEL } from './copy'

const TYPES: ResourceType[] = ['BOOK', 'COURSE', 'TOOL', 'SOFTWARE', 'HARDWARE', 'OTHER']
export const TYPE_ICON: Record<ResourceType, typeof BookOpen> = { BOOK: BookOpen, COURSE: GraduationCap, TOOL: Wrench, SOFTWARE: Cpu, HARDWARE: Cpu, OTHER: Library }
export const savesText = (n: number) => (n === 0 ? 'No saves yet' : n === 1 ? 'Saved by 1 person' : `Saved by ${n} people`)

/** The catalogue on the phone (lvn-backend ADR-0075): approved resources, filtered by type and words, most saved first. */
export function CatalogueScreen() {
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [typed, setTyped] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<ResourceType | null>(null)
  const [sort, setSort] = useState<ResourceSort>('POPULAR')
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), 250)
    return () => clearTimeout(timer)
  }, [typed])
  const list = useQuery(ResourcesDocument, { variables: { filter: { type, query: query || null }, sort, first: 20 }, fetchPolicy: 'cache-and-network' })
  const { data, fetchMore } = list
  const items = data?.resources.edges.map((e) => e.node) ?? []
  return (
    <View className="bg-background flex-1">
      <ScreenHeader
        title="Resources"
        right={
          <Pressable accessibilityRole="link" onPress={() => router.push('/saved')} className="rounded-full px-3 py-1.5">
            <Text className="text-primary text-sm font-semibold">Saved</Text>
          </Pressable>
        }
      />
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (data?.resources.pageInfo.hasNextPage) void fetchMore({ variables: { after: data.resources.pageInfo.endCursor }, updateQuery: (prev, { fetchMoreResult }) => ({ resources: { ...fetchMoreResult.resources, edges: [...prev.resources.edges, ...fetchMoreResult.resources.edges] } }) })
        }}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <Text className="text-muted-foreground text-sm">Books, courses, tools and software that learners recommend, checked by our moderators. No shops, no prices.</Text>
            <TextInput accessibilityLabel="Search resources" placeholder="Search resources" placeholderTextColor={muted} value={typed} onChangeText={setTyped} className="border-border bg-card text-foreground rounded-xl border px-3 py-2.5 text-base" />
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel="Type">
              {[null, ...TYPES].map((v) => (
                <Pressable key={v ?? 'all'} accessibilityRole="radio" accessibilityState={{ checked: type === v }} accessibilityLabel={v ? TYPE_LABEL[v] : 'All'} onPress={() => setType(v)} className={cn('rounded-full border px-3 py-1.5', type === v ? 'border-primary bg-primary/10' : 'border-border')}>
                  <Text className={cn('text-sm', type === v && 'text-primary font-semibold')}>{v ? TYPE_LABEL[v] : 'All'}</Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row items-center justify-between">
              <Pressable accessibilityRole="button" onPress={() => setSort(sort === 'POPULAR' ? 'NEWEST' : 'POPULAR')}>
                <Text className="text-primary text-sm font-semibold">{sort === 'POPULAR' ? 'Most saved' : 'Newest'} ⇅</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => router.push('/resources/new')}>
                <Text className="text-primary text-sm font-semibold">Add a resource</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={data ? <Text className="text-muted-foreground py-8 text-center">Nothing here yet. Add the first one!</Text> : <LoadState query={list} message="Resources could not load." />}
        renderItem={({ item }) => <ResourceCard resource={item} />}
      />
    </View>
  )
}

export function ResourceCard({ resource: r, note }: { resource: ResourceFieldsFragment; note?: string }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const Icon = TYPE_ICON[r.type]
  return (
    <View className="bg-card border-border overflow-hidden rounded-2xl border">
      <Pressable accessibilityRole="link" accessibilityLabel={r.title} onPress={() => router.push(`/resources/${r.id}`)} className="flex-row gap-3 p-3">
        <View className="bg-secondary size-16 items-center justify-center overflow-hidden rounded-xl">
          {r.coverUrl ? <Image source={{ uri: r.coverUrl }} style={{ width: 64, height: 64 }} contentFit="contain" accessibilityIgnoresInvertColors /> : <Icon size={28} color={accent} />}
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-primary text-[11px] font-semibold uppercase">{TYPE_LABEL[r.type]}</Text>
          <Text className="font-semibold" numberOfLines={2}>
            {r.title}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {r.author ? `${r.author} · ` : ''}
            {r.host}
          </Text>
          {note ? (
            <Text className="bg-secondary mt-1 rounded-lg px-2 py-1 text-xs" numberOfLines={3}>
              {note}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View className="border-border flex-row items-center justify-between border-t px-3 py-2">
        <Text className="text-muted-foreground text-xs">{savesText(r.saveCount)}</Text>
        <SaveToggle resource={r} />
      </View>
    </View>
  )
}

/** Save and unsave: private, only the count is public (ADR-0075). */
export function SaveToggle({ resource: r }: { resource: Pick<ResourceFieldsFragment, 'id' | 'viewerSaved' | 'status'> }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const [save, saving] = useMutation(SaveResourceDocument)
  const [unsave, unsaving] = useMutation(UnsaveResourceDocument)
  if (r.status !== 'APPROVED') return null
  const Icon = r.viewerSaved ? BookmarkCheck : Bookmark
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={r.viewerSaved ? 'Saved' : 'Save'}
      accessibilityState={{ selected: r.viewerSaved, disabled: saving.loading || unsaving.loading }}
      disabled={saving.loading || unsaving.loading}
      onPress={() => {
        haptic.tick()
        void (r.viewerSaved ? unsave : save)({ variables: { input: { id: r.id } } })
      }}
      className={cn('flex-row items-center gap-1 rounded-full px-3 py-1.5', r.viewerSaved ? 'bg-primary/10' : 'border-border border')}
    >
      <Icon size={14} color={accent} />
      <Text className="text-primary text-sm font-semibold">{r.viewerSaved ? 'Saved' : 'Save'}</Text>
    </Pressable>
  )
}
