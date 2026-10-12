import { useLocalSearchParams } from 'expo-router'
import { ClassScreen } from '@/features/classes/ClassScreen'

export default function Classroom() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ClassScreen id={id} />
}
