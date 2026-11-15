import { Directory, File, Paths } from 'expo-file-system'
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator'

const CACHE = 'incoming-shares'

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, CACHE)
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

function safeName(name: string): string {
  const base = name.replace(/[^\w.\-]+/g, '_').replace(/^_+/, '').slice(-80)
  return base || 'file'
}

/** Copy a shared file into the app cache at once. Content-URI grants and extension copies do not last. */
export async function copyShareFile(sourceUri: string, name: string): Promise<string> {
  const dest = new File(cacheDir(), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(name)}`)
  await new File(sourceUri).copy(dest)
  return dest.uri
}

export function deleteShareFile(uri: string): void {
  if (!uri) return
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch {
    // The copy is already gone. Saving can continue with what is left.
  }
}

/** HEIC and HEIF become JPEG before upload. The server stores JPEG, not HEIC. */
export async function jpegFromHeic(uri: string, name: string): Promise<{ uri: string; name: string }> {
  const result = await manipulateAsync(uri, [], { compress: 0.9, format: SaveFormat.JPEG })
  return { uri: result.uri, name: name.replace(/\.(heic|heif)$/i, '') + '.jpg' }
}
