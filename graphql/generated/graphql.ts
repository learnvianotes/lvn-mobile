/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** A card as the client has it. Ids are UUIDs the client makes, so cards created offline keep their id. */
export type CardInput = {
  content: unknown;
  id: string;
  position: string;
  type: CardType;
};

export type CardOpInput = {
  /** The card's revision the client last saw; omitted for new cards */
  baseRevision?: number | null | undefined;
  content?: unknown;
  id: string;
  kind: CardOpKind;
  position?: string | null | undefined;
  type?: CardType | null | undefined;
};

export type CardOpKind =
  /** Remove the card; send `baseRevision` */
  | 'DELETE'
  /** Change only `position` */
  | 'MOVE'
  /** Create the card, or change it; send `baseRevision` when changing */
  | 'UPSERT';

export type CardOpStatus =
  | 'APPLIED'
  /** Applied, but the card had changed on another device since baseRevision: that version is kept in `conflictVersion` */
  | 'APPLIED_WITH_CONFLICT'
  /** Not applied: the card was deleted, or changed elsewhere before this delete */
  | 'REJECTED';

/** The sixteen card types (§4.1); content is validated per type (@lvn/contracts/validation) */
export type CardType =
  | 'audio'
  | 'callout'
  | 'checklist'
  | 'code'
  | 'diagram'
  | 'file'
  | 'flashcard'
  | 'heading'
  | 'image'
  | 'markdown'
  | 'question'
  | 'quiz'
  | 'quote'
  | 'table'
  | 'text'
  | 'video';

/** After a provider sign-in (no signUp call): the same details, collected once */
export type CompleteRegistrationInput = {
  acceptedTermsVersion: string;
  dateOfBirth: string;
  displayName: string;
  institutionalEmail?: string | null | undefined;
};

export type DataExportStatus =
  | 'EXPIRED'
  | 'FAILED'
  | 'PENDING'
  | 'READY';

/** Fixed error vocabulary (§6.2) */
export type ErrorCode =
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'INTERNAL'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNAUTHENTICATED'
  | 'VALIDATION';

export type GlobalRole =
  | 'PLATFORM_ADMIN'
  | 'STUDENT'
  | 'TEACHER';

export type InstitutionalEmailStatus =
  /** A code was sent to the address and not yet entered */
  | 'CODE_SENT'
  /** Confirmed; the account is verified by it */
  | 'CONFIRMED'
  /** No college or organisation email yet */
  | 'NONE'
  /** Confirmed, but the domain waits for platform-admin review before it verifies the account */
  | 'PENDING_REVIEW';

/** OWNER and EDITOR work on the draft; READER sees the published version (§4.3) */
export type NoteAccess =
  | 'EDITOR'
  | 'OWNER'
  | 'READER';

/** Authorization Code + PKCE: the code from the provider's redirect and the verifier the client generated */
export type OAuthExchangeInput = {
  code: string;
  codeVerifier: string;
  provider: OAuthProvider;
  redirectUri: string;
};

/** Providers exchanged through oauthExchange. Google uses signInWithGoogle (ADR-0007). */
export type OAuthProvider =
  | 'GITHUB'
  | 'LINKEDIN';

export type SignInInput = {
  email: string;
  password: string;
};

/**
 * Registration (ADR-0017, ADR-0019): date of birth is required (YYYY-MM-DD). A college or organisation email is
 * optional; it receives a 6-digit code. `acceptedTermsVersion` must be Query.termsVersion.
 */
export type SignUpInput = {
  acceptedTermsVersion: string;
  dateOfBirth: string;
  displayName: string;
  email: string;
  institutionalEmail?: string | null | undefined;
  password: string;
};

export type SyncOpInput = {
  /** CREATE_NOTE: the note's first cards */
  cards?: Array<CardInput> | null | undefined;
  /** A UUID made on the device; sending the same operation again returns the first answer */
  clientOpId: string;
  kind: SyncOpKind;
  /** For CREATE_NOTE, the id the device gave the note */
  noteId: string;
  /** UPDATE_NOTE: card changes, as in updateNoteDraft */
  ops?: Array<CardOpInput> | null | undefined;
  /** CREATE_NOTE and UPDATE_NOTE */
  title?: string | null | undefined;
};

