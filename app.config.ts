import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * One app, three side-by-side installs (spec §13.1, §16.1). APP_VARIANT comes from env/<variant>.env via
 * scripts/with-variant.mjs and scripts/build-android.mjs (local builds, no EAS — ADR-0008); nothing
 * environment-specific is hardcoded in app code.
 */
type Variant = 'development' | 'sandbox' | 'production'

/**
 * Each variant has its own URL scheme as well as its own id: with one shared scheme, a sign-in redirect
 * (`<scheme>://oauth/callback`) could open whichever of the three installs Android picks.
 */
const VARIANTS: Record<Variant, { name: string; id: string; scheme: string }> = {
  development: { name: 'LearnViaNotes Dev', id: 'com.learnvianotes.dev', scheme: 'learnvianotes-dev' },
  sandbox: { name: 'LearnViaNotes Sandbox', id: 'com.learnvianotes.sandbox', scheme: 'learnvianotes-sandbox' },
  production: { name: 'LearnViaNotes', id: 'com.learnvianotes', scheme: 'learnvianotes' },
}

function variant(): Variant {
  const v = process.env.APP_VARIANT ?? 'development'
  if (!(v in VARIANTS)) throw new Error(`APP_VARIANT must be one of ${Object.keys(VARIANTS).join(', ')}; got "${v}"`)
  return v as Variant
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const current = variant()
  const { name, id, scheme } = VARIANTS[current]
  return {
    ...config,
    name,
    slug: 'learnvianotes',
    version: '0.1.0',
    scheme,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: id,
      supportsTablet: true,
      // Universal links (§9.3) need the Associated Domains capability, which a free Apple account cannot sign.
      // Added with the paid Apple Developer membership (ADR-0008); the app scheme works meanwhile.
    },
    android: {
      package: id,
      // Icons and splash are rendered from assets/brand/logo-paths.json by scripts/brand-assets.mjs.
      adaptiveIcon: {
        backgroundColor: '#4F46E5',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-web-browser',
      // Native Google Sign-In: Android needs no plugin (the Android OAuth client is matched by package and signing key);
      // iOS needs the reversed iOS client id as a URL scheme.
      ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
        ? [['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.replace('.apps.googleusercontent.com', '')}` }] as [string, object]]
        : []),
      // Development builds talk to the API on the dev machine over plain HTTP (env/development.env); Android blocks
      // that unless allowed. Sandbox and production use HTTPS only.
      ['expo-build-properties', { android: { usesCleartextTraffic: current === 'development' } }],
      [
        'expo-splash-screen',
        {
          // The logo tile on the theme background; small enough to sit inside Android 12+'s circular splash mask.
          image: './assets/splash-icon.png',
          imageWidth: 136,
          resizeMode: 'contain',
          backgroundColor: '#F7F7FB',
          dark: { image: './assets/splash-icon.png', backgroundColor: '#0E0E12' },
        },
      ],
    ],
    experiments: { typedRoutes: true },
  }
}
