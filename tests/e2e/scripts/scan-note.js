// Maestro runScript: a note as a scanned PDF's conversion leaves it (lvn-backend ADR-0063), with words split across
// lines, a misread letter and a running header inside a sentence, made through the API; and whether the server's AI
// answers (output.ai is "on" or "off"). With CHECK set, it says instead whether the note's cards were mended
// (output.mended is "yes" or "no").
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-LVN-Client': 'mobile' }
const gql = (query, variables) => {
  const res = json(http.post(API_URL, { headers: auth, body: JSON.stringify({ query, variables }) }).body)
  if (res.errors) throw new Error(JSON.stringify(res.errors))
  return res.data
}
const uuid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))
const text = (s) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })

if (typeof CHECK !== 'undefined' && CHECK) {
  const cards = gql('query($id: UUID!) { note(id: $id) { cards(first: 20) { edges { node { content } } } } }', { id: NOTE_ID }).note.cards.edges
  const words = cards.map((e) => JSON.stringify(e.node.content)).join(' ')
  output.mended = words.indexOf('the energy stored') >= 0 && words.indexOf('en- ergy') < 0 ? 'yes' : 'no'
} else {
  output.ai = gql('{ aiStatus { available } }').aiStatus.available ? 'on' : 'off'
  const noteId = gql('mutation($input: CreateNoteInput!) { createNote(input: $input) { note { id } userErrors { message } } }', { input: { title: 'Respiration scan' } }).createNote.note.id
  gql('mutation($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { userErrors { message } } }', {
    input: {
      noteId,
      ops: [
        { kind: 'UPSERT', id: uuid(), type: 'heading', position: 'a0', content: { level: 1, content: [{ type: 'text', text: 'Chapter 4: Respiration' }] } },
        { kind: 'UPSERT', id: uuid(), type: 'text', position: 'a1', content: text('Respiration releases the en- ergy stored in glucose.') },
        { kind: 'UPSERT', id: uuid(), type: 'text', position: 'a2', content: text('Cells use tbis energy to grow, move 14 Biology Class X and repair themselves.') },
      ],
    },
  })
  output.noteId = noteId
}
