import { expect, test } from 'bun:test'
test('registration reads the fee from the confirmed block, not a lagging latest block', () => {
  const result = Bun.spawnSync(['bun', 'test', new URL('./fixtures/registration-rate.fixture.ts', import.meta.url).pathname])
  if (result.exitCode) throw new Error(result.stderr.toString())
  expect(result.exitCode).toBe(0)
})
