import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, GraduationCap } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { confirm } from '@/features/groups/GroupManage'
import { attempt, textToDoc } from '@/features/groups/shared'
import { ContentModeration } from '@/features/moderation/ModerationNotice'
import { ReportLink } from '@/features/moderation/ReportSheet'
import { RichDoc } from '@/features/notes/render/RichText'
import { ago } from '@/features/notifications/describe'
import { LoadState } from '@/features/shell/LoadState'
import { AnswerDoubtDocument, DeleteDoubtDocument, DoubtDocument, ReopenDoubtDocument, ResolveDoubtDocument } from '@/graphql/generated/graphql'
import type { Doc } from '@/lib/contracts/validation'
import { AnswerList, AskForm } from '@/features/ai/AskAi'
import { StatusChip } from './WorkspaceParts'

/**
 * One doubt on the phone (lvn-backend ADR-0048): the question, its answers (the mentor's marked), answer, resolve, reopen
 * and delete.
 */
export function DoubtScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#1c1b18')
  const accent = String(useCSSVariable('--color-primary') ?? '#2847a8')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#66625b')
  const query = useQuery(DoubtDocument, { variables: { id }, fetchPolicy: 'cache-and-network' })
  const { data, refetch } = query
  const [answer] = useMutation(AnswerDoubtDocument)
  const [resolve] = useMutation(ResolveDoubtDocument)
  const [reopen] = useMutation(ReopenDoubtDocument)
  const [remove] = useMutation(DeleteDoubtDocument)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const d = data?.doubt
  const run = async (fn: () => Promise<{ data?: unknown }>) => {
    setError(await attempt(fn))
    void refetch()
  }
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="size-10 items-center justify-center rounded-full">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
      </View>
      {!d ? (
        data ? <Text className="text-muted-foreground px-6 py-16 text-center">This doubt is not available.</Text> : <LoadState query={query} message="This doubt could not load." className="mx-4" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <View className="bg-card border-border gap-2 rounded-3xl border p-5">
            <View className="flex-row flex-wrap items-center gap-2">
              <StatusChip status={d.status} />
              <Text className="text-muted-foreground flex-1 text-xs">
                {d.author.displayName} · {ago(d.createdAt)}
              </Text>
              <ReportLink icon entityType="DOUBT" entityId={d.id} authorId={d.author.id} />
            </View>
            <ContentModeration entityType="DOUBT" item={d} onAppealed={() => void refetch()} />
            <Text className="text-2xl font-semibold" accessibilityRole="header">
              {d.title}
            </Text>
            {d.repoRef ? <Text className="bg-secondary self-start rounded px-2 py-1 font-mono text-xs">{d.repoRef}</Text> : null}
            <RichDoc doc={d.body as Doc} />
            <View className="flex-row flex-wrap gap-2">
              {d.viewerCan.resolve ? (
                <Pressable accessibilityRole="button" onPress={() => void run(() => resolve({ variables: { doubtId: id } }))} className="bg-primary rounded-full px-4 py-2">
                  <Text className="text-primary-foreground font-semibold">Mark resolved</Text>
                </Pressable>
              ) : null}
              {d.viewerCan.reopen ? (
                <Pressable accessibilityRole="button" onPress={() => void run(() => reopen({ variables: { doubtId: id } }))} className="border-border rounded-full border px-4 py-2">
                  <Text className="font-semibold">Reopen</Text>
                </Pressable>
              ) : null}
              {d.viewerCan.delete ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    confirm('Delete this doubt?', 'Delete', () =>
                      void attempt(() => remove({ variables: { doubtId: id } })).then((problem) => {
                        if (problem) return setError(problem)
                        router.back()
                      }),
                    'Its answers go with it.')
                  }
                  className="border-border rounded-full border px-4 py-2"
                >
                  <Text className="text-destructive font-semibold">Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {/* Ask AI on a doubt (lvn-backend ADR-0015, ADR-0060): over the workspace's notes; the answer is the asker's. */}
          <View className="border-primary/40 gap-3 rounded-2xl border border-dashed p-4">
            <Text className="text-muted-foreground text-sm">AI reads the notes shared with this workspace and this thread. Its answer is for you; post it yourself if it helps.</Text>
            <AskForm scope="WORKSPACE" doubtId={id} />
            <AnswerList doubtId={id} />
          </View>
          <Text className="text-lg font-semibold">{d.answers.length === 1 ? '1 answer' : d.answers.length ? `${d.answers.length} answers` : 'No answers'}</Text>
          {d.answers.map((a) => (
            <View key={a.id} className={`bg-card gap-1.5 rounded-2xl border p-4 ${a.byMentor ? 'border-primary' : 'border-border'}`}>
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="font-semibold">{a.author.displayName}</Text>
                {a.byMentor ? (
                  <View className="bg-secondary flex-row items-center gap-1 rounded-full px-2 py-0.5">
                    <GraduationCap size={12} color={accent} />
                    <Text className="text-primary text-xs font-semibold">Mentor</Text>
                  </View>
                ) : null}
                <Text className="text-muted-foreground text-xs">{ago(a.createdAt)}</Text>
              </View>
              <RichDoc doc={a.body as Doc} />
            </View>
          ))}
          {d.viewerCan.answer ? (
            <View className="gap-2">
              <TextInput accessibilityLabel="Your answer" value={text} onChangeText={setText} placeholder="Write an answer…" placeholderTextColor={muted} multiline className="border-border text-foreground min-h-16 rounded-xl border px-3 py-2" />
              <Pressable
                accessibilityRole="button"
                disabled={!text.trim()}
                onPress={() =>
                  void run(async () => {
                    const res = await answer({ variables: { doubtId: id, body: textToDoc(text) } })
                    if (res.data?.answerDoubt.doubt) setText('')
                    return res
                  })
                }
                className={`self-end rounded-full px-4 py-2 ${text.trim() ? 'bg-primary' : 'bg-muted'}`}
              >
                <Text className="text-primary-foreground font-semibold">Answer</Text>
              </Pressable>
            </View>
          ) : d.status === 'RESOLVED' ? (
            <Text className="text-muted-foreground text-sm">This doubt is resolved. Reopen it to answer again.</Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" className="text-destructive text-sm">
              {error}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}
