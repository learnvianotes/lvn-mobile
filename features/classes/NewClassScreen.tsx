import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { Field, Outcome, Pill, ScreenHeader } from '@/features/shell/Form'
import { CreateClassroomDocument, ViewerDocument } from '@/graphql/generated/graphql'

/** A teacher starts a class on the phone (lvn-backend ADR-0046): it gets its code at once, shown on the class. */
export function NewClassScreen() {
  const insets = useSafeAreaInsets()
  const viewer = useQuery(ViewerDocument)
  const [create, creating] = useMutation(CreateClassroomDocument)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const teacher = viewer.data?.viewer?.globalRole === 'TEACHER'
  const submit = async () => {
    let id: string | undefined
    const problem = await attempt(async () => {
      const res = await create({ variables: { input: { name: name.trim(), description: description.trim() || null } } })
      id = res.data?.createClassroom.classroom?.id
      return res
    })
    setError(problem)
    if (!problem && id) router.replace(`/classes/${id}`)
  }
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="New class" />
      {viewer.data && !teacher ? (
        <Text className="text-muted-foreground px-6 py-16 text-center">Classes are started by teachers. Ask yours for the class code.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <Field label="Name" value={name} onChangeText={setName} maxLength={80} placeholder="For example: Data Structures, Section B" autoFocus />
          <Field label="Description" value={description} onChangeText={setDescription} maxLength={2000} multiline />
          <Text className="text-muted-foreground text-sm">Students ask to join with the class code or its link, and you or a TA let them in.</Text>
          <Outcome message={error ? { ok: false, text: error } : null} />
          <View className="flex-row justify-end">
            <Pill label="Create class" primary disabled={!name.trim() || creating.loading || !teacher} onPress={() => void submit()} />
          </View>
        </ScrollView>
      )}
    </View>
  )
}
