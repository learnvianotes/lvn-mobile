import { useMutation, useQuery } from '@apollo/client/react'
import { RefreshCw, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Outcome, Pill } from '@/features/shell/Form'
import { LoadState } from '@/features/shell/LoadState'
import {
  AddExternalIdentityDocument,
  CheckExternalIdentityDocument,
  DiscardTeacherSkillsDocument,
  MySkillsImportDocument,
  MyTeacherProfileDocument,
  PublishTeacherSkillsDocument,
  RemoveExternalIdentityDocument,
  type ExternalIdentityKind,
  type TeacherSkillFieldsFragment,
} from '@/graphql/generated/graphql'

export const SOURCE: Record<string, string> = { MANUAL: 'By hand', GITHUB: 'GitHub', WEBSITE: 'Your page', ORCID: 'ORCID', OPENALEX: 'OpenAlex' }
export const KIND: Record<string, string> = { QUALIFICATION: 'Qualification', EXPERIENCE: 'Experience', SKILL: 'Skill', PROJECT: 'Project', PUBLICATION: 'Publication' }
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Importing the Skills tab on the phone (lvn-backend ADR-0077): add a GitHub account or a page, put the code where it
 * proves it, check; the import arrives as drafts to publish or discard, and imported items on the tab can be taken
 * away. Verified teachers only; others read when it opens to them.
 */
