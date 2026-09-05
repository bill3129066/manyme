import { expect, test } from 'bun:test'
import { activityEntries } from './activity-trail'

test('merges received work and chain events in time order without duplicate steps', () => {
  const step = { kind: 'rpc', title: 'Tool call', body: 'search', ts: '2026-09-05T12:00:00Z' }
  const hash = `0x${'a'.repeat(64)}`
  const entries = activityEntries(
    [step, step],
    [{ seq: 1, proofHash: hash, txHash: hash, ts: '2026-09-05 12:00:01' }],
  )
  expect(entries).toHaveLength(2)
  expect(entries[0].url).toBe(`https://sepolia.basescan.org/tx/${hash}`)
  expect(entries[1].title).toBe('調用工具，接著查')
  expect(entries[1].detail).toBe('search')
})
test('does not invent a transaction link or events when no chain receipt is available', () => {
  expect(activityEntries([], [])).toEqual([])
  expect(
    activityEntries(
      [],
      [{ seq: 2, proofHash: 'digest', ts: 'invalid', txHash: 'not-a-transaction' }],
    )[0].url,
  ).toBeUndefined()
})
