import { useLocalSearchParams } from 'expo-router'
import { ResourceScreen } from '@/features/resources/ResourceScreen'

export default function Resource() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ResourceScreen id={id} />
}
