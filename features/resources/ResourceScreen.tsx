import { useMutation, useQuery } from '@apollo/client/react'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { Discussion } from '@/features/discussion/Discussion'
import { ReportLink } from '@/features/moderation/ReportSheet'
import { ScreenHeader } from '@/features/shell/Form'
import { LoadState } from '@/features/shell/LoadState'
import { DeleteResourceDocument, MyResourcesDocument, ResourceDocument } from '@/graphql/generated/graphql'
import { cn } from '@/lib/utils'
import { savesText, SaveToggle } from './Catalogue'
import { STATUS_LABEL, TYPE_LABEL } from './copy'
import { RecommendSheet } from './RecommendSheet'

/** A resource on the phone (lvn-backend ADR-0074): public once approved; its submitter sees it while it waits, with why if rejected. */
export function ResourceScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets()
  const query = useQuery(ResourceDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const { data } = query
  const [remove, removing] = useMutation(DeleteResourceDocument, { refetchQueries: [MyResourcesDocument] })
  const [error, setError] = useState<string | null>(null)
  const [recommending, setRecommending] = useState(false)
  const r = data?.resource
  if (!data) {
    return (
      <View className="bg-background flex-1">
        <ScreenHeader />
        <LoadState query={query} message="This resource could not load." className="mx-4" />
      </View>
    )
  }
  if (!r) {
    return (
      <View className="bg-background flex-1">
        <ScreenHeader />
        <View className="items-center gap-2 px-6 py-16">
          <Text className="text-lg font-bold">This resource is not here.</Text>
          <Text className="text-muted-foreground text-center text-sm">It may be waiting for moderators, or it was removed.</Text>
        </View>
      </View>
    )
  }
  const confirmDelete = () =>
    Alert.alert('Delete this resource?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await remove({ variables: { input: { id: r.id } } })
          const problem = res.data?.deleteResource.userErrors[0]?.message
          if (problem) setError(problem)
          else router.back()
        },
      },
    ])
  return (
    <View className="bg-background flex-1">
      <ScreenHeader />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
        {r.status !== 'APPROVED' ? (
          <View accessibilityRole="summary" className={cn('gap-1 rounded-2xl border p-4', r.status === 'REJECTED' ? 'border-red-300 bg-red-50' : 'border-border bg-secondary')}>
            <Text className="font-semibold">{STATUS_LABEL[r.status]}</Text>
            {r.status === 'PENDING' ? <Text className="text-muted-foreground text-sm">Waiting for moderators: only you can see it until they approve it.</Text> : null}
            {r.status === 'REJECTED' && r.reason ? <Text className="text-sm">Why moderators did not approve it: {r.reason}</Text> : null}
          </View>
        ) : null}
        {r.coverUrl ? <Image source={{ uri: r.coverUrl }} style={{ height: 180, width: 135, borderRadius: 12 }} contentFit="contain" accessibilityIgnoresInvertColors /> : null}
        <Text className="text-primary text-xs font-semibold uppercase">{TYPE_LABEL[r.type]}</Text>
        <Text className="text-2xl font-extrabold" accessibilityRole="header">
          {r.title}
        </Text>
        {r.author ? <Text className="text-muted-foreground text-sm">by {r.author}</Text> : null}
        {/* The link opens in the browser: it is someone's link, not LearnViaNotes' (ADR-0074). */}
        <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(r.url)} className="bg-primary self-start rounded-xl px-4 py-2.5">
          <Text className="text-primary-foreground font-semibold">Open {r.host}</Text>
        </Pressable>
        {r.status === 'APPROVED' ? (
          <View className="flex-row flex-wrap items-center gap-3">
            <SaveToggle resource={r} />
            <Text className="text-muted-foreground text-sm">{savesText(r.saveCount)}</Text>
            <Pressable accessibilityRole="button" onPress={() => setRecommending(true)} className="border-border rounded-full border px-3 py-1.5">
              <Text className="text-sm font-semibold">Recommend</Text>
            </Pressable>
          </View>
        ) : null}
        {r.description ? <Text>{r.description}</Text> : null}
        {r.topics.length ? (
          <View className="flex-row flex-wrap gap-2">
            {r.topics.map((t) => (t ? <Text key={t.id} className="bg-secondary rounded-full px-3 py-1 text-sm">{t.title}</Text> : null))}
          </View>
        ) : null}
        <Pressable accessibilityRole="link" onPress={() => router.push(`/u/${r.submittedBy.handle}`)}>
          <Text className="text-muted-foreground text-sm">Added by {r.submittedBy.displayName}</Text>
        </Pressable>
        {error ? (
          <Text accessibilityRole="alert" className="text-destructive text-sm">
            {error}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          {r.viewerCan.edit ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/resources/${r.id}/edit`)} className="border-border rounded-xl border px-3 py-2">
              <Text className="font-semibold">{r.status === 'REJECTED' ? 'Edit and send again' : 'Edit'}</Text>
            </Pressable>
          ) : null}
          {r.viewerCan.delete ? (
            <Pressable accessibilityRole="button" disabled={removing.loading} onPress={confirmDelete} className="rounded-xl px-3 py-2">
              <Text className="text-destructive font-semibold">Delete</Text>
            </Pressable>
          ) : null}
          {r.viewerCan.report ? <ReportLink entityType="RESOURCE" entityId={r.id} authorId={r.submittedBy.id} /> : null}
        </View>
        {r.status === 'APPROVED' ? <Discussion target={{ type: 'RESOURCE', id: r.id }} /> : null}
      </ScrollView>
      <RecommendSheet resourceId={r.id} open={recommending} onClose={() => setRecommending(false)} />
    </View>
  )
}
