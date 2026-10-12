// Maestro runScript: another account, made through the API, for flows about people (lvn-backend ADR-0043). Its name is
// unique to the run, so search finds exactly this person.
const headers = { 'Content-Type': 'application/json' }
const gql = (query, variables) => json(http.post(API_URL, { headers, body: JSON.stringify({ query, variables }) }).body)

const stamp = Date.now()
const name = `Asha ${stamp}`
const terms = gql('{ termsVersion }').data.termsVersion
const res = gql('mutation($input: SignUpInput!) { signUp(input: $input) { session { accessToken } userErrors { message } } }', {
  input: { email: `e2e-other-${stamp}@example.com`, password: `lvn e2e passphrase ${stamp}`, displayName: name, dateOfBirth: '2001-02-03', acceptedTermsVersion: terms },
})
if (!res.data || !res.data.signUp.session) throw new Error(`sign-up failed: ${JSON.stringify(res)}`)
output.otherName = name
