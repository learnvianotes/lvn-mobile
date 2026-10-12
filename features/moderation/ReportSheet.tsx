import { useMutation, useQuery } from '@apollo/client/react'
import { Portal } from '@rn-primitives/portal'
import { Check, Flag } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { BackHandler, Pressable, ScrollView, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { ReportContentDocument, ViewerDocument, type ReportEntityType, type ReportReason } from '@/graphql/generated/graphql'
import { REASONS, REPORT_TITLE } from './copy'

/**
 * "Report" on the phone (§15.1, ADR-0051): a reason and a few words, for the moderators of where it is (a group's, a
 * class's staff, or the platform's); the author is never told who sent it. Shown only to signed-in people other than
 * the author. `icon` is a flag for a row of small buttons.
 */
export function ReportLink({ entityType, entityId, authorId, icon }: { entityType: ReportEntityType; entityId: string; authorId: string; icon?: boolean }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const viewer = useQuery(ViewerDocument)
  const [open, setOpen] = useState(false)
  if (!viewer.data?.viewer || viewer.data.viewer.id === authorId) return null
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={REPORT_TITLE[entityType]} onPress={() => setOpen(true)} className={icon ? 'p-1.5' : undefined}>
        {icon ? <Flag size={16} color={muted} /> : <Text className="text-muted-foreground text-xs font-semibold">Report</Text>}
      </Pressable>
      <ReportSheet entityType={entityType} entityId={entityId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** The report form in a sheet over the screen, for a trigger of one's own (a profile's actions). */
export function ReportSheet({ entityType, entityId, open, onClose }: { entityType: ReportEntityType; entityId: string; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, reporting] = useMutation(ReportContentDocument)
  const close = () => {
    onClose()
    setReason(null)
    setDetails('')
    setSent(false)
    setError(null)
  }
  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const send = async () => {
    if (!reason) return
    const problem = await attempt(() => report({ variables: { input: { entityType, entityId, reason, details: details.trim() || null } } }), 'The report did not go through. Try again.')
    setError(problem)
    if (!problem) setSent(true)
  }
  return (
    <Portal name={`report-${entityType}-${entityId}`}>
      {open ? (
        <View className="absolute inset-0 justify-end" accessibilityViewIsModal>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0 }}>
            <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(14,14,18,0.45)' }} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={SlideInDown.springify().damping(20).stiffness(220)} exiting={SlideOutDown.duration(180)} className="bg-card max-h-[85%] rounded-t-3xl px-5 pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="bg-border mb-3 h-1.5 w-10 self-center rounded-full" />
            {sent ? (
              <View accessibilityRole="summary" className="items-center gap-3 py-6">
                <View className="size-12 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check size={24} color="#059669" />
                </View>
                <Text className="text-lg font-bold">Thank you for telling us</Text>
                <Text className="text-muted-foreground text-center">A moderator will look at it.</Text>
                <Pressable accessibilityRole="button" onPress={close} className="bg-primary mt-2 rounded-full px-6 py-2.5">
                  <Text className="text-primary-foreground font-semibold">Done</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
                <Text className="text-lg font-bold" accessibilityRole="header">
                  {REPORT_TITLE[entityType]}
                </Text>
                <Text className="text-muted-foreground text-sm">What is wrong with it? Moderators look at every report; the author is not told who sent it.</Text>
                <View accessibilityRole="radiogroup" className="gap-2">
                  {REASONS.map((r) => (
                    <Pressable key={r.reason} accessibilityRole="radio" accessibilityState={{ checked: reason === r.reason }} accessibilityLabel={r.label} onPress={() => setReason(r.reason)} className={`rounded-xl border p-3 ${reason === r.reason ? 'border-primary bg-primary/10' : 'border-border'}`}>
                      <Text className="font-semibold">{r.label}</Text>
                      <Text className="text-muted-foreground text-xs">{r.hint}</Text>
                    </Pressable>
                  ))}
                </View>
                {reason === 'SELF_HARM' ? <Text className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">If you or someone you know is in danger, please talk to someone you trust or a local helpline now.</Text> : null}
                <TextInput accessibilityLabel="Anything moderators should know (optional)" placeholder={entityType === 'NOTE' ? 'Where in the note, and why' : 'What is wrong, in a few words'} placeholderTextColor={muted} value={details} onChangeText={setDetails} maxLength={1000} multiline className="border-border text-foreground min-h-16 rounded-xl border px-3 py-2" />
                {error ? (
                  <Text accessibilityRole="alert" className="text-destructive text-sm">
                    {error}
                  </Text>
                ) : null}
                <View className="flex-row justify-end gap-2">
                  <Pressable accessibilityRole="button" onPress={close} className="rounded-full px-4 py-2.5">
                    <Text className="font-semibold">Cancel</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityState={{ disabled: !reason || reporting.loading }} disabled={!reason || reporting.loading} onPress={() => void send()} className={`rounded-full px-4 py-2.5 ${reason ? 'bg-primary' : 'bg-muted'}`}>
                    <Text className="text-primary-foreground font-semibold">Send report</Text>
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
