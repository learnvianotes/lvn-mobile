// Maestro runScript: the 6-digit code in the newest message Mailpit received for TO (the API's dev SMTP sink).
const search = json(http.get(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${TO}"`)}&limit=1`).body)
if (!search.messages || !search.messages.length) throw new Error(`no mail for ${TO}`)
const message = json(http.get(`${MAILPIT_URL}/api/v1/message/${search.messages[0].ID}`).body)
const code = /\b(\d{6})\b/.exec(message.Text)
if (!code) throw new Error(`no code in the mail to ${TO}`)
output.code = code[1]
