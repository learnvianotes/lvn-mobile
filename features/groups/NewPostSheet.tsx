import { useMutation } from '@apollo/client/react'
import { Portal } from '@rn-primitives/portal'
import { useEffect, useState } from 'react'
import { BackHandler, Pressable, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { CreateGroupPostDocument, GroupPostsDocument } from '@/graphql/generated/graphql'
import { attempt, textToDoc } from './shared'

/**
 * A new group post on the phone, from the group page's floating ＋ (lvn-backend ADR-0076). What was typed stays if the
 * sheet is closed; it empties once the post is in.
 */
export function NewPostSheet({ groupId, open, onClose }: { groupId: string; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [create, creating] = useMutation(CreateGroupPostDocument, { refetchQueries: [{ query: GroupPostsDocument, variables: { id: groupId } }], awaitRefetchQueries: true })
  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true))
    return () => sub.remove()
  }, [open, onClose])
  const post = async () => {
    const problem = await attempt(() => create({ variables: { groupId, body: textToDoc(text) } }))
    setError(problem)
    if (problem) return
    setText('')
    onClose()
  }
  const ready = !!text.trim() && !creating.loading
  return (
    <Portal name={`new-post-${groupId}`}>
      {open ? (
        <View className="absolute inset-0 justify-end" accessibilityViewIsModal>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0 }}>
            <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,14,18,0.45)' }} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={SlideInDown.springify().damping(20).stiffness(220)} exiting={SlideOutDown.duration(180)} className="bg-card gap-3 rounded-t-3xl px-5 pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="bg-border mb-1 h-1.5 w-10 self-center rounded-full" />
            <Text className="text-lg font-bold" accessibilityRole="header">
              New post
            </Text>
            <TextInput
              accessibilityLabel="Write a post"
              autoFocus
              value={text}
              onChangeText={setText}
              placeholder="Share something with the group…"
              placeholderTextColor={muted}
              multiline
              className="border-border text-foreground min-h-28 rounded-xl border px-3 py-2"
              textAlignVertical="top"
            />
            {error ? (
              <Text accessibilityRole="alert" className="text-destructive text-sm">
                {error}
              </Text>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => void post()} className={`self-end rounded-full px-5 py-2.5 ${ready ? 'bg-primary' : 'bg-muted'}`}>
              <Text className="text-primary-foreground font-semibold">{creating.loading ? 'Posting…' : 'Post'}</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </Portal>
  )
}
