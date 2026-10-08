// Maestro runScript: the account's notes as the server has them (syncPull), so a flow can check what reached it.
const res = json(
  http.post(API_URL, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-LVN-Client': 'mobile' },
    body: JSON.stringify({ query: '{ syncPull(first: 50) { notes { note { title } cards { content } } } }' }),
  }).body,
)
const notes = res.data.syncPull.notes
output.titles = notes.map((n) => n.note.title).sort().join(' | ')
output.cards = JSON.stringify(notes.map((n) => n.cards.map((c) => c.content)))
