import { PortalHost } from '@rn-primitives/portal'
import { render } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const metrics = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }

/** The providers app/_layout.tsx gives every screen: safe-area metrics of a Pixel 7 and the portal host for sheets. */
function App({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      {children}
      <PortalHost />
    </SafeAreaProvider>
  )
}

/** Renders inside the app's providers; `rerender` keeps them. */
export function renderInApp(ui: ReactElement) {
  return render(ui, { wrapper: App })
}
