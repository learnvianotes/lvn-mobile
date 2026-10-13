// Maestro runScript: the notes the server knows the account opened today (learning history, lvn-backend ADR-0067), so
// a flow can check that learning events made offline arrived.
const res = json(
  http.post(API_URL, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-LVN-Client': 'mobile' },
    body: JSON.stringify({ query: '{ learningHistory(days: 2) { days { readingSeconds notes { title } } } }' }),
  }).body,
)
const days = res.data.learningHistory.days
output.opened = days.flatMap((d) => d.notes.filter((n) => n).map((n) => n.title)).join(' | ')
output.reading = String(days.reduce((s, d) => s + d.readingSeconds, 0))
