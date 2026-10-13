import type { ResourceStatus, ResourceType } from '@/graphql/generated/graphql'

/** Words for resources on the phone (lvn-backend ADR-0074), the same as lvn-web's. */
export const TYPE_LABEL: Record<ResourceType, string> = { BOOK: 'Book', COURSE: 'Course', TOOL: 'Tool', SOFTWARE: 'Software', HARDWARE: 'Hardware', OTHER: 'Other' }

export const STATUS_LABEL: Record<ResourceStatus, string> = { PENDING: 'Waiting for moderators', APPROVED: 'In the catalogue', REJECTED: 'Not approved' }
