import { QuickNoteLimits } from '@/lib/contracts/domain/enums'

/** A photo or PDF waiting in the tray; `fileId` once it is uploaded (a retry skips it). */
export type TrayItem = { key: string; uri: string; name: string; mimeType: string; size: number; kind: 'image' | 'pdf'; fileId?: string }

/** "640 KB", "3.2 MB". */
export function sizeLabel(bytes: number): string {
  return bytes < 1024 ** 2 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

/** The resize that brings a picture's longer side down to `side`, or null when it already fits. */
export function fitWithin(width: number, height: number, side: number): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= side) return null
  return width >= height ? { width: side } : { height: side }
}

/**
 * What adding these keeps (lvn-backend ADR-0084): up to QuickNoteLimits.files in all, no PDF over pdfBytes, and only
 * pictures and PDFs. `refused` says what was left out and why.
 */
export function addToTray(tray: TrayItem[], added: TrayItem[]): { tray: TrayItem[]; refused: string[] } {
  const refused: string[] = []
  const fitting = added.filter((item) => {
    if (item.kind === 'pdf' && item.size > QuickNoteLimits.pdfBytes) {
      refused.push(`${item.name} is ${sizeLabel(item.size)}; a PDF can be at most ${QuickNoteLimits.pdfBytes / 1024 ** 2} MB.`)
      return false
    }
    return true
  })
  const room = Math.max(0, QuickNoteLimits.files - tray.length)
  if (fitting.length > room) refused.push(`Only ${QuickNoteLimits.files} photos or PDFs go into one note; ${fitting.length - room} ${fitting.length - room === 1 ? 'was' : 'were'} left out.`)
  return { tray: [...tray, ...fitting.slice(0, room)], refused }
}
