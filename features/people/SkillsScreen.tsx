import { useMutation, useQuery } from '@apollo/client/react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Field, Outcome, Pill, ScreenHeader } from '@/features/shell/Form'
import { MyTeacherProfileDocument, UpdateTeacherProfileDocument, type TeacherSkillKind } from '@/graphql/generated/graphql'

type Item = { key: number; kind: TeacherSkillKind; name: string; detail: string }
const KINDS: Record<TeacherSkillKind, string> = { QUALIFICATION: 'Qualification', EXPERIENCE: 'Experience', SKILL: 'Skill' }
let next = 0

/** A teacher's Skills tab, by hand on the phone (lvn-backend ADR-0012, ADR-0044): headline, about and items, saved in one go. */
export function SkillsScreen() {
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data } = useQuery(MyTeacherProfileDocument, { fetchPolicy: 'cache-and-network' })
  const [save, saving] = useMutation(UpdateTeacherProfileDocument)
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const viewer = data?.viewer

  useEffect(() => {
    if (loaded || !viewer) return
    const p = viewer.teacherProfile
    setHeadline(p?.headline ?? '')
    setBio(p?.bio ?? '')
    setItems((p?.skills ?? []).map((s) => ({ key: next++, kind: s.kind, name: s.name, detail: s.detail ?? '' })))
    setLoaded(true)
  }, [viewer, loaded])

  const update = (key: number, change: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)))
  const move = (index: number, by: -1 | 1) =>
    setItems((list) => {
      const copy = [...list]
      const [item] = copy.splice(index, 1)
      copy.splice(index + by, 0, item!)
      return copy
    })
  const submit = async () => {
    const problem = await attempt(() => save({ variables: { input: { headline: headline.trim() || null, bio: bio.trim() || null, skills: items.filter((i) => i.name.trim()).map((i) => ({ kind: i.kind, name: i.name.trim(), detail: i.detail.trim() || null })) } } }))
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: 'Saved.' })
  }

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Your Skills tab" />
      {viewer && viewer.globalRole !== 'TEACHER' ? (
        <Text className="text-muted-foreground px-6 py-16 text-center">The Skills tab is for teachers.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">What students see on your profile: a headline, a few lines about you, and your qualifications, experience and skills.</Text>
          <Field label="Headline" value={headline} onChangeText={setHeadline} maxLength={120} placeholder="For example: Teaches algorithms to second-year students" />
          <Field label="About you" value={bio} onChangeText={setBio} maxLength={2000} multiline />
          <Text className="text-sm font-semibold">Qualifications, experience and skills</Text>
          {items.map((item, i) => (
            <View key={item.key} accessibilityLabel={`Item ${i + 1}`} className="bg-card border-border gap-2 rounded-2xl border p-3">
              <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel="Kind">
                {(Object.keys(KINDS) as TeacherSkillKind[]).map((k) => (
                  <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: item.kind === k }} onPress={() => update(item.key, { kind: k })} className={`rounded-full px-3 py-1.5 ${item.kind === k ? 'bg-primary' : 'border-border border'}`}>
                    <Text className={`text-xs font-semibold ${item.kind === k ? 'text-primary-foreground' : ''}`}>{KINDS[k]}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput accessibilityLabel="Name" value={item.name} onChangeText={(name) => update(item.key, { name })} placeholder="Name" placeholderTextColor={muted} maxLength={120} className="border-border text-foreground rounded-xl border px-3 py-2" />
              <TextInput accessibilityLabel="Detail (optional)" value={item.detail} onChangeText={(detail) => update(item.key, { detail })} placeholder="Detail (optional)" placeholderTextColor={muted} maxLength={500} className="border-border text-foreground rounded-xl border px-3 py-2" />
              <View className="flex-row justify-end gap-1">
                <Pressable accessibilityRole="button" accessibilityLabel="Move up" accessibilityState={{ disabled: i === 0 }} disabled={i === 0} onPress={() => move(i, -1)} className="p-2">
                  <ArrowUp size={18} color={i === 0 ? '#d1d5db' : muted} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Move down" accessibilityState={{ disabled: i === items.length - 1 }} disabled={i === items.length - 1} onPress={() => move(i, 1)} className="p-2">
                  <ArrowDown size={18} color={i === items.length - 1 ? '#d1d5db' : muted} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name || `item ${i + 1}`}`} onPress={() => setItems((list) => list.filter((x) => x.key !== item.key))} className="p-2">
                  <Trash2 size={18} color={muted} />
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable accessibilityRole="button" disabled={items.length >= 60} onPress={() => setItems((list) => [...list, { key: next++, kind: 'SKILL', name: '', detail: '' }])} className="border-border flex-row items-center gap-1.5 self-start rounded-full border px-4 py-2">
            <Plus size={16} color={muted} />
            <Text className="font-semibold">Add an item</Text>
          </Pressable>
          <Outcome message={message} />
          <View className="flex-row">
            <Pill label="Save" primary disabled={saving.loading || !viewer} onPress={() => void submit()} />
          </View>
        </ScrollView>
      )}
    </View>
  )
}
