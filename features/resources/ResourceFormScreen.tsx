import { useApolloClient, useLazyQuery, useMutation, useQuery } from '@apollo/client/react'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { mimeOf, UploadError, uploadFile } from '@/features/notes/media/NoteMedia'
import { Field, ScreenHeader } from '@/features/shell/Form'
import { MyResourcesDocument, ResourceDocument, ResourcePreviewDocument, ResourceTopicOptionsDocument, SubmitResourceDocument, UpdateResourceDocument, type ResourceFieldsFragment, type ResourceType } from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'
import { RESOURCE_LIMITS } from '@/lib/contracts/validation'
import { cn } from '@/lib/utils'
import { TYPE_LABEL } from './copy'

const TYPES: ResourceType[] = ['BOOK', 'COURSE', 'TOOL', 'SOFTWARE', 'HARDWARE', 'OTHER']
type Topic = { id: string; title: string }
type Picked = { uri: string; name: string; mimeType: string; size: number | null }

/** Adding a resource on the phone, or editing one's own before it is approved (lvn-backend ADR-0074). */
export function ResourceFormScreen({ id }: { id?: string }) {
  const existing = useQuery(ResourceDocument, { variables: { id: id ?? '' }, skip: !id, fetchPolicy: 'network-only' })
  if (id && !existing.data) return <ScreenHeader title="Edit your resource" />
  if (id && !existing.data?.resource?.viewerCan.edit) {
    return (
      <View className="bg-background flex-1">
        <ScreenHeader title="Edit your resource" />
        <Text className="text-muted-foreground px-6 py-16 text-center">This resource is not here.</Text>
      </View>
    )
  }
  return <Form resource={existing.data?.resource ?? undefined} />
}

