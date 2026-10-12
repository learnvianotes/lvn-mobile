import { useLocalSearchParams } from 'expo-router'
import { ShareScreen } from '@/features/notes/publishing/ShareScreen'

export default function NoteShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ShareScreen id={id} />
}
