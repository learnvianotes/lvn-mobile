import { useApolloClient } from '@apollo/client/react'
import { router } from 'expo-router'
import { AlertTriangle, ArrowLeft, CloudOff, NotebookPen, Plus, RotateCcw, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { PressScale } from '@/features/shell/PressScale'
import { useLocal, useSyncStatus } from './hooks'
import type { LocalNote } from './model/types'
import { KIND_LABEL } from './publishing/NoteActions'
import * as actions from './store/actions'
import * as db from './store/db'
import { syncNow } from './sync/engine'

const ACCENTS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6']
const accentOf = (id: string) => ACCENTS[parseInt(id.replace(/-/g, '').slice(-4), 16) % ACCENTS.length]!

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

type Filter = { by: 'all' } | { by: 'shared' } | { by: 'kind'; kind: LocalNote['kind'] } | { by: 'folder'; id: string } | { by: 'tag'; name: string }
const KIND_PLURAL: Record<LocalNote['kind'], string> = { NOTE: 'Notes', PROJECT: 'Projects', BLOG: 'Blog', POST: 'Posts' }
const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b)

/** The kinds, folders and tags this phone's notes have, as chips; a filter is offered only when it would show something. */
function filtersOf(notes: LocalNote[]): { filter: Filter; label: string }[] {
  const out: { filter: Filter; label: string }[] = [{ filter: { by: 'all' }, label: 'All' }]
  if (notes.some((n) => n.access !== 'OWNER')) out.push({ filter: { by: 'shared' }, label: 'Shared with me' })
  for (const kind of ['PROJECT', 'BLOG', 'POST'] as const) if (notes.some((n) => n.kind === kind)) out.push({ filter: { by: 'kind', kind }, label: KIND_PLURAL[kind] })
  const folders = new Map(notes.filter((n) => n.folderId).map((n) => [n.folderId!, n.folderName ?? 'Folder']))
  for (const [id, name] of [...folders].sort((a, b) => a[1].localeCompare(b[1]))) out.push({ filter: { by: 'folder', id }, label: name })
  for (const name of [...new Set(notes.flatMap((n) => n.tags))].sort()) out.push({ filter: { by: 'tag', name }, label: `#${name}` })
  return out
}

function matches(n: LocalNote, f: Filter): boolean {
  switch (f.by) {
    case 'all':
      return true
    case 'shared':
      return n.access !== 'OWNER'
    case 'kind':
      return n.kind === f.kind
    case 'folder':
      return n.folderId === f.id
    case 'tag':
      return n.tags.includes(f.name)
  }
}

/**
 * My notes on the phone (§13.2): readable and writable offline, sent when the connection allows; filtered by what
 * they are, their folder or a tag (lvn-backend ADR-0052), all from the phone's copy.
 */
