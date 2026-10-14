import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { BookOpen, FolderGit2, Megaphone, MessageSquare, PenLine } from 'lucide-react-native'
import { Image, Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { ago } from '@/features/notifications/describe'
import { SaveNoteToggle } from '@/features/saved/SaveNoteToggle'
import type { PostCardFieldsFragment } from '@/graphql/generated/graphql'

const ART = {
  NOTE: { icon: BookOpen, colors: ['#4F46E5', '#7C3AED'] },
  BLOG: { icon: PenLine, colors: ['#EA580C', '#DB2777'] },
  POST: { icon: Megaphone, colors: ['#0284C7', '#4F46E5'] },
  PROJECT: { icon: FolderGit2, colors: ['#059669', '#0284C7'] },
} as const
const KIND: Record<string, string> = { NOTE: 'Note', BLOG: 'Blog', POST: 'Post', PROJECT: 'Project' }

/**
 * A public note in Community on the phone (lvn-backend ADR-0076): its author and department, when, its title and first
 * words, its picture, its topic, its comments and Save. The card opens the note; the topic opens its notes in Explore.
 */
export function PostCard({ note, topic }: { note: PostCardFieldsFragment; topic?: { id: string; title: string } | null }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const art = ART[note.kind] ?? ART.NOTE
  const Icon = art.icon
  const chip = topic ?? note.topics[0] ?? null
  const comments = note.discussion?.commentCount ?? 0
  return (
    <View className="bg-card border-border overflow-hidden rounded-2xl border">
      <Pressable accessibilityRole="link" accessibilityLabel={note.title || 'Untitled note'} onPress={() => router.push(`/notes/${note.id}`)}>
        {note.previewPicture ? (
          <Image source={{ uri: note.previewPicture.mediumUrl ?? note.previewPicture.url }} style={{ height: 150, width: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <LinearGradient colors={[...art.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 72, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={26} color="#ffffff" />
          </LinearGradient>
        )}
        <View className="gap-1.5 px-4 pt-3">
          <Text className="text-muted-foreground text-xs">
            {note.owner.displayName}
            {note.owner.profile?.department ? ` · ${note.owner.profile.department}` : ''}
            {note.publishedAt ? ` · ${ago(note.publishedAt)}` : ''} · {KIND[note.kind] ?? 'Note'}
          </Text>
          <Text className="text-lg font-bold">{note.title || 'Untitled note'}</Text>
          {note.excerpt ? (
            <Text className="text-muted-foreground text-sm" numberOfLines={2}>
              {note.excerpt}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View className="flex-row flex-wrap items-center gap-3 px-4 pb-3 pt-2">
        {chip ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Notes on ${chip.title}`} onPress={() => router.push({ pathname: '/explore', params: { topic: chip.id, topicTitle: chip.title } })} className="bg-secondary rounded-full px-2.5 py-1">
            <Text className="text-primary text-xs font-semibold">{chip.title}</Text>
          </Pressable>
        ) : null}
        <View className="flex-row items-center gap-1" accessibilityLabel={comments === 1 ? '1 comment' : `${comments} comments`}>
          <MessageSquare size={15} color={muted} />
          <Text className="text-muted-foreground text-sm">{comments}</Text>
        </View>
        <View className="ml-auto">
          <SaveNoteToggle noteId={note.id} saved={note.viewerSaved} />
        </View>
      </View>
    </View>
  )
}