export function SkillsImport({ drafts, imported }: { drafts: TeacherSkillFieldsFragment[]; imported: TeacherSkillFieldsFragment[] }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const [waiting, setWaiting] = useState(false)
  const query = useQuery(MySkillsImportDocument, { fetchPolicy: 'cache-and-network', pollInterval: waiting ? 4_000 : 0 })
  const { data } = query
  // While an import runs in the background, the drafts are asked for again until they arrive.
  useQuery(MyTeacherProfileDocument, { fetchPolicy: 'network-only', pollInterval: waiting ? 4_000 : 0, skip: !waiting })
  const refetch = { refetchQueries: [MySkillsImportDocument, MyTeacherProfileDocument], awaitRefetchQueries: true }
  const [add, adding] = useMutation(AddExternalIdentityDocument, refetch)
  const [check, checking] = useMutation(CheckExternalIdentityDocument, refetch)
  const [remove] = useMutation(RemoveExternalIdentityDocument, refetch)
  const [publish] = useMutation(PublishTeacherSkillsDocument, refetch)
  const [discard] = useMutation(DiscardTeacherSkillsDocument, refetch)
  const [kind, setKind] = useState<ExternalIdentityKind | null>(null)
  const [value, setValue] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const state = data?.mySkillsImport
  if (!state) return <LoadState query={query} inline message="Importing from GitHub or your page could not load." />
  if (!state.allowed)
    return (
      <View className="border-border gap-1 rounded-2xl border border-dashed p-4">
        <Text className="font-semibold">Import from GitHub or your page</Text>
        <Text className="text-muted-foreground text-sm">Importing from GitHub or your own page opens once you are a verified teacher.</Text>
      </View>
    )
  const chosen = kind ?? state.sources[0]!
  const run = async (fn: () => Promise<{ data?: unknown }>, done?: string) => {
    const problem = await attempt(fn)
    setMessage(problem ? { ok: false, text: problem } : done ? { ok: true, text: done } : null)
    return !problem
  }
  return (
    <View className="bg-card border-border gap-4 rounded-2xl border p-4">
      <View className="gap-1">
        <Text className="font-semibold" accessibilityRole="header">
          Import from GitHub or your page
        </Text>
        <Text className="text-muted-foreground text-sm">Prove an account or a page is yours, and LearnViaNotes reads what it says into drafts for you to review. Nothing shows on your profile until you publish it.</Text>
      </View>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel="From">
        {state.sources.map((s) => (
          <Pressable key={s} accessibilityRole="radio" accessibilityState={{ checked: s === chosen }} onPress={() => setKind(s)} className={`rounded-full px-3 py-1.5 ${s === chosen ? 'bg-primary' : 'border-border border'}`}>
            <Text className={`text-xs font-semibold ${s === chosen ? 'text-primary-foreground' : ''}`}>{SOURCE[s]}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel={chosen === 'GITHUB' ? 'GitHub user name' : 'Your page’s address'}
        value={value}
        onChangeText={setValue}
        placeholder={chosen === 'GITHUB' ? 'octocat' : 'https://…'}
        placeholderTextColor={muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={chosen === 'WEBSITE' ? 'url' : 'default'}
        className="border-border text-foreground rounded-xl border px-3 py-2.5"
      />
      <View className="flex-row">
        <Pill label="Add" primary disabled={adding.loading || !value.trim()} onPress={() => void run(() => add({ variables: { input: { kind: chosen, value: value.trim() } } })).then((ok) => ok && setValue(''))} />
      </View>
      {state.identities.map((i) => (
        <View key={i.id} accessibilityLabel={`${SOURCE[i.kind]} ${i.value}`} className="border-border gap-2 rounded-xl border p-3">
          <View className="flex-row items-center gap-2">
            <Text className="font-semibold">{SOURCE[i.kind]}</Text>
            <Text className="text-muted-foreground flex-1" numberOfLines={1}>
              {i.value}
            </Text>
            <Text className={`text-xs font-semibold ${i.verified ? 'text-primary' : 'text-muted-foreground'}`}>{i.verified ? 'Proven' : 'Not proven yet'}</Text>
          </View>
          {!i.verified ? (
            <View className="gap-1.5">
              <Text className="text-muted-foreground text-sm">{i.instructions}</Text>
              {/* Selectable: a long press copies it. */}
              <Text selectable accessibilityHint="Long press to copy" className="bg-muted self-start rounded px-2 py-1 font-mono text-xs">
                {i.code}
              </Text>
            </View>
          ) : null}
          {i.lastError ? (
            <Text accessibilityRole="alert" className="text-destructive text-sm">
              {i.lastError}
            </Text>
          ) : null}
          {i.fetchedAt ? <Text className="text-muted-foreground text-xs">Last imported {day(i.fetchedAt)}</Text> : null}
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              disabled={checking.loading}
              onPress={() =>
                void run(async () => {
                  const res = await check({ variables: { identityId: i.id } })
                  if (res.data?.checkExternalIdentity.identity?.verified) {
                    setWaiting(true)
                    setTimeout(() => setWaiting(false), 60_000)
                  }
                  return res
                }, 'Checked.')
              }
              className="border-border flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
            >
              <RefreshCw size={14} color={muted} />
              <Text className="text-sm font-semibold">{i.verified ? 'Import again' : 'Check'}</Text>
            </Pressable>
            <View className="flex-1" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${i.value}`}
              onPress={() =>
                Alert.alert(`Remove ${i.value}?`, 'Everything imported from it goes too.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => void run(() => remove({ variables: { identityId: i.id } })) },
                ])
              }
              className="p-2"
            >
              <Trash2 size={18} color={muted} />
            </Pressable>
          </View>
        </View>
      ))}
      {waiting && !drafts.length ? <Text className="text-muted-foreground text-sm">Proven. Importing — your drafts appear here in a minute.</Text> : null}
      {drafts.length ? (
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 font-semibold">{drafts.length === 1 ? '1 draft to review' : `${drafts.length} drafts to review`}</Text>
            <Pill label="Publish all" primary onPress={() => void run(() => publish({ variables: { skillIds: drafts.map((d) => d.id) } }), 'Published on your profile.')} />
          </View>
          {drafts.map((d) => (
            <View key={d.id} className="border-border gap-1 rounded-xl border border-dashed p-3">
              <Text className="text-muted-foreground text-xs">{KIND[d.kind]}</Text>
              <Text className="font-medium">{d.name}</Text>
              {d.detail ? <Text className="text-muted-foreground text-xs">{d.detail}</Text> : null}
              <View className="flex-row gap-2 pt-1">
                <Pill label="Publish" accessibilityLabel={`Publish ${d.name}`} onPress={() => void run(() => publish({ variables: { skillIds: [d.id] } }))} />
                <Pill label="Discard" accessibilityLabel={`Discard ${d.name}`} onPress={() => void run(() => discard({ variables: { skillIds: [d.id] } }))} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {imported.length ? (
        <View className="gap-1.5">
          <Text className="font-semibold">Imported, on your profile</Text>
          {imported.map((s) => (
            <View key={s.id} className="flex-row items-center gap-2">
              <Text className="flex-1" numberOfLines={1}>
                {s.name}
              </Text>
              <Text className="text-muted-foreground text-xs">From {SOURCE[s.source]}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Take ${s.name} off your profile`} onPress={() => void run(() => discard({ variables: { skillIds: [s.id] } }))} className="p-2">
                <Trash2 size={16} color={muted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Outcome message={message} />
    </View>
  )
}
