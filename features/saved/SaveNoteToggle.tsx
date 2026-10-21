import { useMutation, useQuery } from '@apollo/client/react'
import { Bookmark, BookmarkCheck } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { NoteSavedDocument, SaveNoteDocument, UnsaveNoteDocument } from '@/graphql/generated/graphql'
import { haptic } from '@/lib/haptics'

/** Save on a note (lvn-backend ADR-0076): to the person's Saved list, private to them. Online: hidden until known. */
/** `saved`: already known (a feed's card), so nothing more is asked. */
export function SaveNoteToggle({ noteId, saved: known }: { noteId: string; saved?: boolean }) {
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const primary = String(useCSSVariable('--color-primary') ?? '#2563eb')
  const { data } = useQuery(NoteSavedDocument, { variables: { id: noteId }, fetchPolicy: 'cache-and-network', skip: known !== undefined })
  const [save, saving] = useMutation(SaveNoteDocument)
  const [unsave, unsaving] = useMutation(UnsaveNoteDocument)
  const saved = known ?? data?.note?.viewerSaved
  if (saved === undefined) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Saved' : 'Save'}
      accessibilityState={{ selected: saved }}
      disabled={saving.loading || unsaving.loading}
      onPress={() => {
        haptic.tick()
        void (saved ? unsave : save)({ variables: { noteId } })
      }}
      className="rounded-full p-2"
    >
      {saved ? <BookmarkCheck size={21} color={primary} /> : <Bookmark size={21} color={fg} />}
    </Pressable>
  )
}
