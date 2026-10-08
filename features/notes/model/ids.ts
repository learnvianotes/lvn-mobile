import { getRandomBytes } from 'expo-crypto'

/** A UUIDv7 (lvn-backend §4.6): notes and cards made on the phone keep the id they were given offline. */
export function newId(now: number = Date.now()): string {
  const b = getRandomBytes(16)
  let ms = now
  for (let i = 5; i >= 0; i--) {
    b[i] = ms % 256
    ms = Math.floor(ms / 256)
  }
  b[6] = 0x70 | (b[6]! & 0x0f)
  b[8] = 0x80 | (b[8]! & 0x3f)
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
