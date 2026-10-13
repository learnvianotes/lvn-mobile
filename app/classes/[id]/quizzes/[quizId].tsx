import { useLocalSearchParams } from 'expo-router'
import { QuizScreen } from '@/features/classes/quizzes/QuizScreen'

/** A class quiz (lvn-backend ADR-0064); QUIZ_PUBLISHED notifications open here. */
export default function ClassQuiz() {
  const { quizId } = useLocalSearchParams<{ id: string; quizId: string }>()
  return <QuizScreen quizId={quizId} />
}