export type SyncOpKind =
  | 'CREATE_NOTE'
  | 'RESTORE_NOTE'
  | 'TRASH_NOTE'
  | 'UPDATE_NOTE';

/** APPLIED; REJECTED — it will never apply (show it as needing attention); RETRY — send it again later */
export type SyncOpStatus =
  | 'APPLIED'
  | 'REJECTED'
  | 'RETRY';

export type VerificationMethod =
  | 'DOCUMENTS'
  | 'INSTITUTIONAL_EMAIL'
  | 'TEACHER';

/** Who can read a note (§4.2) */
export type Visibility =
  | 'PRIVATE'
  | 'PUBLIC'
  | 'SHARED';

export type ViewerFieldsFragment = { id: string, handle: string, displayName: string, email: string | null, emailVerified: boolean, registrationComplete: boolean, verified: boolean, verificationMethod: VerificationMethod | null, globalRole: GlobalRole, restrictedMinor: boolean | null, institutionalEmail: string | null, institutionalEmailStatus: InstitutionalEmailStatus | null, institution: { name: string, verified: boolean } | null };

export type SessionFieldsFragment = { accessToken: string, accessTokenExpiresAt: string, refreshToken: string | null, user: { id: string, handle: string, displayName: string, email: string | null, emailVerified: boolean, registrationComplete: boolean, verified: boolean, verificationMethod: VerificationMethod | null, globalRole: GlobalRole, restrictedMinor: boolean | null, institutionalEmail: string | null, institutionalEmailStatus: InstitutionalEmailStatus | null, institution: { name: string, verified: boolean } | null } };

export type ProblemsFragment = { field: Array<string> | null, message: string, code: ErrorCode };

export type ViewerQueryVariables = Exact<{ [key: string]: never; }>;


export type ViewerQuery = { viewer: { id: string, handle: string, displayName: string, email: string | null, emailVerified: boolean, registrationComplete: boolean, verified: boolean, verificationMethod: VerificationMethod | null, globalRole: GlobalRole, restrictedMinor: boolean | null, institutionalEmail: string | null, institutionalEmailStatus: InstitutionalEmailStatus | null, institution: { name: string, verified: boolean } | null } | null };

export type SignInOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type SignInOptionsQuery = { termsVersion: string, signInOptions: { emailPassword: boolean, google: boolean, github: boolean, linkedin: boolean } };

export type SignUpMutationVariables = Exact<{
  input: SignUpInput;
}>;


