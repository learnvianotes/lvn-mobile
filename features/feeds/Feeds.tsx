import { useQuery } from '@apollo/client/react'
import { router, type Href } from 'expo-router'
import { BookOpen, CircleHelp, FileText, Lightbulb, Megaphone, MessageSquare } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { RichDoc } from '@/features/notes/render/RichText'
import { ago } from '@/features/notifications/describe'
import { ActivityFeedDocument, FollowingFeedDocument, ForYouFeedDocument, TrendingFeedDocument, type ActivityFeedQuery } from '@/graphql/generated/graphql'
import { PostCard } from './PostCard'
import type { Doc } from '@/lib/contracts/validation'

type Item = ActivityFeedQuery['activityFeed']['edges'][number]['node']

const DID: Record<Item['kind'], string> = { GROUP_POST: 'posted in', IDEA: 'shared an idea in', DOUBT: 'asked a doubt in', CLASS_ANNOUNCEMENT: 'posted an announcement in', SHARED_NOTE: 'shared a note with' }
const ICON = { GROUP_POST: MessageSquare, IDEA: Lightbulb, DOUBT: CircleHelp, CLASS_ANNOUNCEMENT: Megaphone, SHARED_NOTE: FileText } as const
const KIND: Record<string, string> = { NOTE: 'Note', PROJECT: 'Project', BLOG: 'Blog', POST: 'Post' }

function More({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="border-border self-center rounded-full border px-4 py-2">
      <Text className="font-semibold">Show more</Text>
    </Pressable>
  )
}

/** What happened in your groups and classes, newest first (lvn-backend ADR-0049), in words written here from ids. */
export function ActivityFeed() {
  const { data, fetchMore } = useQuery(ActivityFeedDocument, { fetchPolicy: 'cache-and-network' })
  const feed = data?.activityFeed
  if (!feed) return null
  const items = feed.edges.map((e) => e.node).filter((i) => i.kind !== 'SHARED_NOTE' || i.note)
  if (!items.length) return <Text className="text-muted-foreground py-6 text-center">Nothing new in your groups and classes yet. Join a group or a class to see what happens there.</Text>
  return (
    <View className="gap-3">
      {items.map((i) => (
        <ActivityCard key={i.key} item={i} />
      ))}
      {feed.pageInfo.hasNextPage ? (
        <More
          onPress={() =>
            void fetchMore({
              variables: { after: feed.pageInfo.endCursor },
              updateQuery: (prev, { fetchMoreResult }) => ({ activityFeed: { ...fetchMoreResult.activityFeed, edges: [...prev.activityFeed.edges, ...fetchMoreResult.activityFeed.edges] } }),
            })
          }
        />
      ) : null}
    </View>
  )
}

function ActivityCard({ item }: { item: Item }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const Icon = ICON[item.kind]
  const place = item.group?.name ?? item.classroom?.name ?? null
  const href = (item.doubt && item.group ? `/groups/${item.group.id}/doubts/${item.doubt.id}` : item.note ? `/notes/${item.note.id}` : item.group ? `/groups/${item.group.id}` : item.classroom ? `/classes/${item.classroom.id}` : null) as Href | null
  const body = item.post?.body ?? item.announcement?.body
  return (
    <Pressable accessibilityRole="link" disabled={!href} onPress={() => href && router.push(href)} className="bg-card border-border gap-2 rounded-2xl border p-4">
      <View className="flex-row items-start gap-2">
        <Icon size={16} color={accent} />
        <Text className="flex-1 text-sm">
          {item.actor?.displayName ?? 'Someone'} {DID[item.kind]} {place ? <Text className="font-semibold">{place}</Text> : null}
        </Text>
        <Text className="text-muted-foreground text-xs">{ago(item.at)}</Text>
      </View>
      {item.doubt ? <Text className="font-semibold">{item.doubt.title}</Text> : null}
      {item.note ? (
        <View className="flex-row items-center gap-2">
          <BookOpen size={14} color={accent} />
          <Text className="font-semibold">{item.note.title || 'Untitled note'}</Text>
        </View>
      ) : null}
      {body ? <RichDoc doc={body as Doc} /> : null}
      {item.post?.discussion.commentCount ? <Text className="text-muted-foreground text-xs">{item.post.discussion.commentCount === 1 ? '1 comment' : `${item.post.discussion.commentCount} comments`}</Text> : null}
    </Pressable>
  )
}

