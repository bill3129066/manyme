import { expect, test } from 'bun:test'
// Isolate route mocks from the proof relayer suite's module replacements.
test('session history matches chain settlement and wallet ownership', () => {
  const result = Bun.spawnSync(['bun', 'test', new URL('./fixtures/session-cost-routes.fixture.ts', import.meta.url).pathname])
  if (result.exitCode) throw new Error(result.stderr.toString())
  expect(result.exitCode).toBe(0)
})
