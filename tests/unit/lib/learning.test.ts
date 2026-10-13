/**
 * The phone's learning-event sender (lvn-backend ADR-0067): nothing signed out; events go to the SQLite outbox;
 * a batch is sent with the device time zone and leaves the outbox once answered; kept when the phone is offline or
 * the batch is refused for now.
 */
const mockSession = { status: 'signed-in' as 'signed-in' | 'signed-out' }
jest.mock('@/lib/auth/session', () => ({ getSession: () => mockSession, subscribeSession: () => () => undefined }))
const mockOutbox: { id: string }[] = []
jest.mock('@/features/notes/store/db', () => ({
  queueLearningEvent: jest.fn(async (e: { id: string }) => (mockOutbox.push(e), mockOutbox.length)),
  waitingLearningEvents: jest.fn(async (limit: number) => mockOutbox.slice(0, limit)),
  removeLearningEvents: jest.fn(async (ids: string[]) => {
    for (const id of ids) mockOutbox.splice(mockOutbox.findIndex((e) => e.id === id), 1)
  }),
}))
const mockAuthFetch = jest.fn()
jest.mock('@/lib/apollo', () => ({ authFetch: (...args: unknown[]) => mockAuthFetch(...args) }))

import { flush, track, watchTimeZone } from '@/lib/learning'

const answered = (body: unknown) => ({ json: async () => body })

beforeEach(() => {
  mockOutbox.length = 0
  mockSession.status = 'signed-in'
  mockAuthFetch.mockReset()
  mockAuthFetch.mockImplementation(async (_url: string, init: { body: string }) => {
    const n = (JSON.parse(init.body) as { variables: { input: { events: unknown[] } } }).variables.input.events.length
    return answered({ data: { trackEvents: { accepted: n, duplicates: 0, rejected: [], userErrors: [] } } })
  })
})

it('records nothing signed out', async () => {
  mockSession.status = 'signed-out'
  await track('NOTE_OPENED', { entityType: 'NOTE', entityId: 'n1' })
  expect(mockOutbox).toEqual([])
})

it('keeps events in the outbox and sends them in a batch with the time zone', async () => {
  await track('NOTE_OPENED', { entityType: 'NOTE', entityId: 'n1' })
  await track('TIME_SPENT', { entityType: 'NOTE', entityId: 'n1', durationMs: 42_000, metadata: { activity: 'READING' } })
  expect(mockOutbox).toHaveLength(2)
  await flush()
  expect(mockAuthFetch).toHaveBeenCalledTimes(1)
  const input = (JSON.parse(mockAuthFetch.mock.calls[0][1].body) as { variables: { input: { events: { type: string; platform: string; id: string }[]; timeZone: string } } }).variables.input
  expect(input.events.map((e) => e.type)).toEqual(['NOTE_OPENED', 'TIME_SPENT'])
  expect(input.events[0]!.platform).toMatch(/^(ANDROID|IOS)$/)
  expect(input.events[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
  expect(input.timeZone).toBeTruthy()
  expect(mockOutbox).toEqual([])
})

it('keeps the events when the phone is offline, and sends them later', async () => {
  mockAuthFetch.mockRejectedValueOnce(new TypeError('Network request failed'))
  await track('NOTE_OPENED', { entityId: 'n1' })
  await flush()
  expect(mockOutbox).toHaveLength(1)
  await flush()
  expect(mockOutbox).toEqual([])
})

it('keeps a batch refused for now', async () => {
  mockAuthFetch.mockResolvedValueOnce(answered({ data: { trackEvents: { accepted: 0, duplicates: 0, rejected: [], userErrors: [{ message: 'Too many', code: 'RATE_LIMITED' }] } } }))
  await track('NOTE_OPENED', { entityId: 'n1' })
  await flush()
  expect(mockOutbox).toHaveLength(1)
})

it('tells the server the phone’s time zone once someone is signed in, once per zone (ADR-0070)', async () => {
  mockAuthFetch.mockImplementation(async () => answered({ data: { setLearningTimeZone: { ok: true } } }))
  const stop = watchTimeZone()
  await new Promise((r) => setTimeout(r, 0))
  expect(mockAuthFetch).toHaveBeenCalledTimes(1)
  const sent = JSON.parse(mockAuthFetch.mock.calls[0][1].body) as { query: string; variables: { input: { timeZone: string } } }
  expect(sent.query).toContain('setLearningTimeZone')
  expect(sent.variables.input.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  stop()
  watchTimeZone()
  await new Promise((r) => setTimeout(r, 0))
  expect(mockAuthFetch).toHaveBeenCalledTimes(1)
})
