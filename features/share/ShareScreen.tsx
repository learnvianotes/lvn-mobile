import { useApolloClient, useQuery } from '@apollo/client/react'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ArrowLeft, FileText, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Text } from '@/components/ui/text'
import { useGatedActions } from '@/features/auth/gates'
import { sizeLabel } from '@/features/notes/capture/tray'
import { useLocal } from '@/features/notes/hooks'
import * as db from '@/features/notes/store/db'
import { UploadsEnabledDocument } from '@/graphql/generated/graphql'
import { noteTitleForShare, verificationBlocksUpload } from './classify'
import { deleteShareFile } from './files'
import { pendingShares, type PendingItem, type PendingShare } from './pending'
import { saveShareAttempt } from './save'

function titleOf(share: PendingShare | null): string {
  if (!share) return ''
  const first = share.items.find((item) => item.kind !== 'unsupported')
  return noteTitleForShare(first?.name ?? null, share.text)
}

type RowState = 'waiting' | 'uploading' | 'done' | 'failed'

/**
 * Save to LVN: the files and words another app shared, a note to put them in, then the existing upload.
 * A type the server does not take yet is named, and the share stays so it can be tried again.
 */
export function ShareScreen() {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const wide = width >= 720
  const [fg, muted] = useCSSVariable(['--color-foreground', '--color-muted-foreground']) as (string | undefined)[]
  const [share, setShare] = useState<PendingShare | null>(() => pendingShares.read().share)
  const [receiving, setReceiving] = useState(pendingShares.isReceiving())
  const [boundTo, setBoundTo] = useState(share?.id ?? '')
  const [mode, setMode] = useState<'new' | 'existing'>(share?.noteId ? 'existing' : 'new')
  const [title, setTitle] = useState(() => titleOf(share))
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | null>(share?.noteId ?? null)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const notes = useLocal(() => db.listNotes(false), [])
  const uploads = useQuery(UploadsEnabledDocument, { fetchPolicy: 'cache-and-network' })
  const { actions } = useGatedActions()
  const verifyUpload = verificationBlocksUpload(actions)

  useEffect(() => pendingShares.subscribe(() => {
    setShare(pendingShares.read().share)
    setReceiving(pendingShares.isReceiving())
  }), [])
  if (share && boundTo !== share.id) {
    setBoundTo(share.id)
    setTitle(titleOf(share))
    setChosen(share.noteId ?? null)
    setMode(share.noteId ? 'existing' : 'new')
  }

  const editable = (notes ?? []).filter((note) => note.access !== 'READER')
  const needle = query.trim().toLowerCase()
  const matches = editable.filter((note) => !needle || (note.title || 'untitled').toLowerCase().includes(needle)).slice(0, 12)
  const uploadable = share?.items.filter((item) => item.kind !== 'unsupported' && !item.fileId) ?? []
  const canSave = !!share && !busy && (uploadable.length > 0 || (!!share.text && !share.textSaved))

  const remove = (item: PendingItem) => {
    if (busy || !share) return
    deleteShareFile(item.uri)
    pendingShares.update((current) => {
      const items = current.items.filter((entry) => entry.key !== item.key)
      if (!current.text && items.length === 0) return null
      return { ...current, items }
    })
  }

  const save = async () => {
    if (!share || busy) return
    if (verifyUpload && uploadable.length > 0) {
      setProblem('Verify your account to upload files.')
      return
    }
    if (uploads.data?.uploadsEnabled === false && uploadable.length > 0) {
      setProblem('Uploads are off for now. These files stay here until uploads are turned on.')
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      const { noteId, failed } = await saveShareAttempt(client, share, { mode, title: title.trim() || 'Shared note', chosen }, {
        onNote: (id) => pendingShares.update((current) => ({ ...current, noteId: id })),
        onTextSaved: (id) => pendingShares.update((current) => (current.noteId === id ? { ...current, textSaved: true } : current)),
        onUploading: (key) => setRows((prev) => ({ ...prev, [key]: 'uploading' })),
        onUploaded: (key, fileId) => {
          setRows((prev) => ({ ...prev, [key]: 'done' }))
          const uri = pendingShares.read().share?.items.find((entry) => entry.key === key)?.uri
          pendingShares.update((current) => ({ ...current, items: current.items.map((entry) => (entry.key === key ? { ...entry, fileId, message: null } : entry)) }))
          if (uri) deleteShareFile(uri)
        },
        onFailed: (key, message) => {
          setRows((prev) => ({ ...prev, [key]: 'failed' }))
          pendingShares.update((current) => ({ ...current, items: current.items.map((entry) => (entry.key === key ? { ...entry, message } : entry)) }))
        },
      })
      if (failed > 0) {
        setProblem(failed === 1 ? 'One file was not saved. You can try it again.' : `${failed} files were not saved. You can try them again.`)
        return
      }
      pendingShares.clear()
      router.replace(`/notes/${noteId}`)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The share could not be saved. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!share) {
    return (
      <View className="bg-background flex-1 items-center justify-center px-6" style={{ paddingTop: insets.top }}>
        <Text className="text-center text-lg font-semibold">{receiving ? 'Bringing the files in…' : 'Nothing to save'}</Text>
        {receiving ? <ActivityIndicator className="mt-4" /> : <Text className="text-muted-foreground mt-2 text-center text-sm">A share is kept for 24 hours. Share the files again if this one expired.</Text>}
        {receiving ? null : (
          <Button className="mt-6" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text>Back</Text>
          </Button>
        )}
      </View>
    )
  }

  const doneCount = share.items.filter((item) => item.fileId || rows[item.key] === 'done').length
  const savingCount = share.items.filter((item) => item.kind !== 'unsupported').length

  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28, paddingHorizontal: wide ? 24 : 16, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 640, gap: 16 }}>
          <View className="flex-row items-center gap-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} className="size-10 items-center justify-center rounded-full">
              <ArrowLeft size={22} color={fg} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-extrabold" accessibilityRole="header">Save to LVN</Text>
              <Text className="text-muted-foreground text-xs">{share.items.length === 0 ? 'Shared text' : `${share.items.length} ${share.items.length === 1 ? 'file' : 'files'}`}</Text>
            </View>
          </View>

          {share.text ? (
            <View className="bg-card border-border rounded-2xl border p-4">
              <Text className="text-muted-foreground text-xs font-semibold">Add to the note</Text>
              <Text className="mt-1 text-sm">{share.text}</Text>
            </View>
          ) : null}

          {share.items.map((item) => {
            const state = item.fileId ? 'done' : rows[item.key] ?? 'waiting'
            const image = item.kind === 'image' || item.kind === 'heic'
            return (
              <View key={item.key} className="bg-card border-border flex-row items-center gap-3 rounded-2xl border p-3">
                {image && item.uri ? (
                  <Image source={{ uri: item.uri }} accessibilityLabel={item.name} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" />
                ) : (
                  <View className="bg-muted size-14 items-center justify-center rounded-xl">
                    <FileText size={22} color={muted} />
                  </View>
                )}
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="font-semibold" numberOfLines={2}>{item.name}</Text>
                  <Text className="text-muted-foreground text-xs">{item.size == null ? item.mimeType : sizeLabel(item.size)}</Text>
                  {item.message ? <Text className="text-destructive text-xs">{item.message}</Text> : null}
                  {state === 'uploading' ? <Progress value={45} accessibilityLabel={`Uploading ${item.name}`} /> : null}
                  {state === 'done' ? <Progress value={100} accessibilityLabel={`${item.name} uploaded`} /> : null}
                  {state === 'failed' ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Try ${item.name} again`} onPress={() => void save()} disabled={busy}>
                      <Text className="text-primary text-sm font-semibold">Try again</Text>
                    </Pressable>
                  ) : null}
                </View>
                {state === 'uploading' ? <ActivityIndicator /> : (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => remove(item)} disabled={busy} className="size-10 items-center justify-center">
                    <X size={18} color={fg} />
                  </Pressable>
                )}
              </View>
            )
          })}

          {verifyUpload && uploadable.length > 0 ? (
            <View className="bg-card border-border gap-3 rounded-2xl border p-4">
              <Text className="text-sm">Verify your account to upload files. This share stays here until then.</Text>
              <Button variant="outline" onPress={() => router.push('/verify')}>
                <Text>Verify your account</Text>
              </Button>
            </View>
          ) : null}

          <View className="gap-3">
            <Text className="text-lg font-bold">Save into</Text>
            <View className={wide ? 'flex-row gap-3' : 'gap-3'}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'new' }} onPress={() => setMode('new')} className={`border-border flex-1 rounded-2xl border p-3 ${mode === 'new' ? 'bg-primary' : 'bg-card'}`}>
                <Text className={mode === 'new' ? 'text-primary-foreground font-semibold' : 'font-semibold'}>New note</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'existing' }} onPress={() => setMode('existing')} className={`border-border flex-1 rounded-2xl border p-3 ${mode === 'existing' ? 'bg-primary' : 'bg-card'}`}>
                <Text className={mode === 'existing' ? 'text-primary-foreground font-semibold' : 'font-semibold'}>Existing note</Text>
              </Pressable>
            </View>
            {mode === 'new' ? (
              <Input accessibilityLabel="Note title" value={title} onChangeText={setTitle} placeholder="Note title" />
            ) : (
              <View className="gap-2">
                <Input accessibilityLabel="Search notes" value={query} onChangeText={setQuery} placeholder="Search your notes" />
                {matches.length === 0 ? <Text className="text-muted-foreground text-sm">No notes match.</Text> : matches.map((note) => {
                  const on = chosen === note.id
                  return (
                    <Pressable key={note.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setChosen(note.id)} className={`border-border rounded-2xl border px-3 py-3 ${on ? 'bg-secondary' : 'bg-card'}`}>
                      <Text className="font-semibold" numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>

          {busy && savingCount > 0 ? <Text className="text-muted-foreground text-sm">Uploading {Math.min(doneCount + 1, savingCount)} of {savingCount}</Text> : null}
          {problem ? <Text className="text-destructive text-sm">{problem}</Text> : null}

          <Button size="lg" disabled={!canSave || (mode === 'existing' && !chosen)} onPress={() => void save()}>
            <Text>{busy ? 'Saving…' : 'Save'}</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}
