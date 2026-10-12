import { useApolloClient, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Cloud, CloudOff, Plus, Square, Trash2, Volume2 } from 'lucide-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { RemoteNoteDocument } from '@/graphql/generated/graphql'
import type { CardType } from '@/lib/contracts/domain/enums'
import { cardPlainText } from '@/lib/contracts/validation'
import { cn } from '@/lib/utils'
import { CardEditor, PHONE_EDITABLE } from './editor/CardEditor'
import { useLocal, useSyncStatus } from './hooks'
import type { LocalCard, LocalNote } from './model/types'
import { useReadAloud } from './readAloud'
import { CardView } from './render/CardView'
import * as actions from './store/actions'
import * as db from './store/db'
import { syncSoon } from './sync/engine'
import { readerPath } from '@/features/reader/paths'
import { Discussion } from '@/features/discussion/Discussion'
import { NoteCredits } from '@/features/workspaces/Credits'
import { MakeCopyButton, NoteStatus, useNoteActions } from './publishing/NoteActions'

const NEW_CARDS: { type: CardType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'heading', label: 'Heading' },
  { type: 'checklist', label: 'Checklist' },
  { type: 'code', label: 'Code' },
  { type: 'quote', label: 'Quote' },
  { type: 'callout', label: 'Callout' },
]

/** A note on the phone: the editor for its owner and editors, the reader for others, offline either way (§13.2). */
export function NoteScreen({ id }: { id: string }) {
  const note = useLocal(() => db.getNote(id), [id])
  const cards = useLocal(() => db.getCards(id), [id])
  if (note === undefined || cards === undefined) return <Loading />
  if (note === null) return <RemoteNote id={id} />
  return note.access === 'READER' || note.deletedAt ? <Reader note={note} cards={cards} /> : <Editor note={note} cards={cards} />
}

function Loading() {
  return (
    <View className="bg-background flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  )
}

function Header({ children, title }: { children?: React.ReactNode; title?: string }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  return (
    <View className="bg-background border-border flex-row items-center gap-2 border-b px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/notes'))} className="rounded-full p-2">
        <ArrowLeft size={22} color={fg} />
      </Pressable>
      <Text className="flex-1 text-base font-semibold" numberOfLines={1}>
        {title ?? ''}
      </Text>
      {children}
    </View>
  )
}

function SyncBadge({ unsent }: { unsent: boolean }) {
  const status = useSyncStatus()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const offline = status.state === 'offline'
  const label = unsent ? (offline ? 'Saved on this phone' : 'Sending…') : 'Saved'
  return (
    <View className="bg-secondary flex-row items-center gap-1.5 rounded-full px-2.5 py-1" accessibilityLabel={label}>
      {offline && unsent ? <CloudOff size={14} color={muted} /> : unsent ? <Cloud size={14} color={muted} /> : <Check size={14} color={muted} />}
      <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
    </View>
  )
}

function ReadAloudButton({ reader }: { reader: ReturnType<typeof useReadAloud> }) {
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={reader.playing ? 'Stop reading' : 'Read aloud'} onPress={() => (reader.playing ? reader.stop() : reader.play())} className="rounded-full p-2">
      {reader.playing ? <Square size={20} color={fg} /> : <Volume2 size={22} color={fg} />}
    </Pressable>
  )
}

