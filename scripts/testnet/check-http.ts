// Run against ./run.bash: bun scripts/testnet/check-http.ts
import assert from 'node:assert/strict'

const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
  const requested = ['content-type', 'payment-signature', 'access-control-expose-headers']
  const response = await fetch(`${api}/queries/agent/test/evidence`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': requested.join(','),
    },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), origin)
  const allowed = response.headers.get('access-control-allow-headers')?.toLowerCase().split(',').map(value => value.trim()) || []
  for (const header of requested) assert(allowed.includes(header), `x402 preflight rejects ${header}`)
}
console.log('PASS: x402 SDK payment headers are allowed on both local origins')
