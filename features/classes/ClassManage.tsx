import { useMutation } from '@apollo/client/react'
import { router } from 'expo-router'
import { RefreshCw } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { confirm } from '@/features/groups/GroupManage'
import { attempt } from '@/features/groups/shared'
import type { SheetAction } from '@/features/shell/ActionSheet'
import { Field, Outcome, Pill } from '@/features/shell/Form'
import { DeleteClassroomDocument, UpdateClassroomDocument, type ClassroomDetailFragment, type ClassroomPeopleQuery } from '@/graphql/generated/graphql'

type Member = NonNullable<NonNullable<ClassroomPeopleQuery['classroom']>['members']>[number]
type Run = () => Promise<{ data?: unknown }>

/**
 * What the teacher can do with someone in the class (ADR-0046): make them a student or a TA, hand the class over (the
 * teacher stays on as a TA), or remove them. TAs only invite and let people in.
 */
export function memberActions(classroom: ClassroomDetailFragment, m: Member, ops: { setRole: (role: 'TEACHER' | 'TA' | 'STUDENT') => Run; remove: Run }, act: (fn: Run, done: string) => void): SheetAction[] {
  if (!classroom.viewerCan.manage || m.role === 'TEACHER') return []
  const name = m.user.displayName
  const list: SheetAction[] = []
  for (const r of ['STUDENT', 'TA'] as const) if (r !== m.role) list.push({ text: r === 'TA' ? 'Make a TA' : 'Make a student', onPress: () => act(ops.setRole(r), `${name} is now ${r === 'TA' ? 'a TA' : 'a student'}.`) })
  list.push({ text: `Hand the class to ${name}`, onPress: () => confirm(`Hand the class to ${name}?`, 'Hand over', () => act(ops.setRole('TEACHER'), `${name} teaches the class now. You stay on as a TA.`), "You'll stay on as a TA.") })
  list.push({ text: 'Remove from the class', destructive: true, onPress: () => confirm(`Remove ${name} from ${classroom.name}?`, 'Remove', () => act(ops.remove, `${name} was removed.`)) })
  return list
}

/** A class's name and description, a new code (the old one and its link stop working), and deleting it. */
export function ClassSettings({ classroom, onSaved }: { classroom: ClassroomDetailFragment; onSaved: () => void }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const [update, updating] = useMutation(UpdateClassroomDocument)
  const [del] = useMutation(DeleteClassroomDocument)
  const [name, setName] = useState(classroom.name)
  const [description, setDescription] = useState(classroom.description ?? '')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const save = async (newCode = false) => {
    const problem = await attempt(() => update({ variables: { input: { classroomId: classroom.id, name: name.trim(), description: description.trim() || null, newCode } } }))
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: newCode ? 'The class has a new code.' : 'Saved.' })
    onSaved()
  }
  const remove = async () => {
    const problem = await attempt(() => del({ variables: { classroomId: classroom.id } }))
    if (problem) return setMessage({ ok: false, text: problem })
    router.replace('/community')
  }
  return (
    <View className="gap-4">
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} />
      <Field label="Description" value={description} onChangeText={setDescription} maxLength={2000} multiline />
      <Outcome message={message} />
      <View className="flex-row flex-wrap gap-2">
        <Pill label="Save" primary disabled={!name.trim() || updating.loading} onPress={() => void save()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New code"
          onPress={() => confirm('Make a new code?', 'Make new code', () => void save(true), 'The old code and link stop working.')}
          className="border-border flex-row items-center gap-1.5 rounded-full border px-4 py-2.5"
        >
          <RefreshCw size={16} color={accent} />
          <Text className="font-semibold">New code</Text>
        </Pressable>
      </View>
      <View className="border-border border-t pt-4">
        <Pill label="Delete class" destructive onPress={() => confirm(`Delete ${classroom.name} for everyone?`, 'Delete', () => void remove(), 'This cannot be undone.')} />
      </View>
    </View>
  )
}
