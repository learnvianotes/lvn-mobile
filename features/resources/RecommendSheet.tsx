import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react'
import { Portal } from '@rn-primitives/portal'
import { useEffect, useState } from 'react'
import { BackHandler, Pressable, ScrollView, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { MyClassroomsDocument, MyGroupsDocument, RecommendResourceDocument, SearchDocument } from '@/graphql/generated/graphql'
import { RESOURCE_LIMITS } from '@/lib/contracts/validation'
import { cn } from '@/lib/utils'
import { SHEET_IN, SHEET_OUT } from '@/features/shell/sheet-motion'

type Kind = 'person' | 'group' | 'class'
type To = { kind: Kind; id: string; name: string }
const TAB: Record<Kind, string> = { person: 'A person', group: 'A group', class: 'A class' }

/**
 * Recommending a resource with a reason on the phone (lvn-backend ADR-0075): to a person (the API decides whom), a group
 * one may post in, or a class one teaches.
 */
export function RecommendSheet({ resourceId, open, onClose }: { resourceId: string; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  const [tab, setTab] = useState<Kind>('person')
  const [to, setTo] = useState<To | null>(null)
  const [reason, setReason] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [recommend, sending] = useMutation(RecommendResourceDocument)
  const groups = useQuery(MyGroupsDocument, { skip: !open || tab !== 'group' })
  const classes = useQuery(MyClassroomsDocument, { skip: !open || tab !== 'class' })
  const [find, found] = useLazyQuery(SearchDocument)
  useEffect(() => {
    if (tab !== 'person' || query.trim().length < 2) return
    const timer = setTimeout(() => void find({ variables: { query: query.trim() } }), 250)
    return () => clearTimeout(timer)
  }, [query, tab, find])
  const close = () => {
    setTo(null)
    setReason('')
    setError(null)
    setSent(null)
    onClose()
  }
  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (close(), true))
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const send = async () => {
    if (!to) return
    const place = to.kind === 'person' ? { userId: to.id } : to.kind === 'group' ? { groupId: to.id } : { classroomId: to.id }
    const problem = await attempt(() => recommend({ variables: { input: { resourceId, to: place, reason: reason.trim() || null } } }), 'That did not work. Try again.')
    setError(problem)
    if (!problem) setSent(to.name)
  }
  const options: To[] =
    tab === 'person'
      ? (found.data?.search.people ?? []).map((p) => ({ kind: 'person', id: p.id, name: `${p.displayName} (@${p.handle})` }))
      : tab === 'group'
        ? (groups.data?.myGroups ?? []).map((g) => ({ kind: 'group', id: g.id, name: g.name }))
        : (classes.data?.myClassrooms ?? []).filter((c) => c.viewerRole === 'TEACHER' || c.viewerRole === 'TA').map((c) => ({ kind: 'class', id: c.id, name: c.name }))
  return (
    <Portal name={`recommend-${resourceId}`}>
      {open ? (
        <View className="absolute inset-0 justify-end" accessibilityViewIsModal>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0 }}>
            <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(14,14,18,0.45)' }} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={SHEET_IN} exiting={SHEET_OUT} className="bg-card max-h-[85%] rounded-t-3xl px-5 pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="bg-border mb-3 h-1.5 w-10 self-center rounded-full" />
            {sent ? (
              <View accessibilityRole="summary" className="items-center gap-3 py-6">
                <Text className="text-lg font-bold">Recommended to {sent}.</Text>
                <Pressable accessibilityRole="button" onPress={close} className="bg-primary mt-2 rounded-full px-6 py-2.5">
                  <Text className="text-primary-foreground font-semibold">Done</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
                <Text className="text-lg font-bold" accessibilityRole="header">
                  Recommend this resource
                </Text>
                <View className="bg-secondary flex-row gap-1 rounded-xl p-1" accessibilityRole="tablist">
                  {(['person', 'group', 'class'] as const).map((k) => (
                    <Pressable
                      key={k}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === k }}
                      onPress={() => {
                        setTab(k)
                        setTo(null)
                      }}
                      className={cn('flex-1 items-center rounded-lg py-1.5', tab === k && 'bg-card')}
                    >
                      <Text className={cn('text-sm font-semibold', tab !== k && 'text-muted-foreground')}>{TAB[k]}</Text>
                    </Pressable>
                  ))}
                </View>
                {tab === 'person' ? (
                  <>
                    <TextInput accessibilityLabel="Find a person" placeholder="Find a person by name or @handle" placeholderTextColor={muted} value={query} onChangeText={setQuery} autoCapitalize="none" className="border-border text-foreground rounded-xl border px-3 py-2.5" />
                    <Text className="text-muted-foreground text-xs">People you follow, are connected to, or share a group or class with.</Text>
                  </>
                ) : null}
                <View accessibilityRole="radiogroup" className="gap-1">
                  {options.map((o) => (
                    <Pressable key={`${o.kind}:${o.id}`} accessibilityRole="radio" accessibilityState={{ checked: to?.id === o.id }} accessibilityLabel={o.name} onPress={() => setTo(o)} className={cn('rounded-lg px-3 py-2', to?.id === o.id && 'bg-primary/10')}>
                      <Text className={cn('text-sm', to?.id === o.id && 'text-primary font-semibold')}>{o.name}</Text>
                    </Pressable>
                  ))}
                </View>
                {tab === 'group' && groups.data && !options.length ? <Text className="text-muted-foreground text-sm">You are not in a group yet.</Text> : null}
                {tab === 'class' && classes.data && !options.length ? <Text className="text-muted-foreground text-sm">You do not teach a class.</Text> : null}
                <TextInput accessibilityLabel="Why (optional)" placeholder="What it helped you with, in a sentence or two" placeholderTextColor={muted} value={reason} onChangeText={setReason} maxLength={RESOURCE_LIMITS.reason} multiline className="border-border text-foreground min-h-16 rounded-xl border px-3 py-2" />
                {error ? (
                  <Text accessibilityRole="alert" className="text-destructive text-sm">
                    {error}
                  </Text>
                ) : null}
                <View className="flex-row justify-end gap-2">
                  <Pressable accessibilityRole="button" onPress={close} className="rounded-full px-4 py-2.5">
                    <Text className="font-semibold">Cancel</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityState={{ disabled: !to || sending.loading }} disabled={!to || sending.loading} onPress={() => void send()} className={cn('rounded-full px-4 py-2.5', to ? 'bg-primary' : 'bg-muted')}>
                    <Text className={cn('font-semibold', to && 'text-primary-foreground')}>Recommend</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      ) : null}
    </Portal>
  )
}
