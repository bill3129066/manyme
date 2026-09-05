/// <reference types="bun-types" />
import { expect, test } from 'bun:test'
import { estimateSessionCost, parseCuratorRate } from './session-cost'
const snapshot = { accrued: 500000, checkpointAt: 100, proofExpiresAt: 110, deposit: 1000000 }
test('live estimate advances between proof updates, then stops at proof expiry', () => {
  expect(estimateSessionCost(snapshot, 10000, 'active', 100.5)).toBe(505000)
  expect(estimateSessionCost(snapshot, 10000, 'active', 101)).toBe(510000)
  expect(estimateSessionCost(snapshot, 10000, 'active', 120)).toBe(600000)
})
test('settled cost uses final chain amount and never exceeds deposit', () => {
  expect(estimateSessionCost(snapshot, 10000, 'stopped', 110)).toBe(500000)
  expect(estimateSessionCost({...snapshot,deposit:520000},10000,'active',110)).toBe(520000)
})
test('curator price uses USDC decimals, rejects invalid amounts, allows explicit zero', () => {
  expect(parseCuratorRate('0.0097')).toBe(9700)
  expect(parseCuratorRate('0')).toBe(0)
  for(const value of ['', '-1', '0.0000001', 'NaN']) expect(()=>parseCuratorRate(value)).toThrow()
})
