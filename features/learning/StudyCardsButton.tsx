import { useMutation, useQuery } from '@apollo/client/react'
import { GraduationCap } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { NoteStudyingDocument, StopStudyingNoteCardsDocument, StudyNoteCardsDocument } from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'

/**
 * "Study these cards" in a read note's header (lvn-backend ADR-0068): its flashcards join the reader's reviews, or
 * leave them. Filled when studying. Nothing offline (the server decides who may study a note).
 */
export function StudyCardsButton({ noteId }: { noteId: string }) {
  const primary = String(useCSSVariable('--color-primary') ?? '#2563eb')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const { data } = useQuery(NoteStudyingDocument, { variables: { id: noteId } })
  const refresh = { refetchQueries: [{ query: NoteStudyingDocument, variables: { id: noteId } }], awaitRefetchQueries: true }
  const [study] = useMutation(StudyNoteCardsDocument, refresh)
  const [stop] = useMutation(StopStudyingNoteCardsDocument, refresh)
  const studying = data?.note?.viewerStudying
  if (studying === undefined || studying === null) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={studying ? 'Stop studying these cards' : 'Study these cards'}
      accessibilityState={{ selected: studying }}
      onPress={() => {
        haptic.tick()
        void (studying ? stop : study)({ variables: { input: { noteId } } })
      }}
      className="rounded-full p-2"
    >
      <GraduationCap size={21} color={studying ? primary : muted} />
    </Pressable>
  )
}
