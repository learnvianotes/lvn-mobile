'use dom'

import Highlight from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'
import type { DOMProps } from 'expo/dom'

/**
 * Rich text on the phone (ADR-0039): the web's editor engine (Tiptap 3) in an Expo DOM component, editing one card's
 * document — paragraphs, lists and the marks @lvn/contracts allows. The document goes in as JSON and comes back through
 * onChange (debounced); the native screen saves it to the phone's notes.
 */

export interface EditorTheme {
  fg: string
  muted: string
  accent: string
  bg: string
  surface: string
  border: string
}

type Doc = { type: 'doc'; content?: JSONContent[] }

const BUTTONS: { key: string; label: string; title: string; run: (e: NonNullable<ReturnType<typeof useEditor>>) => void; active: (e: NonNullable<ReturnType<typeof useEditor>>) => boolean }[] = [
  { key: 'bold', label: 'B', title: 'Bold', run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { key: 'italic', label: 'I', title: 'Italic', run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  { key: 'underline', label: 'U', title: 'Underline', run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive('underline') },
  { key: 'strike', label: 'S', title: 'Strikethrough', run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
  { key: 'highlight', label: 'H', title: 'Highlight', run: (e) => e.chain().focus().toggleHighlight().run(), active: (e) => e.isActive('highlight') },
  { key: 'bullet', label: '•', title: 'Bulleted list', run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  { key: 'ordered', label: '1.', title: 'Numbered list', run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
]

export default function RichTextEditor({
  initial,
  placeholder,
  label,
  theme,
  autoFocus,
  onChange,
}: {
  initial: Doc
  placeholder: string
  /** The writing area's accessible name */
  label: string
  theme: EditorTheme
  autoFocus?: boolean
  onChange: (doc: Doc) => Promise<void>
  dom?: DOMProps
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      Highlight,
      Placeholder.configure({ placeholder }),
    ],
    content: initial.content?.length ? initial : { type: 'doc', content: [{ type: 'paragraph' }] },
    autofocus: autoFocus ? 'end' : false,
    // Screen readers (and Maestro) find the writing area by name; the placeholder is only drawn.
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': label } },
    onUpdate: ({ editor: e }) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void onChange(e.getJSON() as Doc), 300)
    },
  })
  // The web view allows file access. A link in the document must not navigate it.
  useEffect(() => {
    const block = (e: Event) => {
      if (e.type === 'submit') {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      const anchor = (e.target as Element | null)?.closest?.('a')
      const href = anchor?.getAttribute('href')
      if (!anchor || href == null || href === '' || href.startsWith('#')) return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('click', block, true)
    document.addEventListener('submit', block, true)
    const previousOpen = window.open
    window.open = () => null
    return () => {
      document.removeEventListener('click', block, true)
      document.removeEventListener('submit', block, true)
      window.open = previousOpen
    }
  }, [])
  // The last change is sent when the editor closes, not lost to the debounce.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (editor && !editor.isDestroyed) void onChange(editor.getJSON() as Doc)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor],
  )
  const active = useEditorState({ editor, selector: ({ editor: e }) => Object.fromEntries(BUTTONS.map((b) => [b.key, e ? b.active(e) : false])) as Record<string, boolean> })

  return (
    <div style={{ color: theme.fg, background: 'transparent', fontFamily: '-apple-system, Roboto, "Segoe UI", sans-serif' }}>
      <style>{`
        body { margin: 0; background: transparent; }
        .ProseMirror { outline: none; min-height: 72px; font-size: 17px; line-height: 1.55; padding: 4px 2px 8px; }
        .ProseMirror p { margin: 0 0 6px; }
        .ProseMirror ul, .ProseMirror ol { margin: 0 0 6px; padding-left: 22px; }
        .ProseMirror mark { background: rgba(250, 204, 21, 0.4); color: inherit; border-radius: 3px; }
        .ProseMirror a { color: ${theme.accent}; }
        .ProseMirror code { font-family: monospace; background: ${theme.surface}; padding: 1px 4px; border-radius: 4px; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: ${theme.muted}; float: left; height: 0; pointer-events: none; }
      `}</style>
      <div role="toolbar" aria-label="Formatting" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 8, borderBottom: `1px solid ${theme.border}`, marginBottom: 8 }}>
        {BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            title={b.title}
            aria-label={b.title}
            aria-pressed={active?.[b.key] ?? false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor && b.run(editor)}
            style={{
              minWidth: 36,
              height: 34,
              borderRadius: 10,
              border: `1px solid ${active?.[b.key] ? theme.accent : theme.border}`,
              background: active?.[b.key] ? theme.accent : theme.surface,
              color: active?.[b.key] ? '#fff' : theme.fg,
              fontWeight: b.key === 'bold' ? 800 : 600,
              fontStyle: b.key === 'italic' ? 'italic' : 'normal',
              textDecoration: b.key === 'underline' ? 'underline' : b.key === 'strike' ? 'line-through' : 'none',
              fontSize: 15,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
