import { useLocalSearchParams } from 'expo-router'
import { JoinClassScreen } from '@/features/classes/JoinClassScreen'

/** A join link (/classes/join/<code>) or a code typed in the Community tab (?via=code). */
export default function JoinClass() {
  const { code, via } = useLocalSearchParams<{ code: string; via?: string }>()
  return <JoinClassScreen code={code} via={via === 'code' ? 'CODE' : 'LINK'} />
}
