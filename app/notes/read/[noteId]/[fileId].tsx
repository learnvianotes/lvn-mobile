import { useLocalSearchParams } from 'expo-router'
import { PdfReaderScreen } from '@/features/reader/PdfReaderScreen'

/** A PDF of a note in the reader (lvn-backend ADR-0040); ?page and ?card come from a card's page chip. */
export default function Reader() {
  const { noteId, fileId, page, card } = useLocalSearchParams<{ noteId: string; fileId: string; page?: string; card?: string }>()
  return <PdfReaderScreen noteId={noteId} fileId={fileId} page={page ? Number(page) || undefined : undefined} card={card} />
}
