// Maestro runScript: a note holding a two-page PDF, made through the API as the web's "Read a PDF" does (lvn-backend
// ADR-0040) — create the note, upload the PDF to it, add a file card. The PDF is plain ASCII, so it travels as text.
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-LVN-Client': 'mobile' }
const gql = (query, variables) => {
  const res = json(http.post(API_URL, { headers: auth, body: JSON.stringify({ query, variables }) }).body)
  if (res.errors) throw new Error(JSON.stringify(res.errors))
  return res.data
}
const uuid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))

const lines = [
  ['Photosynthesis', 'Plants turn light into chemical energy.', 'Chlorophyll absorbs red and blue light.'],
  ['Respiration', 'Cells release energy from glucose.'],
]
const stream = (ls) => ls.map((l, i) => `BT /F1 ${i === 0 ? 24 : 14} Tf 72 ${760 - i * 40} Td (${l}) Tj ET`).join('\n')
const s1 = stream(lines[0])
const s2 = stream(lines[1])
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${s1.length} >>\nstream\n${s1}\nendstream`,
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
  `<< /Length ${s2.length} >>\nstream\n${s2}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
]
let pdf = '%PDF-1.7\n'
const offsets = []
objects.forEach((body, i) => {
  offsets.push(pdf.length)
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
})
const xref = pdf.length
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

const noteId = gql('mutation($input: CreateNoteInput!) { createNote(input: $input) { note { id } userErrors { message } } }', { input: { title: 'Biology' } }).createNote.note.id
const intent = gql('mutation($input: CreateUploadIntentInput!) { createUploadIntent(input: $input) { intent { fileId uploadUrl uploadHeaders { name value } } userErrors { message } } }', {
  input: { fileName: 'Biology chapter 3.pdf', mimeType: 'application/pdf', sizeBytes: pdf.length, purpose: 'ATTACHMENT', parentId: noteId },
}).createUploadIntent.intent
const putHeaders = {}
intent.uploadHeaders.forEach((h) => {
  if (h.name.toLowerCase() !== 'content-length') putHeaders[h.name] = h.value
})
const put = http.put(intent.uploadUrl, { headers: putHeaders, body: pdf })
if (put.status !== 200) throw new Error(`upload answered ${put.status}`)
gql('mutation($id: UUID!) { completeUpload(fileId: $id) { ok } }', { id: intent.fileId })
gql('mutation($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { userErrors { message } } }', {
  input: { noteId, ops: [{ kind: 'UPSERT', id: uuid(), type: 'file', position: 'a0', content: { fileId: intent.fileId } }] },
})
output.noteId = noteId
output.fileId = intent.fileId
