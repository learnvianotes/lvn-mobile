import { useMutation } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Choices, Field, Outcome, Pill, ScreenHeader, Toggle } from '@/features/shell/Form'
import { CreateGroupDocument, type GroupPrivacy, type GroupType } from '@/graphql/generated/graphql'
import { attempt, PRIVACY, TYPE } from './shared'

/** Starting a study group or a project workspace on the phone (lvn-backend ADR-0045, ADR-0048); limits are the API's. */
export function NewGroupScreen() {
  const insets = useSafeAreaInsets()
  const [create, creating] = useMutation(CreateGroupDocument)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<GroupType>('COMMUNITY')
  const [privacy, setPrivacy] = useState<GroupPrivacy>('PUBLIC')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    let id: string | undefined
    const problem = await attempt(async () => {
      const res = await create({ variables: { input: { name: name.trim(), description: description.trim() || null, type, privacy, joinPolicy: privacy === 'PUBLIC' && open ? 'OPEN' : 'APPROVAL' } } })
      id = res.data?.createGroup.group?.id
      return res
    })
    setError(problem)
    if (!problem && id) router.replace(`/groups/${id}`)
  }
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="New group" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Field label="Name" value={name} onChangeText={setName} maxLength={80} autoFocus />
        <Field label="Description" value={description} onChangeText={setDescription} maxLength={2000} multiline />
        <Choices label="What it is" value={type} onChange={setType} options={(['COMMUNITY', 'PROJECT'] as const).map((k) => ({ value: k, ...TYPE[k] }))} />
        <Choices label="Who can find it" value={privacy} onChange={setPrivacy} options={(['PUBLIC', 'PRIVATE'] as const).map((k) => ({ value: k, ...PRIVACY[k] }))} />
        {privacy === 'PUBLIC' ? <Toggle label="Let people join without approval" value={open} onValueChange={setOpen} /> : null}
        <Outcome message={error ? { ok: false, text: error } : null} />
        <View className="flex-row justify-end">
          <Pill label="Create group" primary disabled={!name.trim() || creating.loading} onPress={() => void submit()} />
        </View>
      </ScrollView>
    </View>
  )
}
