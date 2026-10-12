import { useLocalSearchParams } from 'expo-router'
import { GroupScreen } from '@/features/groups/GroupScreen'

export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <GroupScreen id={id} />
}
