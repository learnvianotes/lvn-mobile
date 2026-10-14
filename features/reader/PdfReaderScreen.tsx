import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { router } from 'expo-router'
import { ArrowLeft, ChevronDown, ChevronUp, NotebookPen, Search, Trash2, Wand2, X, ZoomIn, ZoomOut } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import {
  PhoneAddHighlightDocument,
  PhoneConvertPdfDocument,
  PhoneNoteFileDocument,
  PhoneNoteHighlightsDocument,
  PhonePdfConversionDocument,
  PhoneRemoveHighlightDocument,
  PhoneStudyPdfDocument,
  PhoneUpdateHighlightDocument,
  RemoteNoteDocument,
  type HighlightColor,
  type PhoneHighlightFieldsFragment,
} from '@/graphql/generated/graphql'
import type { CardType } from '@/lib/contracts/domain/enums'
import { cardAnchor, type CardAnchor } from '@/lib/contracts/validation'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'
import { useLocal } from '@/features/notes/hooks'
import { CardView } from '@/features/notes/render/CardView'
import * as actions from '@/features/notes/store/actions'
import * as db from '@/features/notes/store/db'
import { syncNow, syncSoon } from '@/features/notes/sync/engine'
import type { PageRect } from './geometry'
import { PDFJS_VERSION, readerPath } from './paths'
import PdfDom, { type DomCommand, type DomMark, type DomSelection } from './PdfDom'


const COLORS: { color: HighlightColor; swatch: string; label: string }[] = [
  { color: 'YELLOW', swatch: 'bg-yellow-300', label: 'yellow' },
  { color: 'GREEN', swatch: 'bg-green-400', label: 'green' },
  { color: 'BLUE', swatch: 'bg-blue-400', label: 'blue' },
  { color: 'PINK', swatch: 'bg-pink-400', label: 'pink' },
  { color: 'PURPLE', swatch: 'bg-violet-400', label: 'purple' },
]

const pageKey = (fileId: string) => `reader.page.${fileId}`
/** The pages the vision model read again (lvn-backend ADR-0063), as a sentence for the conversion's banner. */
const aiRead = (pages: number | null | undefined, rejected: number | null | undefined) =>
  pages ? ` AI read ${pages} unclear page${pages === 1 ? '' : 's'} again${rejected ? `; ${rejected} reading${rejected === 1 ? '' : 's'} disagreed with the scan and ${rejected === 1 ? 'was' : 'were'} set aside` : ''}.` : ''

type Card = { id: string; type: CardType; content: unknown }
/** A command for the PDF before it is numbered */
type NewCommand = { [K in DomCommand['kind']]: Omit<Extract<DomCommand, { kind: K }>, 'n'> }[DomCommand['kind']]

/**
 * The PDF reader on the phone (lvn-backend ADR-0040): the PDF fills the screen and the note is a sheet over it. Long
 * press selects words: owners and editors highlight them in a colour or add them to the note as a quote with their
 * page (saved on the phone and synced like any card); a card's page chip brings the PDF back to the passage. Readers
 * read with the published cards and can start notes of their own. The PDF and highlights need a connection.
 */
