import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { mimeOf } from './NoteMedia'

export type MediaSource = 'library' | 'camera' | 'files'
export type Picked = { uri: string; name: string; mimeType: string; size: number | null }

/**
 * One file from the phone for a note: a picture or video from the photos, a photo from the camera, or a PDF,
 * Word or PowerPoint file, plain text, recording, video or picture from the files. Null when the person cancels or
 * refuses the permission.
 */
export async function pickMedia(source: MediaSource): Promise<Picked | 'denied' | null> {
  if (source === 'files') {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'image/*', 'video/*', 'audio/*'], copyToCacheDirectory: true, multiple: false })
    const a = res.canceled ? null : res.assets[0]
    return a ? { uri: a.uri, name: a.name, mimeType: mimeOf(a.name, a.mimeType), size: a.size ?? null } : null
  }
  if (source === 'camera') {
    const allowed = await ImagePicker.requestCameraPermissionsAsync()
    if (!allowed.granted) return 'denied'
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: source === 'camera' ? ['images'] : ['images', 'videos'], quality: 0.85 }
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  const a = res.canceled ? null : res.assets[0]
  if (!a) return null
  const name = a.fileName ?? a.uri.split('/').pop() ?? (a.type === 'video' ? 'video.mp4' : 'photo.jpg')
  return { uri: a.uri, name, mimeType: mimeOf(name, a.mimeType), size: a.fileSize ?? null }
}
