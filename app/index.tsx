import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { env } from '@/lib/env'
import { useColors } from '@/lib/theme'

/** Phase 0 start screen: what LearnViaNotes is today, and the way to the notes that already exist. */
export default function Welcome() {
  const c = useColors()
  const notesUrl = `${env.EXPO_PUBLIC_WEB_URL}/core`
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.body}>
        <Image source={require('../assets/icon.png')} style={styles.icon} accessibilityIgnoresInvertColors />
        <Text accessibilityRole="header" style={[styles.title, { color: c.fg }]}>LearnViaNotes</Text>
        <Text style={[styles.lead, { color: c.muted }]}>
          Clear notes for computer science. Your own notes, groups and classrooms are coming to this app soon.
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityHint="Opens the notes in your browser"
          onPress={() => void Linking.openURL(notesUrl)}
          style={({ pressed }) => [styles.button, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.buttonText, { color: c.accentFg }]}>Read the notes</Text>
        </Pressable>
      </View>
      {env.EXPO_PUBLIC_APP_ENV !== 'production' && (
        <Text testID="env-badge" style={[styles.badge, { color: c.muted, borderColor: c.border }]}>
          {env.EXPO_PUBLIC_APP_ENV}
        </Text>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  body: { flex: 1, justifyContent: 'center', gap: 16 },
  icon: { width: 72, height: 72, borderRadius: 18 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  lead: { fontSize: 17, lineHeight: 25 },
  button: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 22, borderRadius: 14, marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  badge: { alignSelf: 'center', marginBottom: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderRadius: 999, fontSize: 12, textTransform: 'uppercase' },
})
