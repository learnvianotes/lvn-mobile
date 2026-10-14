import { useApolloClient, useMutation } from '@apollo/client/react'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ArrowLeft, Camera, FileText, FolderOpen, Images, X } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Progress } from '@/components/ui/progress'
import { Text } from '@/components/ui/text'
import { RunAiTaskDocument } from '@/graphql/generated/graphql'
import { QuickNoteLimits } from '@/lib/contracts/domain/enums'
import { UploadError, uploadToNote } from '../media/NoteMedia'
import { appendCard, createNote, deleteCard, setTitle } from '../store/actions'
import * as db from '../store/db'
import { syncNow } from '../sync/engine'
import { pickForTray, type Source } from './prepare'
import { addToTray, sizeLabel, type TrayItem } from './tray'

type Busy = { adding: true } | { upload: number; of: number } | { making: true } | null

const SOURCES: { source: Source; label: string; icon: typeof Camera }[] = [
  { source: 'camera', label: 'Camera', icon: Camera },
  { source: 'library', label: 'Photos', icon: Images },
  { source: 'files', label: 'Files', icon: FolderOpen },
]

/**
 * Notes from photos and PDFs (lvn-backend ADR-0084): a tray filled from the camera (again and again), the photo library
 * (several at once) and the files, up to QuickNoteLimits.files. Pictures are made smaller as they are added; a PDF over
 * the limit is turned away with its size. Make notes puts them all in a new note, uploads each with progress and has AI
 * make one note of them. A failed upload keeps the tray: trying again carries on where it stopped.
 */
