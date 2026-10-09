'use dom'

import './pdf-viewer.css'
// The library first: the viewer reads it from globalThis.pdfjsLib. The worker runs in this page (a web view cannot
// load one from the app's files), set up as globalThis.pdfjsWorker.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import * as ui from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
import { useEffect, useRef } from 'react'
import type { DOMProps } from 'expo/dom'
import { hits, quoteOf, selectionRects, type PageRect } from './geometry'

/**
 * The PDF on the phone (lvn-backend ADR-0040): pdf.js's viewer in an Expo DOM component — the same engine as the web
 * reader — with highlights and the passages cards came from drawn over the pages. It reports the page, selected words
 * (the phone's own long press selects them) and taps on marks; the native screen around it does the rest.
 */

export interface DomMark {
  id: string
  page: number
  rects: PageRect[]
  kind: 'highlight' | 'anchor'
  color?: string
}

export type DomCommand =
  | { n: number; kind: 'goTo'; page: number; rects?: PageRect[] }
  | { n: number; kind: 'zoom'; to: 'in' | 'out' | 'width' }
  | { n: number; kind: 'find'; query: string; previous?: boolean }
  | { n: number; kind: 'clearSelection' }

export interface DomSelection {
  page: number
  rects: PageRect[]
  quote: string
}

type PageView = { div: HTMLDivElement; viewport: { width: number; height: number; convertToPdfPoint: (x: number, y: number) => number[] } }

const COLORS: Record<string, string> = {
  YELLOW: 'rgba(250, 204, 21, 0.5)',
  GREEN: 'rgba(74, 222, 128, 0.45)',
  BLUE: 'rgba(96, 165, 250, 0.45)',
  PINK: 'rgba(244, 114, 182, 0.45)',
  PURPLE: 'rgba(167, 139, 250, 0.5)',
}

