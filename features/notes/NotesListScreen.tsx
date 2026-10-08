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

/** My notes on the phone (§13.2): readable and writable offline, sent when the connection allows. */
export function NotesListScreen() {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const [trash, setTrash] = useState(false)
  const notes = useLocal(() => db.listNotes(trash), [trash])
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
