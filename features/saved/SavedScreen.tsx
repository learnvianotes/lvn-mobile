import { useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, FileText } from 'lucide-react-native'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ResourceCard } from '@/features/resources/Catalogue'
import { LoadState } from '@/features/shell/LoadState'
import { SavedNotesDocument, SavedResourcesDocument } from '@/graphql/generated/graphql'

/**
 * Saved on the phone (lvn-backend ADR-0076): the notes and resources the person saved, private to them, newest first;
 * each section offers a way to find more when it is empty.
 */
export function SavedScreen() {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const primary = String(useCSSVariable('--color-primary') ?? '#2563eb')
  const notes = useQuery(SavedNotesDocument, { variables: { first: 30 }, fetchPolicy: 'cache-and-network' })
  const resources = useQuery(SavedResourcesDocument, { variables: { first: 60 }, fetchPolicy: 'cache-and-network' })
  const noteList = notes.data?.savedNotes.edges.map((e) => e.node) ?? []
  const page = notes.data?.savedNotes.pageInfo
  const resourceList = resources.data?.savedResources.edges.map((e) => e.node) ?? []
  const more = () =>
    page?.hasNextPage &&
    void notes.fetchMore({ variables: { after: page.endCursor }, updateQuery: (prev, { fetchMoreResult }) => ({ savedNotes: { ...fetchMoreResult.savedNotes, edges: [...prev.savedNotes.edges, ...fetchMoreResult.savedNotes.edges] } }) })
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Saved
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        <Text className="text-muted-foreground text-sm">Notes and resources you saved to come back to. Only you see them.</Text>
        <Text className="text-base font-bold" accessibilityRole="header">
          Notes
        </Text>
        <LoadState query={notes} message="Your saved notes could not load." />
        {notes.data && !noteList.length && !page?.hasNextPage ? (
          <Pressable accessibilityRole="link" onPress={() => router.push('/explore')} className="border-border rounded-2xl border border-dashed p-4">
            <Text className="text-muted-foreground text-center text-sm">
              You have not saved a note yet. <Text className="text-primary font-semibold">Find notes</Text>
            </Text>
          </Pressable>
        ) : null}
        {noteList.map((n) => (
          <Pressable key={n.id} accessibilityRole="link" accessibilityLabel={n.title || 'Untitled note'} onPress={() => router.push(`/notes/${n.id}`)} className="bg-card border-border flex-row gap-3 rounded-2xl border p-4">
            <FileText size={20} color={primary} />
            <View className="flex-1 gap-1">
              <Text className="font-semibold" numberOfLines={1}>
                {n.title || 'Untitled note'}
              </Text>
              {n.excerpt ? (
                <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                  {n.excerpt}
                </Text>
              ) : null}
              <Text className="text-muted-foreground text-xs">by {n.owner.displayName}</Text>
            </View>
          </Pressable>
        ))}
        {page?.hasNextPage ? (
          <Pressable accessibilityRole="button" onPress={more} className="self-start py-1">
            <Text className="text-primary text-sm font-semibold">Show more</Text>
          </Pressable>
        ) : null}
        <Text className="mt-2 text-base font-bold" accessibilityRole="header">
          Resources
        </Text>
        <LoadState query={resources} message="Your saved resources could not load." />
        {resources.data && !resourceList.length ? (
          <Pressable accessibilityRole="link" onPress={() => router.push('/resources')} className="border-border rounded-2xl border border-dashed p-4">
            <Text className="text-muted-foreground text-center text-sm">
              You have not saved a resource yet. <Text className="text-primary font-semibold">Browse resources</Text>
            </Text>
          </Pressable>
        ) : null}
        {resourceList.map((r) => (
          <ResourceCard key={r.id} resource={r} />
        ))}
      </ScrollView>
    </View>
  )
}
