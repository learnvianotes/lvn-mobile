import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { ago } from '@/features/notifications/describe'
import { Outcome, Pill, ScreenHeader } from '@/features/shell/Form'
import { NoteVersionPreviewDocument, NoteVersionsDocument, RestoreNoteVersionDocument, type NoteVersionKind } from '@/graphql/generated/graphql'
import type { CardType } from '@/lib/contracts/domain/enums'
import { CardView } from '../render/CardView'
import { syncNow } from '../sync/engine'

const KIND: Record<NoteVersionKind, string> = { PUBLISHED: 'published', CONFLICT: 'from another device', DRAFT: 'draft before a restore' }

/**
 * A note's versions on the phone (spec §4.3; lvn-backend ADR-0052): published ones, the other side of a conflict, and
 * drafts kept before a restore. Tap one to read it; restoring keeps the current draft as a version first, and the
 * phone pulls the note again so its copy follows.
 */
export function VersionsScreen({ id }: { id: string }) {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const { data, error, fetchMore } = useQuery(NoteVersionsDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const [restore, restoring] = useMutation(RestoreNoteVersionDocument)
  const [chosen, setChosen] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const preview = useQuery(NoteVersionPreviewDocument, { variables: { id, versionId: chosen ?? '' }, skip: !chosen })
  const page = data?.note?.versions
  const versions = page?.edges.map((e) => e.node) ?? []
  const back = async (versionId: string, number: number) => {
    const problem = await attempt(() => restore({ variables: { noteId: id, versionId } }))
    if (problem) return setMessage({ ok: false, text: problem })
    await syncNow(client)
    setMessage({ ok: true, text: `Version ${number} is your draft again.` })
    router.back()
  }
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Version history" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        <Outcome message={message} />
        {error && !data ? <Text className="text-muted-foreground py-16 text-center">Connect to the internet to see this note&apos;s versions.</Text> : null}
        {data && !versions.length ? <Text className="text-muted-foreground py-16 text-center">No versions yet. Publishing creates one.</Text> : null}
        {versions.map((v) => {
          const open = chosen === v.id
          return (
            <View key={v.id} className={`bg-card gap-2 rounded-2xl border p-4 ${open ? 'border-primary' : 'border-border'}`}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Version ${v.number}, ${KIND[v.kind]}`} onPress={() => setChosen(open ? null : v.id)}>
                <Text className="font-semibold">
                  Version {v.number} <Text className="text-muted-foreground text-sm font-normal">· {KIND[v.kind]}</Text>
                </Text>
                <Text className="text-muted-foreground text-xs">
                  {v.title || 'Untitled'} · {ago(v.createdAt)}
                  {v.createdBy ? ` · ${v.createdBy.displayName}` : ''}
                  {data?.note?.publishedVersion?.id === v.id ? ' · readers see this one' : ''}
                </Text>
              </Pressable>
              {open ? (
                <View className="gap-3">
                  {(preview.data?.note?.version?.cards.edges ?? []).map(({ node: c }) => (
                    <CardView key={c.id} type={c.type as CardType} content={c.content as unknown} />
                  ))}
                  <Text className="text-muted-foreground text-xs">Your current draft is kept as a version first, so nothing is lost.</Text>
                  <View className="flex-row">
                    <Pill
                      label="Restore this version"
                      primary
                      disabled={restoring.loading}
                      onPress={() =>
                        Alert.alert(`Restore version ${v.number}?`, 'Your current draft is kept as a version first.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Restore', onPress: () => void back(v.id, v.number) },
                        ])
                      }
                    />
                  </View>
                </View>
              ) : null}
            </View>
          )
        })}
        {page?.pageInfo.hasNextPage ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void fetchMore({
                variables: { after: page.pageInfo.endCursor },
                updateQuery: (prev, { fetchMoreResult }) => {
                  const before = prev.note?.versions
                  const more = fetchMoreResult.note?.versions
                  return before && more && fetchMoreResult.note ? { note: { ...fetchMoreResult.note, versions: { ...more, edges: [...before.edges, ...more.edges] } } } : prev
                },
              })
            }
            className="border-border self-center rounded-full border px-4 py-2"
          >
            <Text className="font-semibold">Show older</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}
