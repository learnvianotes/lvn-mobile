import { gql } from '@apollo/client'

/**
 * Sends the sign-in verification link again for the signed-in account.
 *
 * Assumption: the mutation is `resendVerification`, with no arguments, returning OkPayload
 * (`ok` and `userErrors`) — the same shape as `resendInstitutionalEmailCode`. That field is not in
 * the schema this app has checked in. It stays out of `graphql/operations` so codegen still matches
 * that schema; move it there once the contract includes the name.
 */
export const ResendVerificationDocument = gql`
  mutation ResendVerification {
    resendVerification {
      ok
      userErrors {
        field
        message
        code
      }
    }
  }
`
