import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import * as DocumentPicker from 'expo-document-picker'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { FileText, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { mimeOf, UploadError, uploadFile } from '@/features/notes/media/NoteMedia'
import { Field, Outcome, Pill } from '@/features/shell/Form'
import {
  FindTeachersDocument,
  MyVerificationRequestsDocument,
  RequestDocumentVerificationDocument,
  RequestTeacherVerificationDocument,
  ReviewVerificationRequestDocument,
  VerificationDocumentUrlDocument,
  VerificationRequestsToReviewDocument,
  WithdrawVerificationRequestDocument,
  type VerificationRequestsToReviewQuery,
} from '@/graphql/generated/graphql'

const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_DOCUMENTS = 3
type Picked = { uri: string; name: string; mimeType: string; size: number | null }
const card = 'bg-card border-border gap-3 rounded-2xl border p-5'

/**
 * Verifying without a college email on the phone (lvn-backend ADR-0019): ask a verified teacher to vouch, or send up to
 * three pictures or PDFs that platform admins check (not for restricted minors). One request waits at a time.
 */
export function VerifyCard({ restrictedMinor }: { restrictedMinor: boolean }) {
  const mine = useQuery(MyVerificationRequestsDocument, { fetchPolicy: 'cache-and-network' })
  const [withdraw] = useMutation(WithdrawVerificationRequestDocument)
  const [mode, setMode] = useState<'teacher' | 'documents' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Account verification only: applications to teach have their own screen (lvn-backend ADR-0073).
  const requests = (mine.data?.myVerificationRequests ?? []).filter((r) => r.purpose === 'ACCOUNT')
  const pending = requests.find((r) => r.status === 'PENDING')
  const last = requests[0]
  const done = async () => {
    setMode(null)
    await mine.refetch()
  }
  return (
    <View className={card} accessibilityLabel="Get verified">
      <Text className="text-base font-semibold" accessibilityRole="header">
        Get verified
      </Text>
      {pending ? (
        <>
          <Text className="text-sm">{pending.method === 'TEACHER' ? `Waiting for ${pending.teacher?.displayName ?? 'your teacher'} to vouch for you.` : 'Our team is checking your documents.'}</Text>
          <View className="flex-row">
            <Pill
              label="Withdraw the request"
              onPress={() =>
                void attempt(() => withdraw({ variables: { requestId: pending.id } })).then(async (p) => {
                  setError(p)
                  await mine.refetch()
                })
              }
            />
          </View>
        </>
      ) : (
        <>
          {last?.status === 'REJECTED' ? <Text className="rounded-xl bg-red-50 p-3 text-sm text-red-950">Your last request was not accepted: {last.reason}</Text> : null}
          <Text className="text-muted-foreground text-sm">No college email? Ask a teacher who knows you to vouch for you, or send proof that you study (an ID card or a fee receipt) for our team to check.</Text>
          <View className="flex-row flex-wrap gap-2">
            <Pill label="Ask a teacher" primary={mode === 'teacher'} onPress={() => setMode(mode === 'teacher' ? null : 'teacher')} />
            {!restrictedMinor ? <Pill label="Send proof of study" primary={mode === 'documents'} onPress={() => setMode(mode === 'documents' ? null : 'documents')} /> : null}
          </View>
          {mode === 'teacher' ? <AskTeacher onSent={() => void done()} /> : null}
          {mode === 'documents' ? <SendDocuments onSent={() => void done()} /> : null}
        </>
      )}
      <Outcome message={error ? { ok: false, text: error } : null} />
    </View>
  )
}

function AskTeacher({ onSent }: { onSent: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [query, setQuery] = useState('')
  const [settled, setSettled] = useState('')
  const [teacher, setTeacher] = useState<{ id: string; displayName: string; handle: string } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [request, requesting] = useMutation(RequestTeacherVerificationDocument)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  const found = useQuery(FindTeachersDocument, { variables: { query: settled }, skip: settled.length < 2 })
  const teachers = (found.data?.search.people ?? []).filter((p) => p.globalRole === 'TEACHER')
  const send = async () => {
    if (!teacher) return
    const p = await attempt(() => request({ variables: { input: { teacherId: teacher.id, message: message.trim() || null } } }))
    setError(p)
    if (!p) onSent()
  }
  return (
    <View className="border-border gap-2 rounded-xl border p-3">
      {teacher ? (
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm">
            {teacher.displayName} <Text className="text-muted-foreground">@{teacher.handle}</Text>
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose another teacher" onPress={() => setTeacher(null)} className="p-1">
            <X size={16} color={muted} />
          </Pressable>
        </View>
      ) : (
        <>
          <Field label="Find your teacher" placeholder="Their name or handle" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
          {settled.length >= 2 && found.data ? (
            teachers.length ? (
              teachers.map((p) => (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.displayName} @${p.handle}`} onPress={() => setTeacher(p)} className="rounded-lg px-2 py-2">
                  <Text>
                    {p.displayName} <Text className="text-muted-foreground">@{p.handle}</Text>
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text className="text-muted-foreground text-sm">No verified teacher matches. They need a verified LearnViaNotes account.</Text>
            )
          ) : null}
        </>
      )}
      <Field label="A note (optional)" placeholder="For example: I am in your Data Structures class, section B." value={message} onChangeText={setMessage} maxLength={500} multiline />
      <Outcome message={error ? { ok: false, text: error } : null} />
      <View className="flex-row">
        <Pill label="Send request" primary disabled={!teacher || requesting.loading} onPress={() => void send()} />
      </View>
    </View>
  )
}

function SendDocuments({ onSent }: { onSent: () => void }) {
  const client = useApolloClient()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [files, setFiles] = useState<Picked[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [request] = useMutation(RequestDocumentVerificationDocument)
  const choose = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_TYPES, copyToCacheDirectory: true, multiple: true })
    if (res.canceled) return
    const picked = res.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: mimeOf(a.name, a.mimeType), size: a.size ?? null })).filter((f) => DOCUMENT_TYPES.includes(f.mimeType))
    setFiles((list) => [...list, ...picked].slice(0, MAX_DOCUMENTS))
  }
  const send = async () => {
    setError(null)
    setBusy(true)
    try {
      const fileIds: string[] = []
      for (const f of files) fileIds.push(await uploadFile(client, f, { purpose: 'VERIFICATION_DOCUMENT' }))
      const res = await request({ variables: { input: { fileIds, message: message.trim() || null } } })
      const problem = res.data?.requestDocumentVerification.userErrors[0]?.message
      if (problem) throw new UploadError(problem)
      onSent()
    } catch (e) {
      setError(e instanceof UploadError ? e.message : CombinedGraphQLErrors.is(e) ? (e.errors[0]?.message ?? 'That did not work. Try again.') : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <View className="border-border gap-2 rounded-xl border p-3">
      <Text className="text-muted-foreground text-sm">Up to three pictures or PDFs. Only our team sees them, and they are deleted 30 days after we decide.</Text>
      <View className="flex-row">
        <Pill label="Choose files" disabled={files.length >= MAX_DOCUMENTS} onPress={() => void choose()} />
      </View>
      {files.map((f, i) => (
        <View key={`${f.uri}-${i}`} className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm" numberOfLines={1}>
            {f.name}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} onPress={() => setFiles((list) => list.filter((_, j) => j !== i))} className="p-1">
            <X size={16} color={muted} />
          </Pressable>
        </View>
      ))}
      <Field label="A note (optional)" value={message} onChangeText={setMessage} maxLength={500} multiline />
      <Outcome message={error ? { ok: false, text: error } : null} />
      <View className="flex-row">
        <Pill label={busy ? 'Sending…' : 'Send request'} primary disabled={!files.length || busy} onPress={() => void send()} />
      </View>
    </View>
  )
}

type Request = VerificationRequestsToReviewQuery['verificationRequestsToReview'][number]

/**
 * Requests to verify accounts on the phone (ADR-0019): a verified teacher answers the students who asked them;
 * platform admins check proof of study through short-lived, recorded links. Nothing for a teacher with none waiting.
 */
export function ReviewRequests({ admin }: { admin?: boolean }) {
  const { data, error, refetch } = useQuery(VerificationRequestsToReviewDocument, { fetchPolicy: 'cache-and-network' })
  const requests = data?.verificationRequestsToReview ?? []
  if (CombinedGraphQLErrors.is(error) && error.errors.some((e) => e.extensions?.code === 'FORBIDDEN')) return admin ? <Text className="text-muted-foreground py-16 text-center">This is for platform admins.</Text> : null
  if (!admin && !requests.length) return null
  return (
    <View className="gap-3">
      <Text className={admin ? 'text-muted-foreground text-sm' : 'text-base font-semibold'} accessibilityRole={admin ? undefined : 'header'}>
        {admin ? 'Oldest first. Every document you open is recorded.' : 'Students asking you to verify them'}
      </Text>
      {!admin ? <Text className="text-muted-foreground text-sm">Vouch only for students you know. Approving lets them share, comment and join groups.</Text> : null}
      {data && !requests.length ? <Text className="text-muted-foreground py-8 text-center">Nothing to review.</Text> : null}
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} onDone={() => void refetch()} />
      ))}
    </View>
  )
}

function RequestCard({ request: r, onDone }: { request: Request; onDone: () => void }) {
  const client = useApolloClient()
  const accent = String(useCSSVariable('--color-primary') ?? '#2563eb')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [review, reviewing] = useMutation(ReviewVerificationRequestDocument)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const decide = async (approve: boolean) => {
    if (!approve && !reason.trim()) return setError('Tell the student why, so they can try again.')
    const p = await attempt(() => review({ variables: { input: { requestId: r.id, approve, reason: reason.trim() || null } } }))
    setError(p)
    if (!p) onDone()
  }
  const open = async (fileId: string) => {
    const res = await client.query({ query: VerificationDocumentUrlDocument, variables: { requestId: r.id, fileId }, fetchPolicy: 'network-only' }).catch(() => null)
    const url = res?.data?.verificationDocumentUrl.url
    if (url) await WebBrowser.openBrowserAsync(url)
    else setError('That did not work. Try again.')
  }
  return (
    <View accessibilityLabel={`Request from ${r.requester.displayName}`} className="bg-card border-border gap-2 rounded-2xl border p-4">
      <Pressable accessibilityRole="link" onPress={() => router.push(`/u/${r.requester.handle}`)}>
        <Text className="font-semibold">
          {r.requester.displayName} <Text className="text-muted-foreground text-sm font-normal">@{r.requester.handle}</Text>
        </Text>
      </Pressable>
      {r.purpose === 'TEACHER_ROLE' ? (
        <Text className="text-sm">
          <Text className="text-primary font-semibold">Applies to teach · </Text>
          Teaches at {r.institution}
          {r.subjects ? ` · ${r.subjects}` : ''}
        </Text>
      ) : null}
      {r.message ? <Text className="bg-secondary rounded-xl px-3 py-2 text-sm">{r.message}</Text> : null}
      {r.documents.map((d) => (
        <Pressable key={d.fileId} accessibilityRole="button" accessibilityLabel={`Open ${d.fileName}`} onPress={() => void open(d.fileId)} className="flex-row items-center gap-2 py-1">
          <FileText size={16} color={accent} />
          <Text className="text-primary text-sm font-semibold">{d.fileName}</Text>
        </Pressable>
      ))}
      <TextInput accessibilityLabel="Reason (needed to decline; the student reads it)" placeholder="Reason (needed to decline)" placeholderTextColor={muted} value={reason} onChangeText={setReason} className="border-border text-foreground rounded-xl border px-3 py-2" />
      <View className="flex-row gap-2">
        <Pill label="Verify" primary disabled={reviewing.loading} onPress={() => void decide(true)} />
        <Pill label="Decline" disabled={reviewing.loading} onPress={() => void decide(false)} />
      </View>
      <Outcome message={error ? { ok: false, text: error } : null} />
    </View>
  )
}
