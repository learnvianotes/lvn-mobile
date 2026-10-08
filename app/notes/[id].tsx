import { useLocalSearchParams } from 'expo-router'
import { NoteScreen } from '@/features/notes/NoteScreen'

export default function Note() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <NoteScreen id={id} />
}
