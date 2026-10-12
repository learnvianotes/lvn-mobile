import { useLocalSearchParams } from 'expo-router'
import { VersionsScreen } from '@/features/notes/publishing/VersionsScreen'

export default function NoteVersionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <VersionsScreen id={id} />
}