function Form({ resource }: { resource?: ResourceFieldsFragment }) {
  const insets = useSafeAreaInsets()
  const client = useApolloClient()
  const [url, setUrl] = useState(resource?.url ?? '')
  const [isbn, setIsbn] = useState(resource?.isbn ?? '')
  const [type, setType] = useState<ResourceType | null>(resource?.type ?? null)
  const [title, setTitle] = useState(resource?.title ?? '')
  const [author, setAuthor] = useState(resource?.author ?? '')
  const [description, setDescription] = useState(resource?.description ?? '')
  const [topics, setTopics] = useState<Topic[]>(resource?.topics.flatMap((x) => (x ? [{ id: x.id, title: x.title }] : [])) ?? [])
  const [foundImage, setFoundImage] = useState<string | null>(null)
  const [useFound, setUseFound] = useState(true)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [exists, setExists] = useState<{ id: string; title: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, previewing] = useLazyQuery(ResourcePreviewDocument, { fetchPolicy: 'network-only' })
  const [submit] = useMutation(SubmitResourceDocument)
  const [update] = useMutation(UpdateResourceDocument)

  const lookUp = async (by: 'url' | 'isbn') => {
    setError(null)
    setNote(null)
    setExists(null)
    try {
      const res = await preview({ variables: { input: by === 'url' ? { url } : { isbn } } })
      if (res.error) throw res.error
      const p = res.data?.resourcePreview
      if (!p) return
      if (p.url) setUrl(p.url)
      if (p.isbn) setIsbn(p.isbn)
      if (p.type) setType(p.type)
      if (p.title) setTitle(p.title)
      if (p.author) setAuthor(p.author)
      if (p.description) setDescription(p.description.slice(0, RESOURCE_LIMITS.description))
      setFoundImage(p.imageUrl ?? null)
      setUseFound(!!p.imageUrl)
      setExists(p.existing ? { id: p.existing.id, title: p.existing.title } : null)
      if (!p.found) setNote('We could not read that page. Fill in the details yourself.')
    } catch (e) {
      setError(CombinedGraphQLErrors.is(e) ? (e.errors[0]?.message ?? 'That did not work. Try again.') : 'That did not work. Try again.')
    }
  }

  const choosePicture = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
    const a = res.canceled ? null : res.assets[0]
    if (!a) return
    const name = a.fileName ?? a.uri.split('/').pop() ?? 'cover.jpg'
    const mimeType = mimeOf(name, a.mimeType)
    if (!(RESOURCE_LIMITS.coverTypes as readonly string[]).includes(mimeType) || (a.fileSize ?? 0) > RESOURCE_LIMITS.coverBytes) return setError('Choose a JPEG, PNG or WebP picture under 2 MB.')
    setPicked({ uri: a.uri, name, mimeType, size: a.fileSize ?? null })
  }

  const send = async () => {
    if (!type) return
    setError(null)
    setBusy(true)
    try {
      const coverFileId = picked ? await uploadFile(client, picked, { purpose: 'COVER' }) : null
      const fields = {
        type,
        title,
        url,
        isbn: type === 'BOOK' && isbn.trim() ? isbn.trim() : null,
        author: author.trim() || null,
        description: description.trim() || null,
        topicIds: topics.map((x) => x.id),
        coverFileId,
        imageUrl: !coverFileId && useFound && foundImage ? foundImage : null,
      }
      const payload = resource ? (await update({ variables: { input: { id: resource.id, ...fields } } })).data?.updateResource : (await submit({ variables: { input: fields } })).data?.submitResource
      const problem = payload?.userErrors[0]?.message
      if (problem || !payload?.resource) throw new UploadError(problem ?? 'That did not work. Try again.')
      haptic.success()
      await client.refetchQueries({ include: [MyResourcesDocument] })
      router.replace(`/resources/${payload.resource.id}`)
    } catch (e) {
      setError(e instanceof UploadError ? e.message : CombinedGraphQLErrors.is(e) ? (e.errors[0]?.message ?? 'That did not work. Try again.') : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const ready = !!type && title.trim().length >= RESOURCE_LIMITS.title.min && !!url.trim() && topics.length >= RESOURCE_LIMITS.topics.min && !busy
  const picture = picked?.uri ?? (useFound && foundImage ? foundImage : !foundImage ? resource?.coverUrl : null)
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={resource ? 'Edit your resource' : 'Add a resource'} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">Share something that helped you learn: a book, a course, a tool. Moderators look at it before anyone else can see it. No shop links: the catalogue has no prices.</Text>
        <Field label="Link" value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" maxLength={RESOURCE_LIMITS.url} hint="The page of the book, course or tool" />
        <SmallButton label="Fill in from the page" disabled={!url.trim() || previewing.loading} onPress={() => void lookUp('url')} />
        <Field label="ISBN" value={isbn} onChangeText={setIsbn} keyboardType="number-pad" maxLength={20} hint="For a book: we look it up on Open Library" />
        <SmallButton label="Look up the book" disabled={!isbn.trim() || previewing.loading} onPress={() => void lookUp('isbn')} />
        {previewing.loading ? <Text className="text-muted-foreground text-sm">Reading the page…</Text> : null}
        {note ? <Text className="text-muted-foreground text-sm">{note}</Text> : null}
        {exists ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/resources/${exists.id}`)}>
            <Text className="text-sm">
              This is already in the catalogue: <Text className="text-primary font-semibold">{exists.title}</Text>
            </Text>
          </Pressable>
        ) : null}
        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="What is it?">
          <Text className="text-sm font-semibold">What is it?</Text>
          <View className="flex-row flex-wrap gap-2">
            {TYPES.map((v) => (
              <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: type === v }} accessibilityLabel={TYPE_LABEL[v]} onPress={() => setType(v)} className={cn('rounded-full border px-3 py-1.5', type === v ? 'border-primary bg-primary/10' : 'border-border')}>
                <Text className={cn('text-sm', type === v && 'text-primary font-semibold')}>{TYPE_LABEL[v]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={RESOURCE_LIMITS.title.max} />
        <Field label="By (author or maker, optional)" value={author} onChangeText={setAuthor} maxLength={RESOURCE_LIMITS.author} />
        <Field label="Why it helps (optional)" value={description} onChangeText={setDescription} maxLength={RESOURCE_LIMITS.description} multiline placeholder="What it covers, and who it is for" />
        <TopicPicker picked={topics} onChange={setTopics} />
        <View className="gap-2">
          <Text className="text-sm font-semibold">Picture (optional)</Text>
          {picture ? <Image source={{ uri: picture }} style={{ height: 140, width: 105, borderRadius: 12 }} contentFit="contain" accessibilityIgnoresInvertColors /> : null}
          {foundImage && !picked ? (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm">Use the picture from the page</Text>
              <Switch accessibilityLabel="Use the picture from the page" value={useFound} onValueChange={setUseFound} />
            </View>
          ) : null}
          <SmallButton label="Choose a picture" onPress={() => void choosePicture()} />
        </View>
        {error ? (
          <Text accessibilityRole="alert" className="text-destructive text-sm">
            {error}
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => void send()} className={cn('bg-primary self-start rounded-xl px-4 py-2.5', !ready && 'opacity-50')}>
          <Text className="text-primary-foreground font-semibold">{resource ? (resource.status === 'REJECTED' ? 'Save and send again' : 'Save') : 'Send to moderators'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

function SmallButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} className={cn('border-border self-start rounded-xl border px-3 py-2', disabled && 'opacity-50')}>
      <Text className="font-semibold">{label}</Text>
    </Pressable>
  )
}

/** Curated topics only (lvn-backend ADR-0074): a person's own topics are private to them. */
function TopicPicker({ picked, onChange }: { picked: Topic[]; onChange: (topics: Topic[]) => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [query, setQuery] = useState('')
  const [find, found] = useLazyQuery(ResourceTopicOptionsDocument)
  useEffect(() => {
    if (query.trim().length < 2) return
    const timer = setTimeout(() => void find({ variables: { query: query.trim() } }), 250)
    return () => clearTimeout(timer)
  }, [query, find])
  const options = query.trim().length >= 2 ? (found.data?.resourceTopicOptions ?? []).filter((o) => !picked.some((p) => p.id === o.id)) : []
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold">Topics</Text>
      {picked.length ? (
        <View className="flex-row flex-wrap gap-2">
          {picked.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Remove ${p.title}`} onPress={() => onChange(picked.filter((x) => x.id !== p.id))} className="bg-primary/10 flex-row items-center gap-1 rounded-full px-3 py-1">
              <Text className="text-primary text-sm">{p.title} ×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {picked.length < RESOURCE_LIMITS.topics.max ? (
        <>
          <TextInput accessibilityLabel="Find a topic" placeholder="Find a topic, e.g. arrays" placeholderTextColor={muted} value={query} onChangeText={setQuery} className="border-border bg-card text-foreground rounded-xl border px-3 py-2.5 text-base" />
          <Text className="text-muted-foreground text-xs">Choose 1 to 5 topics from LearnViaNotes’ list.</Text>
          {query.trim().length >= 2 && found.data && !options.length ? <Text className="text-muted-foreground text-sm">No topic has those words.</Text> : null}
          {options.slice(0, 8).map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${o.title}`}
              onPress={() => {
                onChange([...picked, { id: o.id, title: o.title }])
                setQuery('')
              }}
              className="flex-row items-baseline justify-between gap-2 rounded-lg px-3 py-2"
            >
              <Text>{o.title}</Text>
              <Text className="text-muted-foreground text-xs">{o.subjectTitle}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  )
}
