import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular'
import { IBMPlexSans_400Regular_Italic } from '@expo-google-fonts/ibm-plex-sans/400Regular_Italic'
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium'
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold'
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular'
import { JetBrainsMono_400Regular_Italic } from '@expo-google-fonts/jetbrains-mono/400Regular_Italic'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium'
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold'
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold'
import { MONO, SANS } from './fonts'

const FACES = {
  [SANS[400]]: IBMPlexSans_400Regular,
  [SANS[500]]: IBMPlexSans_500Medium,
  [SANS[600]]: IBMPlexSans_600SemiBold,
  [SANS.italic]: IBMPlexSans_400Regular_Italic,
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

/** Loads IBM Plex Sans and JetBrains Mono. Resolves true when they are ready, or when loading failed and the system font remains. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts(FACES)
  const ready = loaded || error != null
  useEffect(() => {
    if (ready) openGate()
  }, [ready])
  return ready
}
