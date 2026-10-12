import { useLocalSearchParams } from 'expo-router'
import { ProfileScreen } from '@/features/people/ProfileScreen'

export default function Profile() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  return <ProfileScreen handle={handle} />
}