export type SignUpMutation = { signUp: { session: { accessToken: string, accessTokenExpiresAt: string, refreshToken: string | null, user: { id: string, handle: string, displayName: string, email: string | null, emailVerified: boolean, registrationComplete: boolean, verified: boolean, verificationMethod: VerificationMethod | null, globalRole: GlobalRole, restrictedMinor: boolean | null, institutionalEmail: string | null, institutionalEmailStatus: InstitutionalEmailStatus | null, institution: { name: string, verified: boolean } | null } } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type SignInMutationVariables = Exact<{
  input: SignInInput;
}>;


export type SignInMutation = { signIn: { session: { accessToken: string, accessTokenExpiresAt: string, refreshToken: string | null, user: { id: string, handle: string, displayName: string, email: string | null, emailVerified: boolean, registrationComplete: boolean, verified: boolean, verificationMethod: VerificationMethod | null, globalRole: GlobalRole, restrictedMinor: boolean | null, institutionalEmail: string | null, institutionalEmailStatus: InstitutionalEmailStatus | null, institution: { name: string, verified: boolean } | null } } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type SignOutMutationVariables = Exact<{ [key: string]: never; }>;


export type SignOutMutation = { signOut: { ok: boolean } };

export type OAuthExchangeMutationVariables = Exact<{
  input: OAuthExchangeInput;
}>;


export type OAuthExchangeMutation = { oauthExchange: { session: { accessToken: string, accessTokenExpiresAt: string, refreshToken: string | null, user: { id: string, handle: string, displayName: string, email: string | null, emailVerified: boolean, registrationComplete: boolean, verified: boolean, verificationMethod: VerificationMethod | null, globalRole: GlobalRole, restrictedMinor: boolean | null, institutionalEmail: string | null, institutionalEmailStatus: InstitutionalEmailStatus | null, institution: { name: string, verified: boolean } | null } } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type CompleteRegistrationMutationVariables = Exact<{
  input: CompleteRegistrationInput;
}>;


export type CompleteRegistrationMutation = { completeRegistration: { ok: boolean, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type RequestPasswordResetMutationVariables = Exact<{
  email: string;
}>;


export type RequestPasswordResetMutation = { requestPasswordReset: { ok: boolean, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type VerifyInstitutionalEmailMutationVariables = Exact<{
  code: string;
}>;


export type VerifyInstitutionalEmailMutation = { verifyInstitutionalEmail: { ok: boolean, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type ResendInstitutionalEmailCodeMutationVariables = Exact<{ [key: string]: never; }>;


export type ResendInstitutionalEmailCodeMutation = { resendInstitutionalEmailCode: { ok: boolean, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type SignInWithGoogleMutationVariables = Exact<{
  idToken: string;
}>;


export type SignInWithGoogleMutation = { signInWithGoogle: { session: { accessToken: string, accessTokenExpiresAt: string, refreshToken: string | null, user: { id: string, handle: string, displayName: string, email: string | null, emailVerified: boolean, registrationComplete: boolean, verified: boolean, verificationMethod: VerificationMethod | null, globalRole: GlobalRole, restrictedMinor: boolean | null, institutionalEmail: string | null, institutionalEmailStatus: InstitutionalEmailStatus | null, institution: { name: string, verified: boolean } | null } } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type DataExportFieldsFragment = { id: string, status: DataExportStatus, requestedAt: string, expiresAt: string | null, sizeBytes: number | null, downloadUrl: string | null };

export type MyDataExportsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyDataExportsQuery = { myDataExports: Array<{ id: string, status: DataExportStatus, requestedAt: string, expiresAt: string | null, sizeBytes: number | null, downloadUrl: string | null }> };

export type RequestDataExportMutationVariables = Exact<{ [key: string]: never; }>;


export type RequestDataExportMutation = { requestDataExport: { export: { id: string, status: DataExportStatus, requestedAt: string, expiresAt: string | null, sizeBytes: number | null, downloadUrl: string | null } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: ErrorCode }> } };

export type SyncedNoteFieldsFragment = { id: string, title: string, visibility: Visibility, viewerAccess: NoteAccess, draftRevision: number | null, draftUpdatedAt: string | null, publishedAt: string | null, deletedAt: string | null, owner: { id: string, displayName: string } };

export type SyncPullQueryVariables = Exact<{
  since?: string | null | undefined;
  after?: string | null | undefined;
}>;


export type SyncPullQuery = { syncPull: { liveNoteIds: Array<string>, cursor: string | null, hasMore: boolean, notes: Array<{ note: { id: string, title: string, visibility: Visibility, viewerAccess: NoteAccess, draftRevision: number | null, draftUpdatedAt: string | null, publishedAt: string | null, deletedAt: string | null, owner: { id: string, displayName: string } }, cards: Array<{ id: string, type: CardType, position: string, revision: number, content: unknown }> }> } };

export type SyncPushMutationVariables = Exact<{
  ops: Array<SyncOpInput> | SyncOpInput;
}>;


export type SyncPushMutation = { syncPush: { results: Array<{ clientOpId: string, status: SyncOpStatus, code: ErrorCode | null, message: string | null, noteId: string, conflictVersionId: string | null, cardResults: Array<{ id: string, status: CardOpStatus, revision: number | null, message: string | null }> }> } };

export type SearchNotesQueryVariables = Exact<{
  query: string;
}>;


export type SearchNotesQuery = { search: { notes: Array<{ snippet: string, note: { id: string, title: string, visibility: Visibility, owner: { id: string, displayName: string } } }>, topics: Array<{ id: string, title: string, subject: { id: string, title: string } }> } };

export type RemoteNoteQueryVariables = Exact<{
  id: string;
}>;


export type RemoteNoteQuery = { note: { id: string, title: string, visibility: Visibility, viewerAccess: NoteAccess, draftRevision: number | null, draftUpdatedAt: string | null, publishedAt: string | null, deletedAt: string | null, cards: { edges: Array<{ node: { id: string, type: CardType, position: string, revision: number, content: unknown } }> }, owner: { id: string, displayName: string } } | null };

export const ViewerFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ViewerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"handle"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"registrationComplete"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"verificationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"globalRole"}},{"kind":"Field","name":{"kind":"Name","value":"restrictedMinor"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmail"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmailStatus"}},{"kind":"Field","name":{"kind":"Name","value":"institution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}}]}}]}}]} as unknown as DocumentNode<ViewerFieldsFragment, unknown>;
export const SessionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Session"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"accessTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ViewerFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ViewerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"handle"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"registrationComplete"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"verificationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"globalRole"}},{"kind":"Field","name":{"kind":"Name","value":"restrictedMinor"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmail"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmailStatus"}},{"kind":"Field","name":{"kind":"Name","value":"institution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}}]}}]}}]} as unknown as DocumentNode<SessionFieldsFragment, unknown>;
export const ProblemsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<ProblemsFragment, unknown>;
export const DataExportFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DataExportFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DataExport"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"requestedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"sizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}}]}}]} as unknown as DocumentNode<DataExportFieldsFragment, unknown>;
export const SyncedNoteFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SyncedNoteFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Note"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"viewerAccess"}},{"kind":"Field","name":{"kind":"Name","value":"draftRevision"}},{"kind":"Field","name":{"kind":"Name","value":"draftUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deletedAt"}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<SyncedNoteFieldsFragment, unknown>;
export const ViewerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ViewerFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ViewerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"handle"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"registrationComplete"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"verificationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"globalRole"}},{"kind":"Field","name":{"kind":"Name","value":"restrictedMinor"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmail"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmailStatus"}},{"kind":"Field","name":{"kind":"Name","value":"institution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}}]}}]}}]} as unknown as DocumentNode<ViewerQuery, ViewerQueryVariables>;
export const SignInOptionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SignInOptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"signInOptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"emailPassword"}},{"kind":"Field","name":{"kind":"Name","value":"google"}},{"kind":"Field","name":{"kind":"Name","value":"github"}},{"kind":"Field","name":{"kind":"Name","value":"linkedin"}}]}},{"kind":"Field","name":{"kind":"Name","value":"termsVersion"}}]}}]} as unknown as DocumentNode<SignInOptionsQuery, SignInOptionsQueryVariables>;
export const SignUpDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignUp"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SignUpInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"signUp"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Problems"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ViewerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"handle"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"registrationComplete"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"verificationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"globalRole"}},{"kind":"Field","name":{"kind":"Name","value":"restrictedMinor"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmail"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmailStatus"}},{"kind":"Field","name":{"kind":"Name","value":"institution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Session"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"accessTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ViewerFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<SignUpMutation, SignUpMutationVariables>;
export const SignInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignIn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SignInInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"signIn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Problems"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ViewerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"handle"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"registrationComplete"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"verificationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"globalRole"}},{"kind":"Field","name":{"kind":"Name","value":"restrictedMinor"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmail"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmailStatus"}},{"kind":"Field","name":{"kind":"Name","value":"institution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Session"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"accessTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ViewerFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<SignInMutation, SignInMutationVariables>;
export const SignOutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignOut"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"signOut"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}}]}}]}}]} as unknown as DocumentNode<SignOutMutation, SignOutMutationVariables>;
export const OAuthExchangeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"OAuthExchange"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"OAuthExchangeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"oauthExchange"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Problems"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ViewerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"handle"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"registrationComplete"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"verificationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"globalRole"}},{"kind":"Field","name":{"kind":"Name","value":"restrictedMinor"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmail"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmailStatus"}},{"kind":"Field","name":{"kind":"Name","value":"institution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Session"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"accessTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ViewerFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<OAuthExchangeMutation, OAuthExchangeMutationVariables>;
export const CompleteRegistrationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteRegistration"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteRegistrationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeRegistration"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Problems"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<CompleteRegistrationMutation, CompleteRegistrationMutationVariables>;
export const RequestPasswordResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestPasswordReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestPasswordReset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Problems"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>;
export const VerifyInstitutionalEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyInstitutionalEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifyInstitutionalEmail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Problems"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<VerifyInstitutionalEmailMutation, VerifyInstitutionalEmailMutationVariables>;
export const ResendInstitutionalEmailCodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendInstitutionalEmailCode"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resendInstitutionalEmailCode"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Problems"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<ResendInstitutionalEmailCodeMutation, ResendInstitutionalEmailCodeMutationVariables>;
export const SignInWithGoogleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignInWithGoogle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idToken"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"signInWithGoogle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"idToken"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idToken"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Problems"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ViewerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"handle"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"registrationComplete"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"verificationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"globalRole"}},{"kind":"Field","name":{"kind":"Name","value":"restrictedMinor"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmail"}},{"kind":"Field","name":{"kind":"Name","value":"institutionalEmailStatus"}},{"kind":"Field","name":{"kind":"Name","value":"institution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Session"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"accessTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ViewerFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Problems"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]} as unknown as DocumentNode<SignInWithGoogleMutation, SignInWithGoogleMutationVariables>;
export const MyDataExportsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyDataExports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myDataExports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DataExportFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DataExportFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DataExport"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"requestedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"sizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}}]}}]} as unknown as DocumentNode<MyDataExportsQuery, MyDataExportsQueryVariables>;
export const RequestDataExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestDataExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestDataExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"export"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DataExportFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DataExportFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DataExport"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"requestedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"sizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}}]}}]} as unknown as DocumentNode<RequestDataExportMutation, RequestDataExportMutationVariables>;
export const SyncPullDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SyncPull"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"syncPull"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"20"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"notes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SyncedNoteFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cards"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"revision"}},{"kind":"Field","name":{"kind":"Name","value":"content"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"liveNoteIds"}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SyncedNoteFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Note"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"viewerAccess"}},{"kind":"Field","name":{"kind":"Name","value":"draftRevision"}},{"kind":"Field","name":{"kind":"Name","value":"draftUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deletedAt"}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<SyncPullQuery, SyncPullQueryVariables>;
export const SyncPushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SyncPush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ops"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SyncOpInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"syncPush"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ops"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ops"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clientOpId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"noteId"}},{"kind":"Field","name":{"kind":"Name","value":"cardResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"revision"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"Field","name":{"kind":"Name","value":"conflictVersionId"}}]}}]}}]}}]} as unknown as DocumentNode<SyncPushMutation, SyncPushMutationVariables>;
export const SearchNotesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchNotes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"search"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}},{"kind":"Argument","name":{"kind":"Name","value":"scopes"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"NOTES"},{"kind":"EnumValue","value":"TOPICS"}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"15"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"notes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"snippet"}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"subject"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SearchNotesQuery, SearchNotesQueryVariables>;
export const RemoteNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RemoteNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UUID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SyncedNoteFields"}},{"kind":"Field","name":{"kind":"Name","value":"cards"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"revision"}},{"kind":"Field","name":{"kind":"Name","value":"content"}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SyncedNoteFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Note"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"viewerAccess"}},{"kind":"Field","name":{"kind":"Name","value":"draftRevision"}},{"kind":"Field","name":{"kind":"Name","value":"draftUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deletedAt"}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<RemoteNoteQuery, RemoteNoteQueryVariables>;