/** Public notes and publications of the people you follow (lvn-backend ADR-0049). */
export function FollowingFeed() {
  const { data, fetchMore } = useQuery(FollowingFeedDocument, { fetchPolicy: 'cache-and-network' })
  const feed = data?.followingFeed
  if (!feed) return null
  if (!feed.edges.length) return <Text className="text-muted-foreground py-6 text-center">Follow teachers and classmates to see their public notes here.</Text>
  return (
    <View className="gap-3">
      {feed.edges.map(({ node }) => (
        <Pressable key={node.id} accessibilityRole="link" accessibilityLabel={node.title || 'Untitled note'} onPress={() => router.push(`/notes/${node.id}`)} className="bg-card border-border gap-1 rounded-2xl border p-4">
          <Text className="text-muted-foreground text-xs">
            {KIND[node.kind] ?? 'Note'} · {node.owner.displayName}
            {node.publishedAt ? ` · ${ago(node.publishedAt)}` : ''}
          </Text>
          <Text className="text-lg font-bold">{node.title || 'Untitled note'}</Text>
        </Pressable>
      ))}
      {feed.pageInfo.hasNextPage ? (
        <More
          onPress={() =>
            void fetchMore({
              variables: { after: feed.pageInfo.endCursor },
              updateQuery: (prev, { fetchMoreResult }) => ({ followingFeed: { ...fetchMoreResult.followingFeed, edges: [...prev.followingFeed.edges, ...fetchMoreResult.followingFeed.edges] } }),
            })
          }
        />
      ) : null}
    </View>
  )
}

function Empty({ text, links }: { text: string; links: { label: string; onPress: () => void }[] }) {
  return (
    <View className="border-border items-center gap-3 rounded-2xl border border-dashed p-5">
      <Text className="text-muted-foreground text-center text-sm">{text}</Text>
      <View className="flex-row flex-wrap justify-center gap-4">
        {links.map((l) => (
          <Pressable key={l.label} accessibilityRole="link" onPress={l.onPress}>
            <Text className="text-primary text-sm font-semibold">{l.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

/** For You (lvn-backend ADR-0076): public notes on the person's topics, newest first; with none, the ways to have some. */
export function ForYouFeed() {
  const { data, fetchMore } = useQuery(ForYouFeedDocument, { fetchPolicy: 'cache-and-network' })
  const feed = data?.forYouFeed
  if (!feed) return null
  if (!feed.edges.length) {
    return (
      <Empty
        text={feed.basedOn.length ? 'No public notes on your topics yet.' : 'For You shows public notes on the topics you choose, your exams’ topics and what you read lately.'}
        links={[
          { label: 'Choose topics', onPress: () => router.push('/settings') },
          { label: 'Add an exam', onPress: () => router.push('/exams') },
        ]}
      />
    )
  }
  const topics = feed.basedOn.flatMap((x) => (x ? [x.title] : [])).slice(0, 5)
  return (
    <View className="gap-3">
      {topics.length ? (
        <Text className="text-muted-foreground text-xs">
          On {topics.join(', ')}.{' '}
          <Text className="text-primary font-semibold" accessibilityRole="link" onPress={() => router.push('/settings')}>
            Change
          </Text>
        </Text>
      ) : null}
      {feed.edges.map(({ node, topic }) => (node ? <PostCard key={node.id} note={node} topic={topic} /> : null))}
      {feed.pageInfo.hasNextPage ? <More onPress={() => void fetchMore({ variables: { after: feed.pageInfo.endCursor }, updateQuery: (prev, { fetchMoreResult }) => ({ forYouFeed: { ...fetchMoreResult.forYouFeed, edges: [...prev.forYouFeed.edges, ...fetchMoreResult.forYouFeed.edges] } }) })} /> : null}
    </View>
  )
}

/** Trending (lvn-backend ADR-0076): the public notes most reacted to and discussed this week. */
export function TrendingFeed({ onForYou }: { onForYou: () => void }) {
  const { data, fetchMore } = useQuery(TrendingFeedDocument, { fetchPolicy: 'cache-and-network' })
  const feed = data?.trendingFeed
  if (!feed) return null
  if (!feed.edges.length) return <Empty text="Nothing is trending this week yet." links={[{ label: 'See For You', onPress: onForYou }]} />
  return (
    <View className="gap-3">
      {feed.edges.map(({ node }) => (node ? <PostCard key={node.id} note={node} /> : null))}
      {feed.pageInfo.hasNextPage ? (
        <More
          onPress={() =>
            void fetchMore({
              variables: { after: feed.pageInfo.endCursor },
              updateQuery: (prev, { fetchMoreResult }) => {
                const seen = new Set(prev.trendingFeed.edges.map((e) => e.node?.id))
                return { trendingFeed: { ...fetchMoreResult.trendingFeed, edges: [...prev.trendingFeed.edges, ...fetchMoreResult.trendingFeed.edges.filter((e) => !seen.has(e.node?.id))] } }
              },
            })
          }
        />
      ) : null}
    </View>
  )
}
