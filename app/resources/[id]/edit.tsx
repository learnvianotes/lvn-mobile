import { useLocalSearchParams } from 'expo-router'
import { ResourceFormScreen } from '@/features/resources/ResourceFormScreen'

export default function EditResource() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ResourceFormScreen id={id} />
}
