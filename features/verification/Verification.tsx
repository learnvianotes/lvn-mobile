import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import * as DocumentPicker from 'expo-document-picker'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { FileText, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { mimeOf, putStoredFile, UploadError, uploadFile } from '@/features/notes/media/NoteMedia'
import { useUploadsEnabled } from '@/features/notes/media/uploads'
import { Field, Outcome, Pill } from '@/features/shell/Form'
import { reportClientError } from '@/lib/client-errors'
import {
  CreateStudentIdUploadIntentDocument,
  FindTeachersDocument,
  MyStudentIdVerificationDocument,
  MyVerificationRequestsDocument,
  RequestDocumentVerificationDocument,
  RequestTeacherVerificationDocument,
  ReviewStudentIdVerificationDocument,
  ReviewVerificationRequestDocument,
  StudentIdCardUrlDocument,
  StudentIdVerificationEnabledDocument,
  StudentIdVerificationQueueDocument,
  SubmitStudentIdVerificationDocument,
  VerificationDocumentUrlDocument,
  VerificationRequestsToReviewDocument,
  ViewerDocument,
  WithdrawStudentIdVerificationDocument,
  WithdrawVerificationRequestDocument,
  type IdCardVerdict,
  type StudentIdVerificationQueueQuery,
  type VerificationRequestsToReviewQuery,
} from '@/graphql/generated/graphql'
import { openInBrowser } from '@/lib/open-external'
import { httpUrl } from '@/lib/safe-url'

const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_DOCUMENTS = 3
type Picked = { uri: string; name: string; mimeType: string; size: number | null }
const card = 'bg-card border-border gap-3 rounded-2xl border p-5'

/**
 * Verifying without a college email on the phone (lvn-backend ADR-0019): ask a verified teacher to vouch, or send up to
 * three pictures or PDFs that platform admins check (not for restricted minors). One request waits at a time.
 */
export function VerifyCard({ restrictedMinor }: { restrictedMinor: boolean }) {
  // Documents are uploads: offered only while uploads are on (lvn-backend ADR-0097); asking a teacher always works.
  const uploadsOn = useUploadsEnabled()
  const documents = !restrictedMinor && uploadsOn
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
          {last?.status === 'REJECTED' ? <Text className="rounded-xl bg-rose-soft p-3 text-sm text-destructive">Your last request was not accepted: {last.reason}</Text> : null}
          <Text className="text-muted-foreground text-sm">
            {documents
              ? 'No college email? Ask a teacher who knows you to vouch for you, or send proof that you study (an ID card or a fee receipt) for our team to check.'
              : 'No college email? Ask a teacher who knows you to vouch for you.'}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Pill label="Ask a teacher" primary={mode === 'teacher'} onPress={() => setMode(mode === 'teacher' ? null : 'teacher')} />
            {documents ? <Pill label="Send proof of study" primary={mode === 'documents'} onPress={() => setMode(mode === 'documents' ? null : 'documents')} /> : null}
          </View>
          {mode === 'teacher' ? <AskTeacher onSent={() => void done()} /> : null}
          {mode === 'documents' ? <SendDocuments onSent={() => void done()} /> : null}
        </>
      )}
      <CollegeId restrictedMinor={restrictedMinor} uploadsOn={uploadsOn} />
      <Outcome message={error ? { ok: false, text: error } : null} />
    </View>
  )
}

