import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, useAnimatedValue, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { firstLine, STUDY_LINES, type WaitKind } from '@/lib/study-lines'

const LABEL: Record<WaitKind, string> = {
  upload: 'Uploading your file',
  record: 'Saving your recording',
  pdf: 'Opening your PDF',
  scan: 'Checking your PDF for viruses',
  search: 'Searching your notes',
  nova: 'Nova is reading your notes',
  general: 'One moment',
}
const LINE_MS = 5_000
const TRACK = 200

/**
 * What shows while something takes a moment (lvn-backend ADR-0114): what is happening, a highlighter bar (the real share
 * when known, a calm sweep otherwise) and one short study line that changes every few seconds. Screen readers hear the
 * status once; the rotating line is hidden from them. With reduce motion on, the bar rests and lines change without a fade.
 */
export function StudyLoader({ kind = 'general', label, detail, progress, compact = false, className }: { kind?: WaitKind; label?: string; detail?: string | null; progress?: number | null; compact?: boolean; className?: string }) {
  const [line, setLine] = useState(() => firstLine(kind))
  const [reduced, setReduced] = useState(false)
  const sweep = useAnimatedValue(0)
  const fade = useAnimatedValue(1)

  useEffect(() => {
    let live = true
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => live && setReduced(on)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (reduced || progress != null) return
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1200, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [reduced, progress, sweep])

  useEffect(() => {
    if (compact) return
    const timer = setInterval(() => {
      if (reduced) return setLine((n) => (n + 1) % STUDY_LINES.length)
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setLine((n) => (n + 1) % STUDY_LINES.length)
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start()
      })
    }, LINE_MS)
    return () => clearInterval(timer)
  }, [compact, reduced, fade])

  const share = progress == null ? null : Math.max(0, Math.min(1, progress))
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-TRACK * 0.4, TRACK] })

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label ?? LABEL[kind]} accessibilityValue={share == null ? undefined : { min: 0, max: 100, now: Math.round(share * 100) }} className={cn('gap-3', compact ? 'items-start' : 'items-center', className)}>
      <Text className={cn('text-base font-medium', compact ? '' : 'text-center')}>{label ?? LABEL[kind]}</Text>
      {detail ? <Text className="text-muted-foreground -mt-2 text-center text-sm">{detail}</Text> : null}
      <View className="bg-muted h-1 overflow-hidden rounded-full" style={{ width: TRACK }}>
        {share == null ? (
          <Animated.View className="bg-spark h-full rounded-full" style={{ width: TRACK * 0.4, transform: [{ translateX: reduced ? 0 : translateX }] }} />
        ) : (
          <View className="bg-spark h-full rounded-full" style={{ width: TRACK * share }} />
        )}
      </View>
      {compact ? null : (
        <Animated.View style={{ opacity: fade, minHeight: 40, maxWidth: 320 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text className="text-muted-foreground text-center text-sm">{STUDY_LINES[line]}</Text>
        </Animated.View>
      )}
    </View>
  )
}
