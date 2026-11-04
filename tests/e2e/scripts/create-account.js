// Maestro runScript: a fresh account made through the API, for flows that start signed in. Each run uses a new
// address, so sign-in rate limits (per email) never carry over between flows.
const headers = { 'Content-Type': 'application/json' }
const gql = (query, variables) => json(http.post(API_URL, { headers, body: JSON.stringify({ query, variables }) }).body)

const stamp = Date.now()
const email = `e2e-${stamp}@example.com`
const password = `lvn e2e passphrase ${stamp}`
const terms = gql('{ termsVersion }').data.termsVersion
const res = gql('mutation($input: SignUpInput!) { signUp(input: $input) { session { accessToken } userErrors { message } } }', {
  input: { email, password, displayName: 'Ravi Kumar', age: 23, acceptedTermsVersion: terms },
})
if (!res.data || !res.data.signUp.session) throw new Error(`sign-up failed: ${JSON.stringify(res)}`)
output.email = email
output.token = res.data.signUp.session.accessToken
output.password = password
