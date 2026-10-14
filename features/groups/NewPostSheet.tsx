import { useMutation } from '@apollo/client/react'
import { Portal } from '@rn-primitives/portal'
import { X } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { CreateGroupPostDocument, GroupPostsDocument } from '@/graphql/generated/graphql'
import { attempt, textToDoc } from './shared'

/**
 * A new group post on the phone, from the group page's floating ＋ (lvn-backend ADR-0076): a full-screen composer with
 * the words and Post at the top, where the keyboard never covers them. What was typed stays if it is closed; it empties
 * once the post is in.
 */
export function NewPostSheet({ groupId, open, onClose }: { groupId: string; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [create, creating] = useMutation(CreateGroupPostDocument, { refetchQueries: [{ query: GroupPostsDocument, variables: { id: groupId } }], awaitRefetchQueries: true })
  const input = useRef<TextInput>(null)
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => input.current?.focus(), 250)
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true))
    return () => {
      clearTimeout(timer)
      sub.remove()
    }
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
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} className="bg-background absolute inset-0" style={{ paddingTop: insets.top + 6 }} accessibilityViewIsModal>
          <View className="flex-row items-center gap-2 px-3 pb-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="rounded-full p-2">
              <X size={22} color={fg} />
            </Pressable>
            <Text className="flex-1 text-lg font-bold" accessibilityRole="header">
              New post
            </Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => void post()} className={`bg-primary rounded-full px-5 py-2 ${ready ? '' : 'opacity-40'}`}>
              <Text className="text-primary-foreground font-semibold">{creating.loading ? 'Posting…' : 'Post'}</Text>
            </Pressable>
          </View>
          {error ? (
            <Text accessibilityRole="alert" className="text-destructive px-5 text-sm">
              {error}
            </Text>
          ) : null}
          <TextInput
            ref={input}
            accessibilityLabel="Write a post"
            value={text}
            onChangeText={setText}
            placeholder="Share something with the group…"
            placeholderTextColor={muted}
            multiline
            underlineColorAndroid="transparent"
            className="text-foreground min-h-40 px-5 py-3 text-base"
            textAlignVertical="top"
          />
        </Animated.View>
      ) : null}
    </Portal>
  )
}
