/** pdf.js's version: its run-time files are served by the web app under /pdfjs/<version>/ (tests check it). */
export const PDFJS_VERSION = '6.4.299'

/** The reader's route for a PDF of a note (lvn-backend ADR-0040); `at` comes from a card's page chip. */
export const readerPath = (noteId: string, fileId: string, at?: { page: number; card?: string }) => `/notes/read/${noteId}/${fileId}${at ? `?page=${at.page}${at.card ? `&card=${at.card}` : ''}` : ''}`
