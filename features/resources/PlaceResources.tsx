import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { RemoveResourceRecommendationDocument, ResourceRecommendationsDocument } from '@/graphql/generated/graphql'
import { ResourceCard } from './Catalogue'

/** A group's or class's Resources tab on the phone (lvn-backend ADR-0075): what members recommended, with who and why. */
export function PlaceResources({ to }: { to: { groupId: string } | { classroomId: string } }) {
  const { data, refetch } = useQuery(ResourceRecommendationsDocument, { variables: { to, first: 30 }, fetchPolicy: 'cache-and-network' })
  const [remove] = useMutation(RemoveResourceRecommendationDocument)
  const items = data?.resourceRecommendations.edges.map((e) => e.node) ?? []
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground flex-1 text-sm">Resources members recommended, with why.</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/resources')}>
          <Text className="text-primary text-sm font-semibold">Browse</Text>
        </Pressable>
      </View>
      {data && !items.length ? <Text className="text-muted-foreground py-6 text-center text-sm">Nothing recommended here yet. Open a resource and choose Recommend.</Text> : null}
      {items.map((r) => (
        <View key={r.id} className="gap-1">
          <ResourceCard resource={r.resource} note={`${r.from.displayName}${r.reason ? `: ${r.reason}` : ''}`} />
          {r.viewerCanRemove ? (
            <Pressable accessibilityRole="button" onPress={async () => (await remove({ variables: { input: { id: r.id } } }), void refetch())} className="self-start px-1 py-1">
              <Text className="text-muted-foreground text-xs font-semibold">Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  )
}
