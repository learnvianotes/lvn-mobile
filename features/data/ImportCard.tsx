import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import * as DocumentPicker from 'expo-document-picker'
import { router } from 'expo-router'
import { AlertTriangle } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { UploadError, uploadFile } from '@/features/notes/media/NoteMedia'
import { syncNow } from '@/features/notes/sync/engine'
import { Outcome, Pill } from '@/features/shell/Form'
import { ConfirmNoteImportDocument, ImportNotesDocument, NoteImportsDocument } from '@/graphql/generated/graphql'

/** What the importer reads (lvn-web's data page): an archive of LearnViaNotes or Markdown, or Markdown and text. */
const TYPES: Record<string, string> = { zip: 'application/zip', md: 'text/markdown', markdown: 'text/markdown', txt: 'text/plain' }

/**
 * Importing notes on the phone (lvn-backend ADR-0018): a ZIP, Markdown or text file from the phone's files is uploaded
 * and imported on the server, always private; the phone pulls the new notes when it is done.
 */
export function ImportCard() {
  const client = useApolloClient()
  const imports = useQuery(NoteImportsDocument, { fetchPolicy: 'cache-and-network' })
  const latest = imports.data?.noteImports[0]
  const running = latest?.status === 'PENDING' || latest?.status === 'RUNNING'
  useQuery(NoteImportsDocument, { skip: !running, pollInterval: 2_000, fetchPolicy: 'network-only' })
  const [startImport] = useMutation(ImportNotesDocument, { refetchQueries: [NoteImportsDocument] })
  const [confirm, confirming] = useMutation(ConfirmNoteImportDocument, { refetchQueries: [NoteImportsDocument] })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Once an import is done, its notes come to the phone.
  const doneId = latest?.status === 'DONE' ? latest.id : null
  useEffect(() => {
    if (doneId) void syncNow(client)
  }, [doneId, client])

  const choose = async () => {
    setError(null)
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'text/markdown', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false })
    const file = res.canceled ? null : res.assets[0]
    if (!file) return
    const mimeType = TYPES[file.name.split('.').pop()?.toLowerCase() ?? '']
    if (!mimeType) return setError('Choose a .zip, .md or .txt file.')
    setUploading(true)
    try {
      const fileId = await uploadFile(client, { uri: file.uri, name: file.name, mimeType, size: file.size ?? null }, { purpose: 'IMPORT' })
      const started = await startImport({ variables: { fileId } })
      const problem = started.data?.importNotes.userErrors[0]?.message
      if (problem) throw new UploadError(problem)
    } catch (e) {
      setError(e instanceof UploadError ? e.message : 'The import did not work. Try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-5" accessibilityLabel="Import notes">
      <Text className="text-lg font-semibold" accessibilityRole="header">
        Import notes
      </Text>
      <Text className="text-muted-foreground text-sm">Bring notes from a LearnViaNotes archive, Markdown files, or a ZIP of Markdown with pictures (Obsidian, Notion, Joplin). Everything arrives private.</Text>
      <View className="flex-row">
        <Pill label={uploading ? 'Uploading…' : 'Choose a file to import'} disabled={uploading || running} onPress={() => void choose()} />
      </View>
      {running ? (
        <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-sm">
          Importing {latest!.fileName}… {Math.round(latest!.progress)}%
        </Text>
      ) : null}
      {latest?.status === 'NEEDS_CONFIRMATION' ? (
        <View className="flex-row items-center gap-3 rounded-xl border border-warm bg-warm-soft p-3">
          <AlertTriangle size={18} color="#8a4b08" />
          <Text className="flex-1 text-sm text-warm">You imported {latest.fileName} before. Import it again?</Text>
          <Pill label="Import again" primary disabled={confirming.loading} onPress={() => void confirm({ variables: { id: latest.id } })} />
        </View>
      ) : null}
      {latest?.status === 'DONE' ? (
        <View className="gap-1">
          <Text className="text-sm font-semibold">
            {latest.created === 1 ? '1 note' : `${latest.created} notes`} imported from {latest.fileName}.
          </Text>
          {latest.skipped.length ? <Text className="text-muted-foreground text-xs">{latest.skipped.length === 1 ? '1 item was skipped' : `${latest.skipped.length} items were skipped`}</Text> : null}
          {latest.notes.slice(0, 5).map((n) => (
            <Pressable key={n.id} accessibilityRole="link" onPress={() => router.push(`/notes/${n.id}`)}>
              <Text className="text-primary text-sm">{n.title || 'Untitled note'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {latest?.status === 'FAILED' ? <Text className="text-destructive text-sm">{latest.error ?? 'The import did not work. Try again.'}</Text> : null}
      <Outcome message={error ? { ok: false, text: error } : null} />
    </View>
  )
}
