import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names, letting later Tailwind classes win (shadcn / react-native-reusables convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
