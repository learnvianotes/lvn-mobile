import { useLocalSearchParams } from 'expo-router'
import { DetailsScreen } from '@/features/notes/publishing/DetailsScreen'

export default function NoteDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <DetailsScreen id={id} />
}
