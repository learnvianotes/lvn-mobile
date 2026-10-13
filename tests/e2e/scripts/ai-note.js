// Maestro runScript: a short note to ask AI about (lvn-backend ADR-0059), made through the API, and whether the
// server's AI answers (output.ai is "on" or "off"; the flow does nothing when it is off).
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-LVN-Client': 'mobile' }
const gql = (query, variables) => {
  const res = json(http.post(API_URL, { headers: auth, body: JSON.stringify({ query, variables }) }).body)
  if (res.errors) throw new Error(JSON.stringify(res.errors))
  return res.data
}
const uuid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))
const text = (s) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })

output.ai = gql('{ aiStatus { available } }').aiStatus.available ? 'on' : 'off'
const noteId = gql('mutation($input: CreateNoteInput!) { createNote(input: $input) { note { id } userErrors { message } } }', { input: { title: 'Heaps' } }).createNote.note.id
gql('mutation($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { userErrors { message } } }', {
  input: {
    noteId,
    ops: [
      { kind: 'UPSERT', id: uuid(), type: 'heading', position: 'a0', content: { level: 1, content: [{ type: 'text', text: 'Binary heaps' }] } },
      { kind: 'UPSERT', id: uuid(), type: 'text', position: 'a1', content: text('A binary heap is a complete binary tree stored in an array. In a min-heap every parent is smaller than its children, so the smallest item is at the root.') },
      { kind: 'UPSERT', id: uuid(), type: 'text', position: 'a2', content: text('Insert adds the item at the end and sifts it up; extract-min moves the last item to the root and sifts it down. Both take O(log n) time.') },
    ],
  },
})
