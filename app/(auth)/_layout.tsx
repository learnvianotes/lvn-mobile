import { Stack } from 'expo-router'

export const unstable_settings = { anchor: 'welcome' }

/** Screens for someone signed out (app/_layout.tsx shows this group only then). */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
