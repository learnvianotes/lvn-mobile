import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * One app, three side-by-side installs (spec §13.1, §16.1). APP_VARIANT is set per EAS build profile
 * (eas.json) or in .env.local for local runs; nothing environment-specific is hardcoded in app code.
 */
type Variant = 'development' | 'sandbox' | 'production'

const VARIANTS: Record<Variant, { name: string; id: string }> = {
  development: { name: 'LearnViaNotes Dev', id: 'com.learnvianotes.dev' },
  sandbox: { name: 'LearnViaNotes Sandbox', id: 'com.learnvianotes.sandbox' },
  production: { name: 'LearnViaNotes', id: 'com.learnvianotes' },
}

function variant(): Variant {
  const v = process.env.APP_VARIANT ?? 'development'
  if (!(v in VARIANTS)) throw new Error(`APP_VARIANT must be one of ${Object.keys(VARIANTS).join(', ')}; got "${v}"`)
  return v as Variant
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const { name, id } = VARIANTS[variant()]
  return {
    ...config,
    name,
    slug: 'learnvianotes',
    version: '0.1.0',
    scheme: 'learnvianotes',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    // §13.3: OTA updates for JS-only changes; native changes need a store build.
    runtimeVersion: { policy: 'appVersion' },
    ios: {
      bundleIdentifier: id,
      supportsTablet: true,
      // Universal links to https://learnvianotes.com/... (§9.3); the apple-app-site-association file ships with lvn-web.
      associatedDomains: ['applinks:learnvianotes.com'],
    },
    android: {
      package: id,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: ['expo-router'],
    experiments: { typedRoutes: true },
  }
}
