import { expect, test } from 'bun:test'
import { formatUSDC, formatRate } from './utils'

test('one micro-USDC remains visible in fees and earnings', () => {
  expect(formatUSDC(1)).toBe('$0.000001')
  expect(formatRate(301)).toContain('0.000301')
})
