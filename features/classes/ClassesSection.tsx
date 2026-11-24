import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { GraduationCap, Plus, Users } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { LoadState } from '@/features/shell/LoadState'
import { AnswerClassroomInviteDocument, MyClassroomsDocument, ViewerDocument, type ClassroomCardFragment } from '@/graphql/generated/graphql'
import { CLASS_ROLE, cleanCode } from './shared'

/**
 * Classes in the Community tab (lvn-backend ADR-0046): invites to answer, a class code to enter, your classes, and for
 * teachers a new class.
 */
export function ClassesSection() {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const accent = String(useCSSVariable('--color-primary') ?? '#2847a8')
  const classes = useQuery(MyClassroomsDocument, { fetchPolicy: 'cache-and-network' })
  const { data, refetch } = classes
  const viewer = useQuery(ViewerDocument)
  // Verified teachers, and teacher applicants who prepare classes while they wait (lvn-backend ADR-0073).
  const teacher = viewer.data?.viewer?.globalRole === 'TEACHER' || viewer.data?.viewer?.teacherStatus === 'PENDING'
  const [answer] = useMutation(AnswerClassroomInviteDocument)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reply = async (inviteId: string, accept: boolean) => {
    setError(await attempt(() => answer({ variables: { inviteId, accept } })))
    await refetch()
  }
  const find = () => {
    const clean = cleanCode(code)
    if (clean) router.push(`/classes/join/${clean}?via=code`)
  }
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-muted-foreground text-sm font-semibold">Your classes</Text>
        {teacher ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/classes/new')} className="flex-row items-center gap-1 py-1">
            <Plus size={16} color={accent} />
            <Text className="text-primary text-sm font-semibold">New class</Text>
          </Pressable>
        ) : null}
      </View>
      {data?.myClassroomInvites.map((i) => (
        <View key={i.id} className="bg-card border-primary gap-2 rounded-2xl border p-4">
          <Text className="font-semibold">{i.classroom.name}</Text>
          <Text className="text-muted-foreground text-sm">
            {i.invitedBy.displayName} invited you as {CLASS_ROLE[i.role]}
          </Text>
          <View className="flex-row gap-2">
            <Pressable accessibilityRole="button" onPress={() => void reply(i.id, true)} className="bg-primary rounded-full px-4 py-2">
              <Text className="text-primary-foreground font-semibold">Accept</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void reply(i.id, false)} className="border-border rounded-full border px-4 py-2">
              <Text className="font-semibold">Decline</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-sm">
          {error}
        </Text>
      ) : null}
      {data?.myClassrooms.map((c) => <ClassRow key={c.id} classroom={c} />)}
      {data && !data.myClassrooms.length ? <Text className="text-muted-foreground">{teacher ? 'No classes yet. Start one, and share its code with your students.' : "You're not in a class yet. Ask your teacher for the class code."}</Text> : null}
      <LoadState query={classes} inline message="Your classes could not load." />
      <View className="bg-card border-border flex-row items-center gap-2 rounded-2xl border px-3">
        <GraduationCap size={18} color={muted} />
        <TextInput accessibilityLabel="Class code" value={code} onChangeText={setCode} onSubmitEditing={find} placeholder="Class code, e.g. K7PQ2MXA" placeholderTextColor={muted} autoCapitalize="characters" autoCorrect={false} maxLength={16} className="text-foreground flex-1 py-3 text-base" />
        <Pressable accessibilityRole="button" accessibilityLabel="Find class" disabled={!cleanCode(code)} onPress={find} className={`rounded-full px-3 py-1.5 ${cleanCode(code) ? 'bg-primary' : 'bg-muted'}`}>
          <Text className="text-primary-foreground text-sm font-semibold">Find</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ClassRow({ classroom }: { classroom: ClassroomCardFragment }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#2847a8')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={classroom.name} onPress={() => router.push(`/classes/${classroom.id}`)} className="bg-card border-border gap-1.5 rounded-2xl border p-4">
      <View className="flex-row items-center gap-2">
        <GraduationCap size={16} color={accent} />
        <Text className="flex-1 font-semibold" numberOfLines={1}>
          {classroom.name}
        </Text>
        {classroom.viewerRole ? <Text className="text-primary text-xs font-semibold">{CLASS_ROLE[classroom.viewerRole]}</Text> : null}
      </View>
      <View className="flex-row items-center gap-1.5">
        <Users size={14} color={muted} />
        <Text className="text-muted-foreground text-xs">
          {classroom.teacher.displayName} · {classroom.memberCount} {classroom.memberCount === 1 ? 'person' : 'people'}
        </Text>
      </View>
    </Pressable>
  )
}
