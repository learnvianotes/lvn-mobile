import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import * as DocumentPicker from 'expo-document-picker'
import { router } from 'expo-router'
import { ArrowLeft, X } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { mimeOf, UploadError, uploadFile } from '@/features/notes/media/NoteMedia'
import { useUploadsEnabled } from '@/features/notes/media/uploads'
import { LoadState } from '@/features/shell/LoadState'
import { ApplyToTeachDocument, MyTeacherApplicationDocument, ViewerDocument } from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_PROOF = 3
type Picked = { uri: string; name: string; mimeType: string; size: number | null }
const field = 'border-border bg-card text-foreground rounded-xl border px-3 py-2.5 text-base'

/**
 * Becoming a teacher on the phone (lvn-backend ADR-0073), "try now, verify later": where and what the person teaches,
 * a message and proof go to the platform admins; meanwhile they set up classes, which take students once verified.
 */
export function TeachScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#152033')
  const client = useApolloClient()
  const me = useQuery(ViewerDocument)
  const viewer = me.data?.viewer
  const app = useQuery(MyTeacherApplicationDocument, { fetchPolicy: 'cache-and-network' })
  const latest = app.data?.myTeacherApplication
  const status = viewer?.teacherStatus
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Teach on LearnViaNotes
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">Tell us where you teach. You can set up classes and write announcements and quizzes at once; students can join once a LearnViaNotes admin verifies you.</Text>
        {!me.data ? (
          <LoadState query={me} message="Your account could not load." />
        ) : status === 'VERIFIED' ? (
          <Card title="You’re a verified teacher" lead="Your classes can take students, and your teacher profile is public." />
        ) : !app.data ? (
          // Without the application, a waiting one would look like none: no form until it is known.
          <LoadState query={app} message="Your application could not load." />
        ) : status === 'PENDING' && latest ? (
          <Card title="Your application is being reviewed" lead="You can set up classes now; students can join once you are verified." />
        ) : viewer?.restrictedMinor ? (
          <Text className="text-muted-foreground">Teacher accounts are for adults.</Text>
        ) : viewer ? (
          <>
            {status === 'DECLINED' && latest ? (
              <View className="bg-muted gap-1 rounded-xl p-3">
                <Text className="font-semibold">Your last application wasn’t approved</Text>
                <Text className="text-muted-foreground text-sm">{latest.reason} You can apply again.</Text>
              </View>
            ) : null}
            <ApplyForm onSent={() => void client.refetchQueries({ include: [MyTeacherApplicationDocument, ViewerDocument] })} />
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

function Card({ title, lead }: { title: string; lead: string }) {
  return (
    <View accessibilityRole="summary" className="bg-secondary gap-2 rounded-2xl p-4">
      <Text className="text-lg font-bold">{title}</Text>
      <Text className="text-sm">{lead}</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push('/classes/new')}>
        <Text className="text-primary font-semibold">Set up a class →</Text>
      </Pressable>
    </View>
  )
}

function ApplyForm({ onSent }: { onSent: () => void }) {
  const uploadsOn = useUploadsEnabled()
  const client = useApolloClient()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const [institution, setInstitution] = useState('')
  const [subjects, setSubjects] = useState('')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apply] = useMutation(ApplyToTeachDocument)
  const choose = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: PROOF_TYPES, copyToCacheDirectory: true, multiple: true })
    if (res.canceled) return
    const picked = res.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: mimeOf(a.name, a.mimeType), size: a.size ?? null })).filter((f) => PROOF_TYPES.includes(f.mimeType))
    setFiles((list) => [...list, ...picked].slice(0, MAX_PROOF))
  }
  const send = async () => {
    setError(null)
    setBusy(true)
    try {
      const fileIds: string[] = []
      for (const f of files) fileIds.push(await uploadFile(client, f, { purpose: 'VERIFICATION_DOCUMENT' }))
      const res = await apply({ variables: { input: { institution, subjects: subjects.trim() || null, message: message.trim() || null, fileIds } } })
      const problem = res.data?.applyToTeach.userErrors[0]?.message
      if (problem) throw new UploadError(problem)
      haptic.success()
      onSent()
    } catch (e) {
      setError(e instanceof UploadError ? e.message : CombinedGraphQLErrors.is(e) ? (e.errors[0]?.message ?? 'That did not work. Try again.') : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }
  const ready = institution.trim().length >= 2 && !busy
  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-4">
      <TextInput accessibilityLabel="Where you teach" placeholder="Where you teach: college, school or organisation" placeholderTextColor={muted} maxLength={200} value={institution} onChangeText={setInstitution} className={field} />
      <TextInput accessibilityLabel="What you teach (optional)" placeholder="What you teach (optional)" placeholderTextColor={muted} maxLength={200} value={subjects} onChangeText={setSubjects} className={field} />
      <TextInput accessibilityLabel="Anything that helps us verify you (optional)" placeholder="Anything that helps us verify you (optional)" placeholderTextColor={muted} maxLength={500} multiline value={message} onChangeText={setMessage} className={cn(field, 'min-h-16')} style={{ textAlignVertical: 'top' }} />
      {/* Proof files are uploads and optional: only while uploads are on (lvn-backend ADR-0097). */}
      {uploadsOn ? <Text className="text-muted-foreground text-sm">Proof (optional): a staff ID, an appointment letter, or a page that lists you. Only our team sees it.</Text> : null}
      {files.map((f, i) => (
        <View key={`${f.name}-${i}`} className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm" numberOfLines={1}>
            {f.name}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} onPress={() => setFiles((list) => list.filter((_, j) => j !== i))} className="p-1">
            <X size={16} color={muted} />
          </Pressable>
        </View>
      ))}
      {uploadsOn && files.length < MAX_PROOF ? (
        <Pressable accessibilityRole="button" onPress={() => void choose()} className="border-border self-start rounded-xl border px-3 py-2">
          <Text className="font-semibold">Add a file</Text>
        </Pressable>
      ) : null}
      {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => void send()} className={cn('bg-primary self-start rounded-xl px-4 py-2.5', !ready && 'opacity-50')}>
        <Text className="text-primary-foreground font-semibold">Apply to teach</Text>
      </Pressable>
    </View>
  )
}
