import { useLocalSearchParams } from 'expo-router'
import { AiScreen } from '@/features/ai/AiScreen'

export default function NoteAiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <AiScreen id={id} />
}
