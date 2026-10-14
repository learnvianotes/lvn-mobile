import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Choices, Field, Outcome, Pill, Toggle } from '@/features/shell/Form'
import { ClaimLegacyDataDocument, DeclineLegacyDataDocument, PhoneAccountDetailsDocument, ProfileTabDocument, SetInstitutionalEmailDocument, UpdateProfileDocument, ViewerDocument, type ViewerFieldsFragment, type YearOfStudy } from '@/graphql/generated/graphql'
import { copy } from './copy'

const card = 'bg-card border-border gap-3 rounded-2xl border p-5'
export const YEARS: Record<YearOfStudy, string> = { YEAR_1: '1st year', YEAR_2: '2nd year', YEAR_3: '3rd year', YEAR_4: '4th year', YEAR_5: '5th year', POSTGRADUATE: 'Postgraduate', GRADUATED: 'Graduated', SCHOOL: 'School', NOT_STUDYING: 'Not studying' }

/** A college or organisation email on the phone (ADR-0017): added or replaced here, its code entered on Verify. */
export function InstitutionalEmailCard({ viewer }: { viewer: ViewerFieldsFragment }) {
  const client = useApolloClient()
  const [set, setting] = useMutation(SetInstitutionalEmailDocument)
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const status = viewer.institutionalEmailStatus
  const save = async () => {
    const p = await attempt(() => set({ variables: { email: email.trim() } }))
    setProblem(p)
    if (p) return
    setEditing(false)
    setEmail('')
    await client.refetchQueries({ include: [ViewerDocument] })
  }
  return (
    <View className={card}>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-semibold" accessibilityRole="header">
          College or organisation email
        </Text>
        {!editing ? <Pill label={!status || status === 'NONE' ? 'Add' : 'Change'} onPress={() => setEditing(true)} /> : null}
      </View>
      {status && status !== 'NONE' ? <Text className="text-sm">{copy.account.status[status]?.(viewer.institutionalEmail ?? '')}</Text> : <Text className="text-muted-foreground text-sm">We send it a code to verify you.</Text>}
      {viewer.institution ? <Text className="text-muted-foreground text-sm">{viewer.institution.name}</Text> : null}
      {status === 'CODE_SENT' ? (
        <View className="flex-row">
          <Pill label="Enter the code" primary onPress={() => router.push('/verify')} />
        </View>
      ) : null}
      {editing ? (
        <View className="gap-2">
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoFocus />
          <Outcome message={problem ? { ok: false, text: problem } : null} />
          <View className="flex-row gap-2">
            <Pill label="Send the code" primary disabled={!email.trim() || setting.loading} onPress={() => void save()} />
            <Pill label="Cancel" onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : null}
    </View>
  )
}

/** Department and year of study, and whether they show on the profile (§7.1). */
export function StudyDetailsCard() {
  const { data } = useQuery(PhoneAccountDetailsDocument, { fetchPolicy: 'cache-and-network' })
  const profile = data?.viewer?.profile
  // Kept here: the form starts again from the server's values whenever they change (a save refreshes them).
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  if (!data?.viewer) return null
  return <StudyDetailsForm key={JSON.stringify(profile)} initial={profile ?? null} message={message} setMessage={setMessage} />
}

function StudyDetailsForm({ initial, message, setMessage }: { initial: { department: string | null; yearOfStudy: YearOfStudy | null; showOnProfile: boolean } | null; message: { ok: boolean; text: string } | null; setMessage: (m: { ok: boolean; text: string } | null) => void }) {
  // The Profile tab's header shows department and year (ADR-0076): it reads them again once saved.
  const [update, updating] = useMutation(UpdateProfileDocument, { refetchQueries: [ProfileTabDocument] })
  const [department, setDepartment] = useState(initial?.department ?? '')
  const [year, setYear] = useState<YearOfStudy | ''>(initial?.yearOfStudy ?? '')
  const [show, setShow] = useState(initial?.showOnProfile ?? false)
  const save = async () => {
    const p = await attempt(() => update({ variables: { input: { department: department.trim() || null, yearOfStudy: year || null, showOnProfile: show } } }))
    setMessage(p ? { ok: false, text: p } : { ok: true, text: 'Saved' })
  }
  return (
    <View className={card}>
      <Text className="text-base font-semibold" accessibilityRole="header">
        Study details
      </Text>
      <Field label="Department" hint="For example CSE, ECE, AI & DS" value={department} onChangeText={setDepartment} maxLength={80} />
      <Choices label="Year of study" value={year} onChange={setYear} options={[{ value: '' as const, label: 'Not set' }, ...(Object.keys(YEARS) as YearOfStudy[]).map((y) => ({ value: y, label: YEARS[y] }))]} />
      <Toggle label="Show department and year on my profile" value={show} onValueChange={setShow} />
      <Outcome message={message} />
      <View className="flex-row">
        <Pill label="Save" primary disabled={updating.loading} onPress={() => void save()} />
      </View>
    </View>
  )
}

/** Progress from the old learnvianotes.in (ADR-0018): brought over, declined, or removed again. */
export function LegacyDataCard() {
  const { data, refetch } = useQuery(PhoneAccountDetailsDocument, { fetchPolicy: 'cache-and-network' })
  const [claim, claiming] = useMutation(ClaimLegacyDataDocument)
  const [decline, declining] = useMutation(DeclineLegacyDataDocument)
  const legacy = data?.viewer?.legacyImport
  if (!legacy || legacy.status === 'NOT_FOUND') return null
  const act = async (fn: () => Promise<unknown>) => {
    await fn().catch(() => undefined)
    await refetch()
  }
  const busy = claiming.loading || declining.loading
  return (
    <View className={card}>
      <Text className="text-base font-semibold" accessibilityRole="header">
        Your progress from the old site
      </Text>
      {legacy.status === 'AVAILABLE' && legacy.counts ? (
        <>
          <Text className="text-sm">
            We found your learnvianotes.in history: {legacy.counts.completedTopics} topics read, {legacy.counts.markedProblems} problems marked, {legacy.counts.studyDays} study days.
          </Text>
          <View className="flex-row gap-2">
            <Pill label="Bring it over" primary disabled={busy} onPress={() => void act(() => claim())} />
            <Pill label="No thanks" disabled={busy} onPress={() => void act(() => decline())} />
          </View>
        </>
      ) : null}
      {legacy.status === 'CLAIMED' ? (
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-sm">Your old progress is here.</Text>
          <Pill label="Remove it" disabled={busy} onPress={() => void act(() => decline())} />
        </View>
      ) : null}
      {legacy.status === 'DECLINED' ? <Text className="text-muted-foreground text-sm">Old-site data removed.</Text> : null}
    </View>
  )
}
