import { useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, GraduationCap } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import { attempt } from '@/features/groups/shared'
import { ClassroomByCodeDocument, RequestToJoinClassroomDocument, WithdrawClassroomJoinRequestDocument } from '@/graphql/generated/graphql'
import { cleanCode } from './shared'

/**
 * A class by its code (lvn-backend ADR-0046): its name and teacher only, and a request to join. The code admits nobody;
 * the teacher or a TA answers. Opened from the Community tab (a typed code) or a join link.
 */
export function JoinClassScreen({ code: raw, via }: { code: string; via: 'CODE' | 'LINK' }) {
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const accent = String(useCSSVariable('--color-primary') ?? '#4f46e5')
  const code = cleanCode(raw)
  const { data, loading, error: lookup, refetch } = useQuery(ClassroomByCodeDocument, { variables: { code }, fetchPolicy: 'network-only' })
  const [request] = useMutation(RequestToJoinClassroomDocument)
  const [withdraw] = useMutation(WithdrawClassroomJoinRequestDocument)
  const [error, setError] = useState<string | null>(null)
  const found = data?.classroomByCode
  const run = async (fn: () => Promise<{ data?: unknown }>) => {
    setError(await attempt(fn))
    await refetch()
  }
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-3 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <Text className="text-lg font-bold" accessibilityRole="header">
          Join a class
        </Text>
      </View>
      <View className="gap-4 p-4">
        {loading && !data ? null : lookup ? (
          <Text accessibilityRole="alert" className="text-destructive">
            {(lookup as { errors?: { message: string }[] }).errors?.[0]?.message ?? 'That did not work. Try again.'}
          </Text>
        ) : !found ? (
          <Text className="text-muted-foreground py-10 text-center">No class has that code. Check it with your teacher.</Text>
        ) : (
          <View className="bg-card border-border gap-3 rounded-3xl border p-5">
            <View className="flex-row items-center gap-2">
              <GraduationCap size={16} color={accent} />
              <Text className="text-muted-foreground font-mono tracking-widest">{code}</Text>
            </View>
            <Text className="text-2xl font-extrabold">{found.name}</Text>
            <Text className="text-muted-foreground">Teacher: {found.teacher.displayName}</Text>
            {found.viewerRole ? (
              <Pressable accessibilityRole="button" onPress={() => router.replace(`/classes/${found.id}`)} className="bg-primary self-start rounded-full px-4 py-2.5">
                <Text className="text-primary-foreground font-semibold">Open the class</Text>
              </Pressable>
            ) : found.viewerRequestId ? (
              <>
                <Text className="text-muted-foreground">Your request is waiting for your teacher.</Text>
                <Pressable accessibilityRole="button" onPress={() => void run(() => withdraw({ variables: { requestId: found.viewerRequestId! } }))} className="border-border self-start rounded-full border px-4 py-2.5">
                  <Text className="font-semibold">Withdraw</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable accessibilityRole="button" onPress={() => void run(() => request({ variables: { code, via } }))} className="bg-primary self-start rounded-full px-4 py-2.5">
                  <Text className="text-primary-foreground font-semibold">Ask to join</Text>
                </Pressable>
                <Text className="text-muted-foreground text-xs">Your teacher or a TA lets you in.</Text>
              </>
            )}
            {error ? (
              <Text accessibilityRole="alert" className="text-destructive text-sm">
                {error}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  )
}
