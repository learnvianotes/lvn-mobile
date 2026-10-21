import { useQuery } from '@apollo/client/react'
import { UploadsEnabledDocument } from '@/graphql/generated/graphql'

/**
 * Whether people may upload files here (lvn-backend ADR-0097: off for the launch). While it is false — and until the API
 * has said — every upload control is hidden: photos, videos and files in notes, voice notes, notes from photos and PDFs,
 * Upload, imports, pictures and proof documents. Nothing is shown that would only fail.
 */
export function useUploadsEnabled(): boolean {
  const { data } = useQuery(UploadsEnabledDocument, { fetchPolicy: 'cache-first' })
  return data?.uploadsEnabled ?? false
}

/** The create actions that upload a file. */
export const UPLOAD_ACTIONS = new Set(['Voice note', 'Photo', 'Upload'])
