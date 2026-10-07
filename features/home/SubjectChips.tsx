import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { PressScale } from '@/features/shell/PressScale'
import { cn } from '@/lib/utils'
import { subjects } from './mock'

/** Pill filter chips from the UI board; selection gives a haptic tick. */
export function SubjectChips() {
  const [selected, setSelected] = useState(subjects[0])
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
      {subjects.map((s) => {
        const on = s === selected
        return (
          <PressScale key={s} onPress={() => setSelected(s)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <View className={cn('h-9 justify-center rounded-full border px-4', on ? 'bg-primary border-primary' : 'bg-card border-border')}>
              <Text className={cn('text-sm font-medium', on ? 'text-primary-foreground' : 'text-foreground')}>{s}</Text>
            </View>
          </PressScale>
        )
      })}
    </ScrollView>
  )
}
