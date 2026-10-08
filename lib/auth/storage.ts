import * as SecureStore from 'expo-secure-store'

/**
 * The session tokens, kept only in expo-secure-store (Keychain / Android Keystore) — never AsyncStorage or MMKV
 * (§7.1). Separate keys keep each value well under the store's per-item size limit.
 */
const KEYS = { access: 'lvn.accessToken', expires: 'lvn.accessTokenExpiresAt', refresh: 'lvn.refreshToken' } as const

export interface StoredTokens {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, accessTokenExpiresAt, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access),
    SecureStore.getItemAsync(KEYS.expires),
    SecureStore.getItemAsync(KEYS.refresh),
  ])
  if (!refreshToken) return null
  return { accessToken: accessToken ?? '', accessTokenExpiresAt: accessTokenExpiresAt ?? new Date(0).toISOString(), refreshToken }
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  // The refresh token is written first: it is the one that must survive the app being killed half-way.
  await SecureStore.setItemAsync(KEYS.refresh, tokens.refreshToken)
  await Promise.all([SecureStore.setItemAsync(KEYS.access, tokens.accessToken), SecureStore.setItemAsync(KEYS.expires, tokens.accessTokenExpiresAt)])
}

export async function clearTokens(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)))
}
