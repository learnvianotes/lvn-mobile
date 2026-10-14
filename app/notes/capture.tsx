import { useLocalSearchParams } from 'expo-router'
import { CaptureScreen } from '@/features/notes/capture/CaptureScreen'
import type { Source } from '@/features/notes/capture/prepare'

export default function NotesCaptureScreen() {
  const { start } = useLocalSearchParams<{ start?: Source }>()
  return <CaptureScreen start={start === 'camera' || start === 'library' || start === 'files' ? start : undefined} />
}
