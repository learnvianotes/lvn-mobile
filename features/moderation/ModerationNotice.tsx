import { useMutation } from '@apollo/client/react'
import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { AppealModerationDocument, type ModerationState, type ReportEntityType } from '@/graphql/generated/graphql'

const TITLE = { PENDING_REVIEW: 'Waiting for a moderator', HIDDEN: 'Hidden by moderators', REMOVED: 'Removed by moderators', WARNED: 'A warning from the moderators' } as const

/**
 * What the author is told about moderation (ADR-0051): held for review, hidden or removed with the moderators' reason,
 * or a warning on content that stays; and the one appeal. Only the author is ever sent a reason.
 */
export function ModerationNotice({ entityType, entityId, state, reason, canAppeal, onAppealed }: { entityType: ReportEntityType; entityId: string; state: ModerationState; reason?: string | null; canAppeal: boolean; onAppealed?: () => void }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [writing, setWriting] = useState(false)
  const [message, setMessage] = useState('')
  const [appealed, setAppealed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appeal, appealing] = useMutation(AppealModerationDocument)
  const warned = state === 'OK'
  if (warned && !reason) return null
  const held = state === 'PENDING_REVIEW'
  const lead = held ? 'Until then, only you can see it.' : warned ? 'It stays up. Please keep this in mind next time.' : 'Only you can see it now.'
  const send = async () => {
    const problem = await attempt(() => appeal({ variables: { input: { entityType, entityId, message: message.trim() } } }), 'The appeal did not go through. Try again.')
    setError(problem)
    if (problem) return
    setAppealed(true)
    setWriting(false)
    onAppealed?.()
  }
  return (
    <View accessibilityRole="summary" className={`gap-1 rounded-xl border px-3 py-2 ${held || warned ? 'border-amber-500/40 bg-amber-50' : 'border-red-500/40 bg-red-50'}`}>
      <Text className={`text-sm font-semibold ${held || warned ? 'text-amber-950' : 'text-red-950'}`}>{TITLE[warned ? 'WARNED' : state]}</Text>
      {reason ? <Text className={`text-sm ${held || warned ? 'text-amber-950' : 'text-red-950'}`}>{reason}</Text> : null}
      <Text className={`text-xs ${held || warned ? 'text-amber-900' : 'text-red-900'}`}>{lead}</Text>
      {appealed ? <Text className="text-sm font-semibold text-red-950">Your appeal is with the moderators.</Text> : null}
      {canAppeal && !appealed && !writing ? (
        <Pressable accessibilityRole="button" onPress={() => setWriting(true)} className="self-start rounded-full border border-red-500/40 px-3 py-1.5">
          <Text className="text-sm font-semibold text-red-950">Appeal</Text>
        </Pressable>
      ) : null}
      {writing ? (
        <View className="gap-2 pt-1">
          <Text className="text-xs text-red-900">Tell the moderators why it should come back. You can appeal once.</Text>
          <TextInput accessibilityLabel="Your message" value={message} onChangeText={setMessage} placeholderTextColor={muted} maxLength={2000} multiline className="text-foreground min-h-16 rounded-xl border border-red-500/40 bg-white px-3 py-2" />
          {error ? (
            <Text accessibilityRole="alert" className="text-destructive text-sm">
              {error}
            </Text>
          ) : null}
          <View className="flex-row justify-end gap-2">
            <Pressable accessibilityRole="button" onPress={() => setWriting(false)} className="rounded-full px-3 py-1.5">
              <Text className="font-semibold text-red-950">Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!message.trim() || appealing.loading} onPress={() => void send()} className={`rounded-full px-3 py-1.5 ${message.trim() ? 'bg-primary' : 'bg-muted'}`}>
              <Text className="text-primary-foreground font-semibold">Send appeal</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

/** The notice for a comment, post, announcement or doubt from its moderation fields; nothing when there is nothing to tell. */
export function ContentModeration({ entityType, item, onAppealed }: { entityType: ReportEntityType; item: { id: string; moderation: ModerationState; moderationReason?: string | null; moderationCanAppeal: boolean }; onAppealed?: () => void }) {
  if (item.moderation === 'OK' && !item.moderationReason) return null
  return <ModerationNotice entityType={entityType} entityId={item.id} state={item.moderation} reason={item.moderationReason} canAppeal={item.moderationCanAppeal} onAppealed={onAppealed} />
}
