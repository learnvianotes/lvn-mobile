/**
 * A file read on the phone (`fetch(uri).blob()`), as React Native gives it: a size, the type Android guesses from the
 * file's extension, and `slice` for a typed view of the same bytes.
 */
export interface FileBlob {
  size: number
  type: string
  slice(start?: number, end?: number, contentType?: string): FileBlob
}

export const fileBlob = (size: number, type = ''): FileBlob => ({ size, type, slice: (start = 0, end = size, contentType = '') => fileBlob(end - start, contentType) })