function Editor({ note, cards }: { note: LocalNote; cards: LocalCard[] }) {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState(note.title)
  const unsent = useLocal(() => db.unsentNoteIds().then((s) => s.has(note.id)), [note.id]) ?? false
  const spoken = useMemo(() => cards.map((c) => ({ id: c.id, text: cardPlainText(c.type, c.content) })), [cards])
  const reader = useReadAloud(spoken)
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const primary = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const changed = () => syncSoon(client)

  // A note made here opens on its empty first card, ready to type.
  useEffect(() => {
    if (note.localOnly && cards.length === 1 && !cardPlainText(cards[0]!.type, cards[0]!.content)) setSelected(cards[0]!.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTitle = (value: string) => {
    setTitle(value)
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => void actions.setTitle(note.id, value).then(changed), 400)
  }
  const add = async (type: CardType) => {
    setAdding(false)
    const after = cards.find((c) => c.id === selected) ?? cards.at(-1) ?? null
    const card = await actions.addCard(note.id, type, after)
    setSelected(card.id)
    changed()
  }
  const trash = () =>
    Alert.alert('Move to trash?', 'You can restore it from the trash for 30 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to trash',
        style: 'destructive',
        onPress: async () => {
          await actions.trashNote(note.id, true)
          changed()
          router.back()
        },
      },
    ])

  const owner = useNoteActions(note, trash)

  return (
    <KeyboardAvoidingView className="bg-background flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header>
        <SyncBadge unsent={unsent} />
        <ReadAloudButton reader={reader} />
        {note.access === 'OWNER' ? owner.button : null}
      </Header>
      {note.access === 'OWNER' ? owner.sheet : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 12 }} keyboardShouldPersistTaps="handled">
        <TextInput
          accessibilityLabel="Title"
          value={title}
          onChangeText={onTitle}
          placeholder="Untitled note"
          placeholderTextColor={muted}
          className="text-foreground text-3xl font-extrabold"
          multiline
        />
        {note.access === 'EDITOR' ? <Text className="text-muted-foreground text-xs">Editing {note.ownerName}’s note</Text> : null}
        {note.access === 'OWNER' ? <NoteStatus status={owner.status} message={owner.message} verifyToPublish={owner.verifyToPublish} /> : null}
        {cards.map((card, i) => {
          const editing = selected === card.id && PHONE_EDITABLE.has(card.type)
          return (
            <View key={card.id} className={cn('rounded-2xl', editing ? 'border-primary bg-card border-2 p-3' : 'p-1')}>
              {editing ? (
                <CardEditor card={card} onChange={(content) => void actions.saveCard(card, content).then(changed)} />
              ) : (
                <Pressable accessibilityRole="button" accessibilityHint={PHONE_EDITABLE.has(card.type) ? 'Edits this card' : 'Edit this card on the web'} onPress={() => setSelected(card.id)} onLongPress={() => reader.play(card.id)}>
                  <CardView type={card.type} content={card.content} highlighted={reader.current === card.id} onOpenFile={(fileId) => router.push(readerPath(note.id, fileId))} onAnchor={(a) => router.push(readerPath(note.id, a.fileId, { page: a.page, card: card.id }))} />
                  {!cardPlainText(card.type, card.content) && PHONE_EDITABLE.has(card.type) ? <Text className="text-muted-foreground text-base">Tap to write…</Text> : null}
                </Pressable>
              )}
              {selected === card.id ? (
                <View className="mt-2 flex-row items-center gap-1">
                  {!PHONE_EDITABLE.has(card.type) ? <Text className="text-muted-foreground flex-1 text-xs">Edit this card on the web.</Text> : <View className="flex-1" />}
                  <Pressable accessibilityRole="button" accessibilityLabel="Move card up" disabled={i === 0} onPress={() => void actions.moveCard(card, -1).then(changed)} className={cn('rounded-full p-2', i === 0 && 'opacity-30')}>
                    <ArrowUp size={18} color={fg} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Move card down" disabled={i === cards.length - 1} onPress={() => void actions.moveCard(card, 1).then(changed)} className={cn('rounded-full p-2', i === cards.length - 1 && 'opacity-30')}>
                    <ArrowDown size={18} color={fg} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Delete card" onPress={() => void actions.deleteCard(card).then(() => (setSelected(null), changed()))} className="rounded-full p-2">
                    <Trash2 size={18} color={fg} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => setSelected(null)} className="bg-primary rounded-full px-3 py-1.5">
                    <Text className="text-primary-foreground text-sm font-semibold">Done</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )
        })}
        {adding ? (
          <View className="bg-card border-border flex-row flex-wrap gap-2 rounded-2xl border p-3" accessibilityLabel="Card types">
            {NEW_CARDS.map((t) => (
              <Pressable key={t.type} accessibilityRole="button" onPress={() => void add(t.type)} className="bg-secondary rounded-full px-3 py-2">
                <Text className="text-secondary-foreground text-sm font-semibold">{t.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setAdding(true)} className="border-border flex-row items-center gap-2 self-start rounded-full border border-dashed px-4 py-2.5">
            <Plus size={18} color={primary} />
            <Text className="text-primary font-semibold">Add a card</Text>
          </Pressable>
        )}
        {/* What readers said about the published note (lvn-backend ADR-0047); notes made on the phone have none yet. */}
        {note.publishedAt && !note.localOnly ? <Discussion target={{ type: 'NOTE', id: note.id }} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Reader({ note, cards }: { note: Pick<LocalNote, 'title' | 'ownerName' | 'deletedAt' | 'id' | 'access'>; cards: { id: string; type: CardType; content: unknown }[] }) {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const spoken = useMemo(() => cards.map((c) => ({ id: c.id, text: cardPlainText(c.type, c.content) })), [cards])
  const reader = useReadAloud(spoken)
  return (
    <View className="bg-background flex-1">
      <Header>
        {note.deletedAt ? null : <MakeCopyButton noteId={note.id} />}
        <ReadAloudButton reader={reader} />
      </Header>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}>
        {note.deletedAt && note.access === 'OWNER' ? (
          <View className="bg-secondary flex-row items-center gap-3 rounded-2xl p-3">
            <Text className="flex-1 text-sm">This note is in the trash.</Text>
            <Pressable accessibilityRole="button" onPress={() => void actions.trashNote(note.id, false).then(() => syncSoon(client))} className="bg-primary rounded-full px-3 py-1.5">
              <Text className="text-primary-foreground text-sm font-semibold">Restore</Text>
            </Pressable>
          </View>
        ) : null}
        <Text className="text-3xl font-extrabold">{note.title || 'Untitled note'}</Text>
        {note.ownerName ? <Text className="text-muted-foreground text-sm">By {note.ownerName}</Text> : null}
        {note.deletedAt ? null : <NoteCredits noteId={note.id} />}
        {cards.map((c) => (
          <Pressable key={c.id} onLongPress={() => reader.play(c.id)} accessibilityHint="Long press to read aloud from here">
            <CardView type={c.type} content={c.content} highlighted={reader.current === c.id} onOpenFile={(fileId) => router.push(readerPath(note.id, fileId))} onAnchor={(a) => router.push(readerPath(note.id, a.fileId, { page: a.page, card: c.id }))} />
          </Pressable>
        ))}
        {note.deletedAt ? null : <Discussion target={{ type: 'NOTE', id: note.id }} />}
      </ScrollView>
    </View>
  )
}

/** A note that is not on the phone (a search result): read online. */
function RemoteNote({ id }: { id: string }) {
  const { data, loading, error } = useQuery(RemoteNoteDocument, { variables: { id }, fetchPolicy: 'network-only' })
  if (loading) return <Loading />
  const note = data?.note
  if (!note || error) {
    return (
      <View className="bg-background flex-1">
        <Header />
        <View className="flex-1 items-center justify-center gap-2 p-6">
          <Text className="text-lg font-semibold">{error ? 'You are offline' : 'Note not found'}</Text>
          <Text className="text-muted-foreground text-center text-sm">{error ? 'This note is not on your phone yet. Connect to the internet to read it.' : 'It may have been deleted or made private.'}</Text>
        </View>
      </View>
    )
  }
  return <Reader note={{ id: note.id, title: note.title, ownerName: note.owner.displayName, deletedAt: null, access: 'READER' }} cards={note.cards.edges.map((e) => ({ id: e.node.id, type: e.node.type, content: e.node.content as unknown }))} />
}