export function NotesListScreen() {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const [trash, setTrash] = useState(false)
  const [filter, setFilter] = useState<Filter>({ by: 'all' })
  const all = useLocal(() => db.listNotes(trash), [trash])
  const chips = trash || !all ? [] : filtersOf(all)
  // A filter whose last note went away falls back to everything.
  const active = chips.some((c) => same(c.filter, filter)) ? filter : { by: 'all' as const }
  const notes = all?.filter((n) => trash || matches(n, active))
  const excerpts = useLocal(() => db.excerpts(), [])
  const unsent = useLocal(() => db.unsentNoteIds(), [])
  const attention = useLocal(() => db.outbox('ATTENTION'), [])
  const status = useSyncStatus()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const primaryFg = String(useCSSVariable('--color-primary-foreground') ?? '#ffffff')

  const create = async () => {
    const id = await actions.createNote({ id: '', name: '' })
    router.push(`/notes/${id}`)
  }

  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-2xl font-extrabold" accessibilityRole="header">
            {trash ? 'Trash' : 'My notes'}
          </Text>
          <Text className="text-muted-foreground text-xs">{status.state === 'offline' ? 'Offline — your changes are saved on this phone' : status.state === 'syncing' ? 'Syncing…' : status.lastSyncedAt ? `Synced ${ago(status.lastSyncedAt)}` : ' '}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={trash ? 'Show my notes' : 'Show the trash'} onPress={() => setTrash((t) => !t)} className="rounded-full p-2">
          {trash ? <NotebookPen size={20} color={fg} /> : <Trash2 size={20} color={fg} />}
        </Pressable>
      </View>
      {attention?.length ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/notes/attention')} className="mx-4 mb-2 flex-row items-center gap-2 rounded-2xl bg-amber-500/15 p-3">
          <AlertTriangle size={18} color="#b45309" />
          <Text className="flex-1 text-sm font-medium">{attention.length === 1 ? 'One change could not be saved' : `${attention.length} changes could not be saved`} — tap to see</Text>
        </Pressable>
      ) : null}
      {chips.length > 1 ? (
        <View>
          <FlatList
            horizontal
            data={chips}
            keyExtractor={(c) => c.label}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}
            accessibilityRole="tablist"
            renderItem={({ item: c }) => {
              const on = same(c.filter, active)
              return (
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setFilter(c.filter)} className={`rounded-full px-3.5 py-1.5 ${on ? 'bg-primary' : 'bg-card border-border border'}`}>
                  <Text className={`text-sm font-semibold ${on ? 'text-primary-foreground' : ''}`}>{c.label}</Text>
                </Pressable>
              )
            }}
          />
        </View>
      ) : null}
      <FlatList
        data={notes ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110, gap: 12 }}
        refreshControl={<RefreshControl refreshing={status.state === 'syncing'} onRefresh={() => void syncNow(client)} />}
        ListEmptyComponent={
          notes ? (
            <View className="items-center gap-2 py-16">
              <NotebookPen size={40} color={muted} />
              <Text className="text-lg font-semibold">{trash ? 'The trash is empty' : 'No notes yet'}</Text>
              <Text className="text-muted-foreground text-center text-sm">{trash ? 'Notes you delete stay here for 30 days.' : 'Write your first note — it works offline too.'}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <PressScale accessibilityRole="button" accessibilityLabel={item.title || 'Untitled note'} onPress={() => router.push(`/notes/${item.id}`)}>
            <View className="bg-card border-border flex-row gap-3 overflow-hidden rounded-3xl border p-4">
              <View className="size-11 items-center justify-center rounded-2xl" style={{ backgroundColor: accentOf(item.id) }}>
                <Text className="text-lg font-extrabold text-white">{(item.title || 'U').trim().charAt(0).toUpperCase()}</Text>
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-semibold" numberOfLines={2}>
                  {item.title || 'Untitled note'}
                </Text>
                <Text className="text-muted-foreground text-sm leading-5" numberOfLines={2}>
                  {excerpts?.get(item.id) ?? 'Nothing written yet'}
                </Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  {item.kind !== 'NOTE' ? <Text className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">{KIND_LABEL[item.kind]}</Text> : null}
                  <Text className="text-muted-foreground text-xs">{ago(item.updatedAt)}</Text>
                  {item.access !== 'OWNER' ? <Text className="text-primary text-xs font-semibold">{item.access === 'EDITOR' ? `Shared by ${item.ownerName} · can edit` : `Shared by ${item.ownerName}`}</Text> : null}
                  {unsent?.has(item.id) ? (
                    <View className="bg-secondary flex-row items-center gap-1 rounded-full px-2 py-0.5">
                      <CloudOff size={11} color={muted} />
                      <Text className="text-muted-foreground text-[11px] font-medium">Not sent yet</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {trash ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Restore" onPress={() => void actions.trashNote(item.id, false).then(() => syncNow(client))} className="self-center rounded-full p-2">
                  <RotateCcw size={20} color={fg} />
                </Pressable>
              ) : null}
            </View>
          </PressScale>
        )}
      />
      {!trash ? (
        <View className="absolute right-5" style={{ bottom: insets.bottom + 24 }}>
          <PressScale accessibilityRole="button" accessibilityLabel="New note" onPress={() => void create()}>
            <View className={cn('bg-primary flex-row items-center gap-2 rounded-full px-5 py-4 shadow-lg')}>
              <Plus size={20} color={primaryFg} />
              <Text className="text-primary-foreground font-bold">New note</Text>
            </View>
          </PressScale>
        </View>
      ) : null}
    </View>
  )
}