export function PdfReaderScreen({ noteId, fileId, page: startPage, card: startCard }: { noteId: string; fileId: string; page?: number; card?: string }) {
  const client = useApolloClient()
  const insets = useSafeAreaInsets()
  const fg = String(useCSSVariable('--color-foreground') ?? '#111827')
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#6b7280')
  const background = String(useCSSVariable('--color-secondary') ?? '#f1f1f7')

  const note = useLocal(() => db.getNote(noteId), [noteId])
  const localCards = useLocal(() => db.getCards(noteId), [noteId])
  const remote = useQuery(RemoteNoteDocument, { variables: { id: noteId }, skip: note !== null, fetchPolicy: 'network-only' })
  const file = useQuery(PhoneNoteFileDocument, { variables: { noteId, fileId }, fetchPolicy: 'network-only' })
  const editable = !!note && note.access !== 'READER' && !note.deletedAt
  const highlightsQuery = useQuery(PhoneNoteHighlightsDocument, { variables: { id: noteId, fileId }, skip: !editable, fetchPolicy: 'network-only' })
  const [highlights, setHighlights] = useState<PhoneHighlightFieldsFragment[]>([])
  useEffect(() => setHighlights(highlightsQuery.data?.note?.highlights ?? []), [highlightsQuery.data])

  const cards: Card[] = useMemo(
    () => (note ? (localCards ?? []) : (remote.data?.note?.cards.edges.map((e) => ({ id: e.node.id, type: e.node.type, content: e.node.content as unknown })) ?? [])),
    [note, localCards, remote.data],
  )
  const title = note ? note.title : (remote.data?.note?.title ?? '')
  const anchored = useMemo(() => cards.flatMap((c) => ((a) => (a?.fileId === fileId ? [{ cardId: c.id, anchor: a }] : []))(cardAnchor(c.content))), [cards, fileId])
  const marks = useMemo<DomMark[]>(
    () => [
      ...highlights.map((h) => ({ id: `h:${h.id}`, page: h.page, rects: h.rects as PageRect[], kind: 'highlight' as const, color: h.color })),
      ...anchored.filter((a) => a.anchor.rects?.length).map((a) => ({ id: `c:${a.cardId}`, page: a.anchor.page, rects: a.anchor.rects as PageRect[], kind: 'anchor' as const })),
    ],
    [highlights, anchored],
  )

  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'password'>('loading')
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [command, setCommand] = useState<DomCommand | null>(null)
  const counter = useRef(0)
  const send = useCallback((c: NewCommand) => setCommand({ ...c, n: ++counter.current } as DomCommand), [])
  const [selection, setSelection] = useState<DomSelection | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [finding, setFinding] = useState(false)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ current: number; total: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const lastPage = useRef(1)
  const target = useRef<{ page: number; card?: string } | null>(startPage ? { page: startPage, card: startCard } : null)

  const [addHighlight] = useMutation(PhoneAddHighlightDocument)
  const [updateHighlight] = useMutation(PhoneUpdateHighlightDocument)
  const [removeHighlight] = useMutation(PhoneRemoveHighlightDocument)
  const [study, studying] = useMutation(PhoneStudyPdfDocument)
  const [convert, converting] = useMutation(PhoneConvertPdfDocument)
  const conversionQuery = useQuery(PhonePdfConversionDocument, { variables: { id: noteId }, fetchPolicy: 'network-only' })
  const conversion = conversionQuery.data?.note?.pdfConversion ?? null
  const working = !!conversion && ['QUEUED', 'TRIAGE', 'PARSING', 'MAPPING'].includes(conversion.status)
  const [conversionSeen, setConversionSeen] = useState(false)
  // While the engine works, look again every three seconds; when it is done, the cards come with a sync.
  const wasWorking = useRef(false)
  const { startPolling, stopPolling } = conversionQuery
  useEffect(() => {
    if (!working) {
      stopPolling()
      if (wasWorking.current) {
        wasWorking.current = false
        void syncNow(client).catch(() => undefined)
      }
      return
    }
    wasWorking.current = true
    startPolling(3000)
    return () => stopPolling()
  }, [working, startPolling, stopPolling, client])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  // The last page read is kept on the phone.
  useEffect(
    () => () => {
      void db.setValue(pageKey(fileId), String(lastPage.current))
    },
    [fileId],
  )

  const onReady = async (n: number) => {
    setPages(n)
    setState('ready')
    const t = target.current
    target.current = null
    const card = t?.card ? anchored.find((a) => a.cardId === t.card) : undefined
    if (card) send({ kind: 'goTo', page: card.anchor.page, rects: card.anchor.rects as PageRect[] | undefined })
    else if (t) send({ kind: 'goTo', page: t.page })
    else {
      const saved = Number(await db.getValue(pageKey(fileId)))
      if (saved > 1) send({ kind: 'goTo', page: saved })
    }
  }

  const goToAnchor = (anchor: CardAnchor) => {
    setSheet(false)
    if (anchor.fileId !== fileId) return router.push(readerPath(noteId, anchor.fileId, { page: anchor.page }))
    send({ kind: 'goTo', page: anchor.page, rects: anchor.rects as PageRect[] | undefined })
  }

  const clearSelection = () => {
    setSelection(null)
    send({ kind: 'clearSelection' })
  }

  const highlight = async (color: HighlightColor) => {
    if (!selection) return
    const s = selection
    clearSelection()
    const res = await addHighlight({ variables: { input: { noteId, fileId, page: s.page, kind: 'TEXT', rects: s.rects, quote: s.quote, color } } }).catch(() => null)
    const made = res?.data?.addPdfHighlight.highlight
    if (made) setHighlights((list) => [...list, made])
    else setNotice(res?.data?.addPdfHighlight.userErrors[0]?.message ?? 'That did not save. Check your connection.')
  }

  const addToNotes = async (s: { page: number; rects: PageRect[]; quote: string }, highlightId?: string) => {
    const card = await actions.appendCard(noteId, 'quote', { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s.quote }] }] }, anchor: { fileId, page: s.page, rects: s.rects, quote: s.quote } })
    syncSoon(client)
    setNotice('Added to your notes')
    if (highlightId) {
      // The highlight points at its card once the card is on the server.
      void syncNow(client).then(() => updateHighlight({ variables: { input: { highlightId, cardId: card.id } } }).then((r) => r.data?.updatePdfHighlight.highlight && setHighlights((list) => list.map((h) => (h.id === highlightId ? r.data!.updatePdfHighlight.highlight! : h)))).catch(() => undefined))
    }
  }

  const activeHighlight = active ? highlights.find((h) => h.id === active) : undefined
  useEffect(() => setComment(activeHighlight?.comment ?? ''), [activeHighlight?.id, activeHighlight?.comment])

  const change = async (id: string, input: { color?: HighlightColor; comment?: string }) => {
    const res = await updateHighlight({ variables: { input: { highlightId: id, ...input } } }).catch(() => null)
    const changed = res?.data?.updatePdfHighlight.highlight
    if (changed) setHighlights((list) => list.map((h) => (h.id === id ? changed : h)))
    else setNotice('That did not save. Check your connection.')
  }

  const startConvert = async () => {
    const res = await convert({ variables: { noteId, fileId } }).catch(() => null)
    const id = res?.data?.convertPdfToNote.conversion?.note?.id
    if (!id) return setNotice(res?.data?.convertPdfToNote.userErrors[0]?.message ?? 'The owner does not allow copies of this note.')
    await syncNow(client).catch(() => undefined)
    router.replace(readerPath(id, fileId))
  }

  const startStudy = async () => {
    const res = await study({ variables: { noteId, fileId } }).catch(() => null)
    const id = res?.data?.studyPdf.note?.id
    if (!id) return setNotice(res?.data?.studyPdf.userErrors[0]?.message ?? 'The owner does not allow copies of this note.')
    await syncNow(client).catch(() => undefined)
    router.replace(readerPath(id, fileId))
  }

  const url = file.data?.noteFile?.url
  const fileName = file.data?.noteFile?.fileName ?? ''
  const assets = env.EXPO_PUBLIC_WEB_URL ? `${env.EXPO_PUBLIC_WEB_URL.replace(/\/$/, '')}/pdfjs/${PDFJS_VERSION}/` : null

  return (
    <View className="bg-background flex-1">
      <View className="bg-background border-border flex-row items-center gap-1 border-b px-2 pb-2" style={{ paddingTop: insets.top + 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/notes/${noteId}`))} className="rounded-full p-2">
          <ArrowLeft size={22} color={fg} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-semibold" numberOfLines={1}>
            {title || 'Untitled note'}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {pages ? `Page ${page} of ${pages}` : fileName}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Find in the PDF" onPress={() => setFinding((f) => !f)} className={cn('rounded-full p-2', finding && 'bg-secondary')}>
          <Search size={20} color={fg} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => send({ kind: 'zoom', to: 'out' })} className="rounded-full p-2">
          <ZoomOut size={20} color={fg} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => send({ kind: 'zoom', to: 'in' })} className="rounded-full p-2">
          <ZoomIn size={20} color={fg} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Show notes" onPress={() => setSheet(true)} className="bg-primary flex-row items-center gap-1.5 rounded-full px-3 py-2">
          <NotebookPen size={16} color="#ffffff" />
          <Text className="text-primary-foreground text-sm font-semibold">Notes</Text>
        </Pressable>
      </View>
      {conversion && !conversionSeen ? (
        <View className={cn('border-border flex-row items-center gap-2 border-b px-3 py-2', working ? 'bg-primary/10' : 'bg-card')} accessibilityLiveRegion="polite">
          {working ? <ActivityIndicator size="small" /> : null}
          <Text className="flex-1 text-sm">
            {working
              ? `${{ QUEUED: 'Waiting to start…', TRIAGE: 'Counting the pages…', PARSING: 'Reading the PDF…', MAPPING: 'Making your cards…' }[conversion.status as 'QUEUED'] ?? 'Converting…'} ${conversion.progress}%`
              : conversion.status === 'DONE'
                ? `Made ${conversion.cards ?? 0} cards from ${conversion.pages ?? 0} pages. Check them beside the PDF.${aiRead(conversion.aiPages, conversion.aiRejected)}${conversion.scannedPages ? ' To mend words the conversion broke, use Clean up the text in AI tasks.' : ''}`
                : (conversion.error ?? 'The conversion failed.')}
          </Text>
          {!working ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => setConversionSeen(true)} className="rounded-full p-1">
              <X size={16} color={fg} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {finding ? (
        <View className="border-border flex-row items-center gap-1 border-b px-3 py-1.5">
          <TextInput
            accessibilityLabel="Find in the PDF"
            placeholder="Find words in the PDF"
            placeholderTextColor={muted}
            value={query}
            autoFocus
            returnKeyType="search"
            onChangeText={(q) => {
              setQuery(q)
              send({ kind: 'find', query: q })
            }}
            onSubmitEditing={() => send({ kind: 'find', query, previous: false })}
            className="text-foreground flex-1 py-1.5 text-base"
          />
          <Text className="text-muted-foreground text-xs">{query.trim() && found ? (found.total ? `${found.current} of ${found.total}` : 'Not found') : ''}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous match" onPress={() => send({ kind: 'find', query, previous: true })} className="rounded-full p-2">
            <ChevronUp size={18} color={fg} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next match" onPress={() => send({ kind: 'find', query, previous: false })} className="rounded-full p-2">
            <ChevronDown size={18} color={fg} />
          </Pressable>
        </View>
      ) : null}

      <View className="flex-1">
        {url ? (
          <PdfDom
            url={url}
            refreshUrl={async () => (await file.refetch().catch(() => null))?.data?.noteFile?.url ?? null}
            assets={assets}
            marks={marks}
            command={command}
            initialPage={startPage ?? 1}
            background={background}
            onReady={onReady}
            onPage={async (p) => {
              setPage(p)
              lastPage.current = p
            }}
            onSelection={async (s) => {
              setSelection(s)
              if (s) setActive(null)
            }}
            onMark={async (id) => {
              if (id.startsWith('h:')) setActive(id.slice(2))
              else setSheet(true)
            }}
            onFind={async (r) => setFound(r)}
            onError={async (kind) => setState(kind === 'password' ? 'password' : 'failed')}
            dom={{ style: { flex: 1 }, scrollEnabled: false, matchContents: false }}
          />
        ) : null}
        {state !== 'ready' || !url ? (
          <View className="absolute inset-0 items-center justify-center gap-2 p-6" pointerEvents="none">
            {file.loading || (url && state === 'loading') ? <ActivityIndicator /> : null}
            <Text className="text-muted-foreground text-center text-sm">
              {file.error
                ? 'Connect to the internet to open this PDF.'
                : !file.loading && !url
                  ? 'This PDF is not in the note, or you cannot open it.'
                  : state === 'password'
                    ? 'This PDF is locked with a password.'
                    : state === 'failed'
                      ? 'This PDF could not be opened. Go back and open it again.'
                      : 'Opening the PDF…'}
            </Text>
          </View>
        ) : null}
      </View>

      {selection ? (
        <View className="bg-card border-border gap-3 border-t px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }} accessibilityLabel="Selected words">
          <Text className="text-muted-foreground text-sm" numberOfLines={2}>
            “{selection.quote}”
          </Text>
          <View className="flex-row items-center gap-2">
            {editable
              ? COLORS.map((c) => <Pressable key={c.color} accessibilityRole="button" accessibilityLabel={`Highlight in ${c.label}`} onPress={() => void highlight(c.color)} className={cn('size-9 rounded-full', c.swatch)} />)
              : null}
            <View className="flex-1" />
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={clearSelection} className="rounded-full p-2">
              <X size={20} color={fg} />
            </Pressable>
          </View>
          {editable ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const s = selection
                clearSelection()
                void addToNotes(s)
              }}
              className="bg-primary flex-row items-center justify-center gap-2 rounded-full py-3"
            >
              <NotebookPen size={18} color="#ffffff" />
              <Text className="text-primary-foreground font-semibold">Add to notes</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {activeHighlight ? (
        <View className="bg-card border-border gap-3 border-t px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }} accessibilityLabel="Highlight">
          <View className="flex-row items-center gap-2">
            {COLORS.map((c) => (
              <Pressable key={c.color} accessibilityRole="button" accessibilityLabel={`Highlight in ${c.label}`} accessibilityState={{ selected: activeHighlight.color === c.color }} onPress={() => void change(activeHighlight.id, { color: c.color })} className={cn('size-9 rounded-full', c.swatch, activeHighlight.color === c.color && 'border-foreground border-2')} />
            ))}
            <View className="flex-1" />
            <Pressable accessibilityRole="button" accessibilityLabel="Remove highlight" onPress={() => void removeHighlight({ variables: { highlightId: activeHighlight.id } }).then(() => (setHighlights((l) => l.filter((h) => h.id !== activeHighlight.id)), setActive(null))).catch(() => setNotice('That did not save. Check your connection.'))} className="rounded-full p-2">
              <Trash2 size={20} color={fg} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setActive(null)} className="rounded-full p-2">
              <X size={20} color={fg} />
            </Pressable>
          </View>
          {activeHighlight.quote ? (
            <Text className="text-muted-foreground text-sm" numberOfLines={3}>
              “{activeHighlight.quote}”
            </Text>
          ) : null}
          <TextInput accessibilityLabel="Comment" placeholder="Add a thought about this…" placeholderTextColor={muted} value={comment} onChangeText={setComment} multiline className="border-border text-foreground rounded-xl border px-3 py-2 text-base" />
          <View className="flex-row gap-2">
            {comment.trim() !== (activeHighlight.comment ?? '') ? (
              <Pressable accessibilityRole="button" onPress={() => void change(activeHighlight.id, { comment })} className="bg-secondary flex-1 items-center rounded-full py-3">
                <Text className="text-secondary-foreground font-semibold">Save comment</Text>
              </Pressable>
            ) : null}
            {activeHighlight.kind === 'TEXT' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const h = activeHighlight
                  setActive(null)
                  void addToNotes({ page: h.page, rects: h.rects as PageRect[], quote: h.quote ?? '' }, h.id)
                }}
                className="bg-primary flex-1 items-center rounded-full py-3"
              >
                <Text className="text-primary-foreground font-semibold">Add to notes</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {sheet ? (
        <View className="bg-background border-border absolute inset-x-0 bottom-0 rounded-t-3xl border-t" style={{ height: '72%', paddingBottom: insets.bottom }} accessibilityLabel="Notes beside the PDF">
          <View className="border-border flex-row items-center gap-2 border-b px-4 py-3">
            <Text className="flex-1 text-lg font-bold" numberOfLines={1}>
              {title || 'Untitled note'}
            </Text>
            {note ? (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/notes/${noteId}`)} className="bg-secondary rounded-full px-3 py-1.5">
                <Text className="text-secondary-foreground text-sm font-semibold">Open note</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Hide notes" onPress={() => setSheet(false)} className="rounded-full p-2">
              <X size={20} color={fg} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {!editable ? (
              <View className="bg-primary/10 gap-2 rounded-2xl p-3">
                <Text className="text-sm">You can read this note. To highlight and make notes on this PDF, start notes of your own.</Text>
                <Pressable accessibilityRole="button" disabled={studying.loading} onPress={() => void startStudy()} className="bg-primary self-start rounded-full px-4 py-2">
                  <Text className="text-primary-foreground text-sm font-semibold">Start my notes on this PDF</Text>
                </Pressable>
              </View>
            ) : null}
            {!working ? (
              <Pressable accessibilityRole="button" disabled={converting.loading} onPress={() => void startConvert()} className="border-border flex-row items-center gap-2 self-start rounded-full border px-3 py-2">
                <Wand2 size={16} color={fg} />
                <Text className="text-sm font-semibold">{converting.loading ? 'Starting…' : 'Convert this PDF into cards'}</Text>
              </Pressable>
            ) : null}
            {cards
              .filter((c) => !(c.type === 'file' && (c.content as { fileId?: string }).fileId === fileId))
              .map((c) => (
                <CardView key={c.id} type={c.type} content={c.content} onAnchor={goToAnchor} />
              ))}
            {!cards.length ? <Text className="text-muted-foreground text-sm">Select words in the PDF to add them here.</Text> : null}
          </ScrollView>
        </View>
      ) : null}

      {notice ? (
        <View className="bg-foreground absolute self-center rounded-full px-4 py-2" style={{ bottom: insets.bottom + 90 }} accessibilityLiveRegion="polite">
          <Text className="text-background text-sm">{notice}</Text>
        </View>
      ) : null}
    </View>
  )
}
