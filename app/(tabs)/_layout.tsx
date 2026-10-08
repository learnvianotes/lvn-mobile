import { router, Tabs } from 'expo-router'
import { useEffect } from 'react'
import { TabBar } from '@/features/shell/TabBar'
import { takePendingRoute } from '@/lib/auth/session'

export default function TabsLayout() {
  // A sign-up with a college email continues to its code once the signed-in screens exist.
  useEffect(() => {
    const next = takePendingRoute()
    if (next === '/verify') router.push('/verify')
  }, [])
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
