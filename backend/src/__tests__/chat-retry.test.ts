import { expect, test } from 'bun:test'
test('chat recovery and micro-USDC self-use settlement', () => {
 const result = Bun.spawnSync(['bun','test',new URL('./fixtures/chat-retry.fixture.ts',import.meta.url).pathname])
 if(result.exitCode) throw new Error(result.stderr.toString())
 expect(result.exitCode).toBe(0)
})
