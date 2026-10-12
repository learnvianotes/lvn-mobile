// Maestro runScript: asks for the account's data export through the API (lvn-backend ADR-0018). apps/worker builds it
// and its DataExportReady event notifies the account (ADR-0042), which reaches the open app over the live socket.
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-LVN-Client': 'mobile' }
const res = json(http.post(API_URL, { headers: auth, body: JSON.stringify({ query: 'mutation { requestDataExport { export { id } userErrors { message } } }' }) }).body)
if (res.errors || !res.data.requestDataExport.export) throw new Error(`export not requested: ${JSON.stringify(res)}`)
output.exportId = res.data.requestDataExport.export.id
