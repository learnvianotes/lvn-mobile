import { useLocalSearchParams } from 'expo-router'
import { ExamScreen } from '@/features/learning/ExamsScreen'

export default function ExamRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ExamScreen id={id} />
}
