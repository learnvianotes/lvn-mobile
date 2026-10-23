import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Users } from 'lucide-react-native'
import { View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { NoteContributorsDocument } from '@/graphql/generated/graphql'

/**
 * Who a project workspace's showcase credits (lvn-backend ADR-0048): the team, then the mentors. Nothing for other
 * notes, or offline.
 */
export function NoteCredits({ noteId }: { noteId: string }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const { data } = useQuery(NoteContributorsDocument, { variables: { id: noteId }, fetchPolicy: 'cache-and-network', errorPolicy: 'ignore' })
  const credits = data?.note?.contributors ?? []
  if (!credits.length) return null
  const names = (role: 'CONTRIBUTOR' | 'MENTOR') =>
    credits
      .filter((c) => c.role === role)
      .map((c, i, all) => (
        <Text key={c.user.id} accessibilityRole="link" onPress={() => router.push(`/u/${c.user.handle}`)} className="text-foreground text-sm font-semibold">
          {c.user.displayName}
          {i < all.length - 1 ? ', ' : ''}
        </Text>
      ))
  const mentors = credits.filter((c) => c.role === 'MENTOR')
  return (
    <View className="flex-row items-start gap-1.5">
      <Users size={14} color={muted} style={{ marginTop: 3 }} />
      <Text className="text-muted-foreground flex-1 text-sm">
        Built by {names('CONTRIBUTOR')}
        {mentors.length ? <> · mentored by {names('MENTOR')}</> : null}
      </Text>
    </View>
  )
}
