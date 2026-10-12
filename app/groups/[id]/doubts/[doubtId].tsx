import { useLocalSearchParams } from 'expo-router'
import { DoubtScreen } from '@/features/workspaces/DoubtScreen'

export default function Doubt() {
  const { doubtId } = useLocalSearchParams<{ doubtId: string }>()
  return <DoubtScreen id={doubtId} />
}
