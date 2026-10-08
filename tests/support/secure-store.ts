/** In-memory stand-in for expo-secure-store; `items` lets a test seed or inspect what the app stored. */
export const items = new Map<string, string>()

export const secureStore = {
  items,
  getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void items.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void items.delete(key)),
}
