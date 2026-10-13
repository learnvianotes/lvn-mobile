import { useLocalSearchParams } from 'expo-router'
import { RecordScreen } from '@/features/notes/media/RecordScreen'

export default function NoteRecordScreen() {
  const { id, transcribe } = useLocalSearchParams<{ id: string; transcribe?: string }>()
  return <RecordScreen id={id} transcribe={transcribe === '1'} />
}
