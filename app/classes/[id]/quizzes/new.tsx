import { useLocalSearchParams } from 'expo-router'
import { QuizBuilderScreen } from '@/features/classes/quizzes/QuizBuilderScreen'

export default function NewClassQuiz() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <QuizBuilderScreen classroomId={id} />
}