export function CaptureScreen({ start }: { start?: Source }) {
  const insets = useSafeAreaInsets()
  const client = useApolloClient()
  const [runTask] = useMutation(RunAiTaskDocument)
  const [fg, muted] = useCSSVariable(['--color-foreground', '--color-muted-foreground']) as (string | undefined)[]
  const [items, setItems] = useState<TrayItem[]>([])
  const [busy, setBusy] = useState<Busy>(null)
  const [problem, setProblem] = useState<string | null>(null)
  /** The note made by the first Make notes, and the items already in it as cards: a retry goes on from there. */
  const made = useRef<{ noteId: string; carded: Set<string> } | null>(null)
  const full = items.length >= QuickNoteLimits.files
  const total = items.reduce((sum, i) => sum + i.size, 0)

  const add = useCallback(async (source: Source) => {
    setProblem(null)
    setBusy({ adding: true })
    try {
      const picked = await pickForTray(source, QuickNoteLimits.files - items.length)
      if (picked === 'denied') return Alert.alert('No camera', 'Allow LearnViaNotes to use the camera in the phone’s settings to take photos for notes.')
      const { tray, refused } = addToTray(items, picked)
      setItems(tray)
      if (refused.length) setProblem(refused.join(' '))
    } catch {
      setProblem('That could not be added. Try another photo or file.')
    } finally {
      setBusy(null)
    }
  }, [items])

  // Camera on Home and in the create sheet opens the camera at once; the tray waits for more after it.
  const started = useRef(false)
  useEffect(() => {
    if (start && !started.current) {
      started.current = true
      void add(start)
    }
  }, [start, add])

  const leave = useCallback(() => {
    const go = () => (router.canGoBack() ? router.back() : router.replace('/'))
    if (!items.length || made.current) return go()
    Alert.alert('Leave the tray?', 'The photos and files in it are not kept.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: go }])
  }, [items.length])
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave()
      return true
    })
    return () => sub.remove()
  }, [leave])

  const make = async () => {
    setProblem(null)
    try {
      if (!made.current) {
        const id = await createNote({ id: '', name: '' })
        await setTitle(id, `Quick note, ${new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`)
        // The note is its photos and PDFs: no empty text card above them.
        for (const card of await db.getCards(id)) await deleteCard(card)
        setBusy({ upload: 0, of: items.length })
        await syncNow(client)
        made.current = { noteId: id, carded: new Set() }
      }
      const { noteId } = made.current
      if ((await db.getNote(noteId))?.localOnly) throw new UploadError('Connect to the internet to make notes from photos.')
      const list = [...items]
      for (const [i, item] of list.entries()) {
        if (item.fileId) continue
        setBusy({ upload: i + 1, of: list.length })
        list[i] = { ...item, fileId: await uploadToNote(client, noteId, item) }
        setItems([...list])
      }
      for (const item of list) {
        if (made.current.carded.has(item.key)) continue
        await appendCard(noteId, item.kind === 'pdf' ? 'file' : 'image', item.kind === 'pdf' ? { fileId: item.fileId } : { fileId: item.fileId, alt: '' })
        made.current.carded.add(item.key)
      }
      setBusy({ making: true })
      await syncNow(client)
      const res = await runTask({ variables: { input: { noteId, task: 'QUICK_NOTE' } } })
      const refused = res.data?.runAiTask.userErrors[0]?.message
      if (refused) {
        router.replace(`/notes/${noteId}`)
        return Alert.alert('Not made', `${refused} The photos and files are in the note.`)
      }
      router.replace(`/notes/ai/${noteId}`)
    } catch (e) {
      setProblem(e instanceof UploadError ? e.message : 'Not everything was uploaded. Check the connection and try again: it carries on where it stopped.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={leave} className="rounded-full p-2">
          <ArrowLeft size={22} color={String(fg ?? '#111827')} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold" accessibilityRole="header">
          Notes from photos
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}>
        <Text className="text-muted-foreground text-sm">{`Add up to ${QuickNoteLimits.files} photos or PDFs (pages of notes, slides, a whiteboard), then AI makes one note from them all. Photos are made smaller so they upload quickly; a PDF can be up to ${QuickNoteLimits.pdfBytes / 1024 ** 2} MB.`}</Text>
        <View className="flex-row gap-2">
          {SOURCES.map(({ source, label, icon: Icon }) => (
            <Pressable
              key={source}
              accessibilityRole="button"
              accessibilityLabel={source === 'camera' ? 'Take a photo' : source === 'library' ? 'Add from photos' : 'Add from files'}
              accessibilityState={{ disabled: full || !!busy }}
              disabled={full || !!busy}
              onPress={() => void add(source)}
              className={`border-border bg-card flex-1 items-center gap-1 rounded-2xl border py-3 ${full || busy ? 'opacity-50' : ''}`}
            >
              <Icon size={22} color={String(fg ?? '#111827')} />
              <Text className="text-sm font-semibold">{label}</Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold">{`${items.length} of ${QuickNoteLimits.files}`}</Text>
          {items.length ? <Text className="text-muted-foreground text-sm">{sizeLabel(total)}</Text> : null}
        </View>
        {busy && 'adding' in busy ? <ActivityIndicator accessibilityLabel="Adding" /> : null}
        {!items.length && !busy ? <Text className="text-muted-foreground text-sm">Nothing added yet.</Text> : null}
        <View className="flex-row flex-wrap gap-3">
          {items.map((item, i) => (
            <View key={item.key} className="w-[30%] gap-1" accessibilityLabel={`${i + 1}. ${item.name}, ${sizeLabel(item.size)}`}>
              <View className="border-border bg-card aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border">
                {item.kind === 'image' ? <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <FileText size={28} color={String(muted ?? '#6b7280')} />}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                  disabled={!!busy}
                  onPress={() => setItems((all) => all.filter((x) => x.key !== item.key))}
                  className="bg-background/90 absolute right-1 top-1 rounded-full p-1"
                >
                  <X size={14} color={String(fg ?? '#111827')} />
                </Pressable>
              </View>
              <Text className="text-xs" numberOfLines={1}>
                {item.kind === 'pdf' ? item.name : `Photo ${items.slice(0, i + 1).filter((x) => x.kind === 'image').length}`}
              </Text>
              <Text className="text-muted-foreground text-xs">{item.fileId ? 'Uploaded' : sizeLabel(item.size)}</Text>
            </View>
          ))}
        </View>
        {problem ? (
          <Text accessibilityRole="alert" className="text-destructive text-sm">
            {problem}
          </Text>
        ) : null}
        {busy && 'upload' in busy ? (
          <View className="gap-2">
            <Text className="text-sm">{busy.upload ? `Uploading ${busy.upload} of ${busy.of}…` : 'Making the note…'}</Text>
            <Progress value={busy.of ? (Math.max(0, busy.upload - 1) / busy.of) * 100 : 0} />
          </View>
        ) : null}
        {busy && 'making' in busy ? <Text className="text-sm">Asking AI to make notes…</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !items.length || !!busy }}
          disabled={!items.length || !!busy}
          onPress={() => void make()}
          className={`bg-primary items-center rounded-2xl py-3.5 ${!items.length || busy ? 'opacity-50' : ''}`}
        >
          <Text className="text-primary-foreground font-semibold">{items.length ? `Make notes from ${items.length}` : 'Make notes'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
