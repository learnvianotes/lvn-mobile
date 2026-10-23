import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_400Regular_Italic } from '@expo-google-fonts/inter/400Regular_Italic'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold'
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular'
import { JetBrainsMono_400Regular_Italic } from '@expo-google-fonts/jetbrains-mono/400Regular_Italic'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium'
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold'
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold'
import { MONO, SANS } from './fonts'

const FACES = {
  [SANS[400]]: Inter_400Regular,
  [SANS[500]]: Inter_500Medium,
  [SANS[600]]: Inter_600SemiBold,
  [SANS[700]]: Inter_700Bold,
  [SANS[800]]: Inter_800ExtraBold,
  [SANS.italic]: Inter_400Regular_Italic,
  [MONO[400]]: JetBrainsMono_400Regular,
  [MONO[500]]: JetBrainsMono_500Medium,
  [MONO[600]]: JetBrainsMono_600SemiBold,
  [MONO[700]]: JetBrainsMono_700Bold,
  [MONO.italic]: JetBrainsMono_400Regular_Italic,
}

let open = false
const listeners = new Set<() => void>()

export function fontGateOpen(): boolean {
  return open
}

export function subscribeFontGate(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function openGate(): void {
  if (open) return
  open = true
  listeners.forEach((listener) => listener())
}

/** Loads Inter and JetBrains Mono. Resolves true when they are ready, or when loading failed and the system font remains. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts(FACES)
  const ready = loaded || error != null
  useEffect(() => {
    if (ready) openGate()
  }, [ready])
  return ready
}
