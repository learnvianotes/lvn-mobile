import * as DocumentPicker from 'expo-document-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { QuickNoteLimits } from '@/lib/contracts/domain/enums'
import { mimeOf } from '../media/NoteMedia'
import { fitWithin, type TrayItem } from './tray'

let next = 0
const key = () => `t${Date.now()}-${next++}`

/** How much a picture is compressed: small enough to upload quickly, sharp enough to read handwriting. */
const QUALITY = 0.7

/**
 * A picture made smaller before it is uploaded (lvn-backend ADR-0084): at most QuickNoteLimits.pictureSide on the longer
 * side, as JPEG. HEIC and PNG photos become JPEG too, which the API takes.
 */
export async function preparePicture(uri: string, name: string, width = 0, height = 0): Promise<TrayItem> {
  let w = width
  let h = height
  if (!w || !h) {
    const probe = await ImageManipulator.manipulate(uri).renderAsync()
    w = probe.width
    h = probe.height
  }
  const context = ImageManipulator.manipulate(uri)
  const fit = fitWithin(w, h, QuickNoteLimits.pictureSide)
  if (fit) context.resize(fit)
  const saved = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: QUALITY })
  const size = (await (await fetch(saved.uri)).blob()).size
  return { key: key(), uri: saved.uri, name: `${name.replace(/\.[a-z0-9]{1,5}$/i, '') || 'photo'}.jpg`, mimeType: 'image/jpeg', size, kind: 'image' }
}

export type Source = 'camera' | 'library' | 'files'

/**
 * Photos and PDFs for the tray: one photo from the camera, up to `room` from the photo library at once, or pictures and
 * PDFs from the files. Pictures are prepared (made smaller) here. 'denied' when the camera is refused, [] on cancel.
 */
export async function pickForTray(source: Source, room: number): Promise<TrayItem[] | 'denied'> {
  if (source === 'files') {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: true })
    if (res.canceled) return []
    const out: TrayItem[] = []
    for (const a of res.assets) {
      const mimeType = mimeOf(a.name, a.mimeType)
      if (mimeType === 'application/pdf') out.push({ key: key(), uri: a.uri, name: a.name, mimeType, size: a.size ?? 0, kind: 'pdf' })
      else if (mimeType.startsWith('image/') || a.mimeType?.startsWith('image/')) out.push(await preparePicture(a.uri, a.name))
    }
    return out
  }
  if (source === 'camera') {
    const allowed = await ImagePicker.requestCameraPermissionsAsync()
    if (!allowed.granted) return 'denied'
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, ...(source === 'library' ? { allowsMultipleSelection: true, selectionLimit: Math.max(1, room) } : {}) }
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  if (res.canceled) return []
  const out: TrayItem[] = []
  for (const a of res.assets) out.push(await preparePicture(a.uri, a.fileName ?? 'photo.jpg', a.width, a.height))
  return out
}