export default function PdfDom({
  url,
  assets,
  marks,
  command,
  initialPage,
  background,
  onReady,
  onPage,
  onSelection,
  onMark,
  onFind,
  onError,
}: {
  url: string
  /** Where pdf.js's character maps, fonts and decoders are (the web app's /pdfjs/<version>/); optional */
  assets: string | null
  marks: DomMark[]
  command: DomCommand | null
  initialPage: number
  background: string
  onReady: (pages: number) => Promise<void>
  onPage: (page: number) => Promise<void>
  onSelection: (selection: DomSelection | null) => Promise<void>
  onMark: (id: string) => Promise<void>
  onFind: (result: { current: number; total: number } | null) => Promise<void>
  onError: (kind: 'load' | 'password') => Promise<void>
  dom?: DOMProps
}) {
  const container = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<InstanceType<typeof ui.PDFViewer> | null>(null)
  const busRef = useRef<InstanceType<typeof ui.EventBus> | null>(null)
  const marksRef = useRef(marks)
  marksRef.current = marks
  const flash = useRef<{ page: number; rects: PageRect[]; until: number } | null>(null)
  const callbacks = useRef({ onReady, onPage, onSelection, onMark, onFind, onError })
  callbacks.current = { onReady, onPage, onSelection, onMark, onFind, onError }

  const draw = (page: number) => {
    const view = viewerRef.current?.getPageView(page - 1) as PageView | undefined
    if (!view?.div) return
    let layer = view.div.querySelector<HTMLDivElement>(':scope > .lvn-marks')
    if (!layer) {
      layer = document.createElement('div')
      layer.className = 'lvn-marks'
      view.div.append(layer)
    }
    const lit = flash.current && flash.current.page === page && flash.current.until > Date.now() ? flash.current.rects : []
    const boxes = [
      ...marksRef.current.filter((m) => m.page === page).flatMap((m) => m.rects.map((r) => ({ r, style: m.kind === 'highlight' ? `background:${COLORS[m.color ?? 'YELLOW']}` : 'background:rgba(79,70,229,0.08);border-bottom:2px solid rgba(79,70,229,0.75)' }))),
      ...lit.map((r) => ({ r, style: 'background:rgba(79,70,229,0.35);animation:lvn-flash 1.8s ease-out forwards' })),
    ]
    layer.replaceChildren(
      ...boxes.map(({ r: [x0, y0, x1, y1], style }) => {
        const box = document.createElement('div')
        box.style.cssText = `position:absolute;border-radius:2px;left:${x0 * 100}%;top:${y0 * 100}%;width:${(x1 - x0) * 100}%;height:${(y1 - y0) * 100}%;${style}`
        return box
      }),
    )
  }

  useEffect(() => {
    const box = container.current
    const pages = inner.current
    if (!box || !pages) return
    let cancelled = false
    const bus = new ui.EventBus()
    const links = new ui.PDFLinkService({ eventBus: bus, externalLinkTarget: ui.LinkTarget.BLANK, externalLinkRel: 'noopener noreferrer nofollow' })
    const finder = new ui.PDFFindController({ eventBus: bus, linkService: links })
    const viewer = new ui.PDFViewer({ container: box, viewer: pages, eventBus: bus, linkService: links, findController: finder, textLayerMode: 1, annotationMode: pdfjs.AnnotationMode.ENABLE, annotationEditorMode: pdfjs.AnnotationEditorType.DISABLE })
    links.setViewer(viewer)
    viewerRef.current = viewer
    busRef.current = bus
    bus.on('pagesinit', () => {
      viewer.currentScaleValue = 'page-width'
      if (initialPage > 1) viewer.currentPageNumber = Math.min(initialPage, viewer.pagesCount)
    })
    bus.on('pagechanging', (e: { pageNumber: number }) => void callbacks.current.onPage(e.pageNumber))
    bus.on('pagerendered', (e: { pageNumber: number }) => draw(e.pageNumber))
    bus.on('updatefindmatchescount', (e: { matchesCount: { current: number; total: number } }) => void callbacks.current.onFind(e.matchesCount))
    bus.on('updatefindcontrolstate', (e: { state: number; matchesCount?: { current: number; total: number } }) => void callbacks.current.onFind(e.state === 1 ? { current: 0, total: 0 } : (e.matchesCount ?? null)))

    const loading = pdfjs.getDocument({ url, enableXfa: false, ...(assets ? { cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/` } : {}) })
    loading.onPassword = (answer: (password: string) => void, reason: number) => {
      const password = window.prompt(reason === 2 ? 'That password is not right. Password for this PDF:' : 'This PDF needs a password:')
      if (password === null) {
        void callbacks.current.onError('password')
        void loading.destroy()
      } else answer(password)
    }
    loading.promise.then(
      (doc) => {
        if (cancelled) return
        viewer.setDocument(doc)
        links.setDocument(doc)
        void callbacks.current.onReady(doc.numPages)
      },
      (e: { name?: string }) => {
        if (!cancelled && e?.name !== 'PasswordException') void callbacks.current.onError('load')
      },
    )

    // Selected words, a moment after the selection settles.
    let timer: ReturnType<typeof setTimeout> | undefined
    const read = () => {
      const sel = document.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) return void callbacks.current.onSelection(null)
      const range = sel.getRangeAt(0)
      const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? (range.startContainer as Element) : range.startContainer.parentElement
      const pageEl = start?.closest<HTMLElement>('.page')
      const surface = pageEl?.querySelector('.textLayer')
      if (!pageEl || !surface) return void callbacks.current.onSelection(null)
      const rects = selectionRects(range.getClientRects(), surface.getBoundingClientRect())
      const quote = quoteOf(sel.toString())
      void callbacks.current.onSelection(rects.length && quote ? { page: Number(pageEl.dataset.pageNumber), rects, quote } : null)
    }
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(read, 250)
    }
    document.addEventListener('selectionchange', soon)

    // A tap on a mark.
    const onClick = (e: MouseEvent) => {
      const sel = document.getSelection()
      if (sel && !sel.isCollapsed) return
      const pageEl = (e.target as Element | null)?.closest<HTMLElement>('.page')
      const surface = pageEl?.querySelector('.textLayer')
      if (!pageEl || !surface) return
      const r = surface.getBoundingClientRect()
      const page = Number(pageEl.dataset.pageNumber)
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      const hit = marksRef.current.filter((m) => m.page === page && hits(m.rects, x, y, 0.01)).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'highlight' ? -1 : 1))[0]
      if (hit) void callbacks.current.onMark(hit.id)
    }
    box.addEventListener('click', onClick)

    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('selectionchange', soon)
      box.removeEventListener('click', onClick)
      void loading.destroy()
      viewer.cleanup()
      pages.replaceChildren()
      viewerRef.current = null
    }
    // A new document only when the file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    const n = viewerRef.current?.pagesCount ?? 0
    for (let p = 1; p <= n; p++) draw(p)
  }, [marks])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!command || !viewer) return
    if (command.kind === 'goTo') {
      if (command.page < 1 || command.page > viewer.pagesCount) return
      const view = viewer.getPageView(command.page - 1) as PageView | undefined
      if (command.rects?.length && view?.viewport) {
        const top = Math.min(...command.rects.map((r) => r[1]))
        const left = Math.min(...command.rects.map((r) => r[0]))
        const [x, y] = view.viewport.convertToPdfPoint(left * view.viewport.width, Math.max(0, top - 0.06) * view.viewport.height)
        viewer.scrollPageIntoView({ pageNumber: command.page, destArray: [null, { name: 'XYZ' }, x, y, null], allowNegativeOffset: true })
        flash.current = { page: command.page, rects: command.rects, until: Date.now() + 1800 }
        draw(command.page)
        setTimeout(() => draw(command.page), 1850)
      } else viewer.currentPageNumber = command.page
    } else if (command.kind === 'zoom') {
      if (command.to === 'in') viewer.increaseScale()
      else if (command.to === 'out') viewer.decreaseScale()
      else viewer.currentScaleValue = 'page-width'
    } else if (command.kind === 'find') {
      if (!command.query.trim()) void callbacks.current.onFind(null)
      else busRef.current?.dispatch('find', { source: null, type: command.previous !== undefined ? 'again' : '', query: command.query, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: !!command.previous, matchDiacritics: false })
    } else document.getSelection()?.removeAllRanges()
    // Each command runs once, by its number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.n])

  return (
    <div style={{ position: 'fixed', inset: 0, background }}>
      <style>{`
        html, body { margin: 0; height: 100%; overflow: hidden; background: ${background}; }
        .pdfViewer .page { box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
        .lvn-marks { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: multiply; z-index: 1; }
        @keyframes lvn-flash { 0%, 40% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>
      <div ref={container} data-testid="pdf-viewer" style={{ position: 'absolute', inset: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div ref={inner} className="pdfViewer" />
      </div>
    </div>
  )
}