function AskTeacher({ onSent }: { onSent: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
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
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
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

const ID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_ID_BYTES = 5 * 1024 * 1024

/** The words for a college ID the API refused, matched the way the web does. */
function idProblem(code: string | null | undefined, message: string | null | undefined): string {
  const text = (message ?? '').trim()
  if (code === 'UNAVAILABLE') return 'College ID checks are turned off right now.'
  if (code === 'RATE_LIMITED') {
    const pending = /pending|waiting|already/i.test(text)
    const week = /seven|7\s*days|week|three/i.test(text)
    if (pending && !week) return 'You already have a college ID waiting. Withdraw it before sending another.'
    if (week && !pending) return 'You can send three college ID cards in seven days.'
    return text || 'You can have one college ID waiting, and three in seven days.'
  }
  if (code === 'VALIDATION') {
    const big = /size|large|big|bytes|5\s*mb/i.test(text)
    const type = /type|mime|format|jpeg|png|webp|pdf|content-type/i.test(text)
    if (big && !type) return 'That file is over 5 MB.'
    if (type && !big) return 'Use a JPEG, PNG, WebP or PDF.'
    return text || 'That did not work. Try again.'
  }
  return text && !/^[A-Z0-9_]+$/.test(text) ? text : 'That did not work. Try again.'
}

function localIdProblem(file: Picked): string | null {
  if (!ID_TYPES.includes(file.mimeType)) return 'Use a JPEG, PNG, WebP or PDF.'
  if (file.size != null && file.size <= 0) return 'That file is empty.'
  if (file.size != null && file.size > MAX_ID_BYTES) return 'That file is over 5 MB.'
  return null
}

async function pickCollegeId(source: 'camera' | 'library' | 'files'): Promise<Picked | 'denied' | null> {
  if (source === 'files') {
    const res = await DocumentPicker.getDocumentAsync({ type: ID_TYPES, copyToCacheDirectory: true, multiple: false })
    if (res.canceled) return null
    const a = res.assets[0]
    return a ? { uri: a.uri, name: a.name, mimeType: mimeOf(a.name, a.mimeType), size: a.size ?? null } : null
  }
  if (source === 'camera') {
    const allowed = await ImagePicker.requestCameraPermissionsAsync()
    if (!allowed.granted) return 'denied'
  }
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
  if (res.canceled) return null
  const a = res.assets[0]
  if (!a) return null
  const name = a.fileName ?? (source === 'camera' ? 'college-id.jpg' : 'college-id.jpg')
  return { uri: a.uri, name, mimeType: mimeOf(name, a.mimeType), size: a.fileSize ?? null }
}

/**
 * A college ID card (the web's college ID panel). Hidden for a restricted minor, while uploads are off, and while the
 * API says the option is off.
 */
function CollegeId({ restrictedMinor, uploadsOn }: { restrictedMinor: boolean; uploadsOn: boolean }) {
  const client = useApolloClient()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const offered = !restrictedMinor && uploadsOn
  const enabled = useQuery(StudentIdVerificationEnabledDocument, { skip: !offered, fetchPolicy: 'cache-and-network' })
  const on = offered && enabled.data?.studentIdVerificationEnabled === true
  const mine = useQuery(MyStudentIdVerificationDocument, { skip: !on, fetchPolicy: 'cache-and-network' })
  const [withdraw] = useMutation(WithdrawStudentIdVerificationDocument)
  const [submit] = useMutation(SubmitStudentIdVerificationDocument)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<Picked | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!on) return null
  const current = mine.data?.myStudentIdVerification ?? null
  const pending = current?.status === 'PENDING' ? current : null
  const choose = async (source: 'camera' | 'library' | 'files') => {
    setError(null)
    const picked = await pickCollegeId(source)
    if (picked === 'denied') return setError('Allow the camera to photograph your ID card.')
    if (!picked) return
    const problem = localIdProblem(picked)
    if (problem) return setError(problem)
    setFile(picked)
  }
  const send = async () => {
    if (!file) return
    const problem = localIdProblem(file)
    if (problem) return setError(problem)
    setError(null)
    setBusy(true)
    try {
      const body = await (await fetch(file.uri)).blob()
      if (body.size <= 0) throw new UploadError('That file is empty.')
      if (body.size > MAX_ID_BYTES) throw new UploadError('That file is over 5 MB.')
      const res = await client.mutate({ mutation: CreateStudentIdUploadIntentDocument, variables: { input: { fileName: file.name || 'college-id', mimeType: file.mimeType, sizeBytes: body.size } } })
      const payload = res.data?.createStudentIdUploadIntent
      const upload = payload?.upload
      if (!upload) throw new UploadError(idProblem(payload?.userErrors[0]?.code, payload?.userErrors[0]?.message))
      await putStoredFile(client, upload, body, file.mimeType)
      const sent = await submit({ variables: { input: { fileId: upload.fileId } } })
      const err = sent.data?.submitStudentIdVerification.userErrors[0]
      if (err) throw new UploadError(idProblem(err.code, err.message))
      setFile(null)
      setOpen(false)
      await mine.refetch()
    } catch (e) {
      if (!(e instanceof UploadError)) reportClientError(client, { code: 'upload', message: 'The file could not be uploaded. Try again.' })
      setError(e instanceof UploadError ? e.message : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <View className="border-border gap-2 rounded-xl border p-3" accessibilityLabel="College ID card">
      {pending ? (
        <>
          <Text className="text-sm font-semibold">An admin is checking your college ID card.</Text>
          <Text className="text-muted-foreground text-sm">Sent {new Date(pending.createdAt).toLocaleDateString()}.</Text>
          <View className="flex-row">
            <Pill
              label="Withdraw the request"
              accessibilityLabel="Withdraw the college ID request"
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
          {current?.status === 'REJECTED' ? <Text className="rounded-xl bg-rose-soft p-3 text-sm text-destructive">{current.reason ? `Your college ID was not accepted: ${current.reason}` : 'Your college ID was not accepted.'}</Text> : null}
          {current?.status === 'APPROVED' ? <Text className="rounded-xl bg-emerald-50 p-3 text-sm">Your college ID was accepted.</Text> : null}
          <View className="flex-row">
            <Pill label="Send your college ID card" primary={open} onPress={() => setOpen((v) => !v)} />
          </View>
          {open ? (
            <View className="gap-2">
              <Text className="text-muted-foreground text-sm">A photo or scan of your college ID card. An admin checks it. JPEG, PNG, WebP or PDF, up to 5 MB.</Text>
              <View className="flex-row flex-wrap gap-2">
                <Pill label="Take a photo" onPress={() => void choose('camera')} />
                <Pill label="Choose a photo" onPress={() => void choose('library')} />
                <Pill label="Choose a file" onPress={() => void choose('files')} />
              </View>
              {file ? (
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-sm" numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} onPress={() => setFile(null)} className="p-1">
                    <X size={16} color={muted} />
                  </Pressable>
                </View>
              ) : null}
              <View className="flex-row">
                <Pill label={busy ? 'Sending…' : 'Send to an admin'} primary disabled={!file || busy} onPress={() => void send()} />
              </View>
            </View>
          ) : null}
        </>
      )}
      <Outcome message={error ? { ok: false, text: error } : null} />
    </View>
  )
}

type Request = VerificationRequestsToReviewQuery['verificationRequestsToReview'][number]

/**
 * Requests to verify accounts on the phone (ADR-0019): a verified teacher answers the students who asked them;
 * platform admins check proof of study through short-lived, recorded links. Nothing for a teacher with none waiting.
 */
export function ReviewRequests({ admin, quietForbidden }: { admin?: boolean; quietForbidden?: boolean }) {
  const { data, error, refetch } = useQuery(VerificationRequestsToReviewDocument, { fetchPolicy: 'cache-and-network' })
  const requests = data?.verificationRequestsToReview ?? []
  if (CombinedGraphQLErrors.is(error) && error.errors.some((e) => e.extensions?.code === 'FORBIDDEN')) return admin && !quietForbidden ? <Text className="text-muted-foreground py-16 text-center">This is for platform admins.</Text> : null
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
  const accent = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const [review, reviewing] = useMutation(ReviewVerificationRequestDocument)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const decide = async (approve: boolean) => {
    if (!approve && !reason.trim()) return setError('Tell the student why, so they can try again.')
    const p = await attempt(() => review({ variables: { input: { requestId: r.id, approve, reason: reason.trim() || null } } }))
    setError(p)
    if (!p) onDone()
  }
  const open = async (fileId: string, fileName: string, mimeType: string) => {
    const res = await client.query({ query: VerificationDocumentUrlDocument, variables: { requestId: r.id, fileId }, fetchPolicy: 'network-only' }).catch(() => null)
    const url = httpUrl(res?.data?.verificationDocumentUrl.url)
    if (!url) return setError('That did not work. Try again.')
    if (mimeType.startsWith('image/')) setPreview({ url, name: fileName })
    else openInBrowser(url)
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
      <AiCheck check={r.aiCheck} profileName={r.requester.displayName} profileInstitution={r.requester.institution?.name ?? null} />
      {r.documents.map((d) => (
        <Pressable key={d.fileId} accessibilityRole="button" accessibilityLabel={`Open ${d.fileName}`} onPress={() => void open(d.fileId, d.fileName, d.mimeType)} className="flex-row items-center gap-2 py-1">
          <FileText size={16} color={accent} />
          <Text className="text-primary text-sm font-semibold">{d.fileName}</Text>
        </Pressable>
      ))}
      {preview ? <Image source={{ uri: preview.url }} accessibilityLabel={`Preview ${preview.name}`} contentFit="contain" style={{ width: '100%', height: 180, borderRadius: 12 }} /> : null}
      <TextInput accessibilityLabel="Reason (needed to decline; the student reads it)" placeholder="Reason (needed to decline)" placeholderTextColor={muted} value={reason} onChangeText={setReason} className="border-border text-foreground rounded-xl border px-3 py-2" />
      <View className="flex-row gap-2">
        <Pill label="Verify" primary disabled={reviewing.loading} onPress={() => void decide(true)} />
        <Pill label="Decline" disabled={reviewing.loading} onPress={() => void decide(false)} />
      </View>
      <Outcome message={error ? { ok: false, text: error } : null} />
    </View>
  )
}

function confidencePercent(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(Math.min(100, Math.max(0, value <= 1 ? value * 100 : value)))
}

function sameText(a: string | null | undefined, b: string | null | undefined): 'same' | 'different' | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!a?.trim() || !b?.trim()) return null
  const left = norm(a)
  const right = norm(b)
  return left === right || left.includes(right) || right.includes(left) ? 'same' : 'different'
}

const VERDICT: Record<IdCardVerdict, string> = { MATCH: 'Match', MISMATCH: 'Does not match', UNREADABLE: 'Could not be read' }

/** What was read from a college ID, next to the name and college on the profile. */
function AiCheck({ check, profileName, profileInstitution }: { check: Request['aiCheck']; profileName: string; profileInstitution: string | null }) {
  if (!check) return null
  const percent = confidencePercent(check.confidence)
  const rows = [
    { label: 'Name on the card', value: check.extracted.name, profile: profileName },
    { label: 'Institution on the card', value: check.extracted.institution, profile: profileInstitution },
  ]
  return (
    <View className="bg-secondary gap-1 rounded-xl px-3 py-2">
      <Text className="text-sm">
        <Text className="font-semibold">{VERDICT[check.verdict]}</Text>
        {percent != null ? <Text className="text-muted-foreground"> · {percent}% confidence</Text> : null}
      </Text>
      {check.reason ? <Text className="text-sm">{check.reason}</Text> : null}
      {rows.map((row) => {
        const compared = sameText(row.value, row.profile)
        return (
          <Text key={row.label} className="text-sm">
            {row.label}: {row.value ?? '—'}
            {compared === 'same' ? ' · matches the profile' : compared === 'different' ? ' · does not match the profile' : ''}
          </Text>
        )
      })}
      <Text className="text-muted-foreground text-sm">{check.extracted.idNumber ? `ID number ${check.extracted.idNumber}` : 'No ID number was read from the card.'}</Text>
      {check.extracted.validUntil ? <Text className="text-muted-foreground text-sm">Valid until {check.extracted.validUntil}</Text> : null}
    </View>
  )
}

type Queued = StudentIdVerificationQueueQuery['studentIdVerificationQueue'][number]

/** Platform admins, and teachers whose own account is verified. Managers no longer review. */
export function canReviewVerification(viewer: { globalRole: string; verified: boolean } | null | undefined): boolean {
  if (!viewer) return false
  if (viewer.globalRole === 'PLATFORM_ADMIN') return true
  return viewer.globalRole === 'TEACHER' && viewer.verified
}

const REVIEWERS = 'This is for platform admins and verified teachers.'

/**
 * College ID cards waiting for a decision. Platform admins and verified teachers; the API hides cards outside their scope.
 */
export function StudentIdQueue() {
  const viewer = useQuery(ViewerDocument, { fetchPolicy: 'cache-and-network' })
  const allowed = canReviewVerification(viewer.data?.viewer)
  const queue = useQuery(StudentIdVerificationQueueDocument, { skip: !allowed, variables: { first: 30 }, fetchPolicy: 'cache-and-network' })
  if (!viewer.data?.viewer) return null
  if (!allowed) return <Text className="text-muted-foreground py-8 text-center">{REVIEWERS}</Text>
  if (CombinedGraphQLErrors.is(queue.error) && queue.error.errors.some((e) => e.extensions?.code === 'FORBIDDEN')) return <Text className="text-muted-foreground py-8 text-center">{REVIEWERS}</Text>
  const items = queue.data?.studentIdVerificationQueue ?? []
  return (
    <View className="gap-3">
      <Text className="text-base font-semibold" accessibilityRole="header">
        College ID cards
      </Text>
      <Text className="text-muted-foreground text-sm">Open a card only when you mean to look: the link is short-lived and every open is recorded.</Text>
      {queue.data && !items.length ? <Text className="text-muted-foreground py-8 text-center">No college ID cards waiting.</Text> : null}
      {items.map((item) => (
        <StudentIdCard key={item.id} item={item} onDone={() => void queue.refetch()} />
      ))}
    </View>
  )
}

function StudentIdCard({ item, onDone }: { item: Queued; onDone: () => void }) {
  const client = useApolloClient()
  const accent = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const [review, reviewing] = useMutation(ReviewStudentIdVerificationDocument)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const decide = async (approve: boolean) => {
    if (!approve && !reason.trim()) return setError('Tell the student why, so they can try again.')
    const p = await attempt(() => review({ variables: { input: { requestId: item.id, approve, reason: reason.trim() || null } } }))
    setError(p)
    if (!p) onDone()
  }
  const view = async () => {
    const res = await client.query({ query: StudentIdCardUrlDocument, variables: { requestId: item.id }, fetchPolicy: 'network-only' }).catch(() => null)
    const url = httpUrl(res?.data?.studentIdCardUrl.url)
    if (!url) return setError('That did not work. Try again.')
    setImage(url)
  }
  return (
    <View accessibilityLabel={`College ID from ${item.requester.displayName}`} className="bg-card border-border gap-2 rounded-2xl border p-4">
      <Pressable accessibilityRole="link" onPress={() => router.push(`/u/${item.requester.handle}`)}>
        <Text className="font-semibold">
          {item.requester.displayName} <Text className="text-muted-foreground text-sm font-normal">@{item.requester.handle}</Text>
        </Text>
      </Pressable>
      <AiCheck check={item.aiCheck} profileName={item.requester.displayName} profileInstitution={item.requester.institution?.name ?? null} />
      {image ? (
        <Image source={{ uri: image }} accessibilityLabel={`College ID card for ${item.requester.displayName}`} contentFit="contain" style={{ width: '100%', height: 180, borderRadius: 12 }} />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`View college ID card for ${item.requester.displayName}`} onPress={() => void view()} className="flex-row items-center gap-2 py-1">
          <FileText size={16} color={accent} />
          <Text className="text-primary text-sm font-semibold">View college ID card</Text>
        </Pressable>
      )}
      <TextInput accessibilityLabel="Reason (optional; the student reads it)" placeholder="Reason (optional; the student reads it)" placeholderTextColor={muted} value={reason} onChangeText={setReason} className="border-border text-foreground rounded-xl border px-3 py-2" />
      <View className="flex-row gap-2">
        <Pill label="Approve" primary disabled={reviewing.loading} onPress={() => void decide(true)} />
        <Pill label="Reject" disabled={reviewing.loading} onPress={() => void decide(false)} />
      </View>
      <Outcome message={error ? { ok: false, text: error } : null} />
    </View>
  )
}
