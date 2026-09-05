import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { clearAuthSession, signAction } from './sign-action'

const wallet = '0x1111111111111111111111111111111111111111'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('signAction wallet session', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => clearAuthSession())

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearAuthSession()
  })

  test('coalesces concurrent actions into one wallet signature', async () => {
    let signCount = 0
    let verifyCount = 0
    const signMessageAsync = mock(async () => {
      signCount++
      return `signature-${signCount}`
    })

    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/auth/challenge')) {
        return jsonResponse({ nonce: 'nonce-1', message: 'ManyMe Sign-In\nNonce: nonce-1' })
      }
      verifyCount++
      return jsonResponse({ token: 'session-token', wallet, expiresAt: Math.floor(Date.now() / 1000) + 1800 })
    }) as unknown as typeof fetch

    const [first, second] = await Promise.all([
      signAction(signMessageAsync, wallet, 'chat-session'),
      signAction(signMessageAsync, wallet, 'rate-agent', 'agent-1'),
    ])

    expect(signCount).toBe(1)
    expect(verifyCount).toBe(1)
    expect(first).toEqual({ 'x-wallet-address': wallet, 'x-auth-token': 'session-token' })
    expect(second).toEqual(first)
  })

  test('re-signs once when the cached session disappeared after a server restart', async () => {
    let signCount = 0
    let validateCount = 0
    let loginCount = 0
    const signMessageAsync = mock(async () => {
      signCount++
      return `signature-${signCount}`
    })

    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/auth/session')) {
        validateCount++
        return jsonResponse({ error: 'Authentication session expired or is invalid' }, 401)
      }
      if (url.endsWith('/api/auth/challenge')) {
        loginCount++
        return jsonResponse({ nonce: `nonce-${loginCount}`, message: `ManyMe Sign-In\nNonce: nonce-${loginCount}` })
      }
      return jsonResponse({ token: `session-token-${loginCount}`, wallet, expiresAt: Math.floor(Date.now() / 1000) + 1800 })
    }) as unknown as typeof fetch

    await signAction(signMessageAsync, wallet, 'chat-session')
    const [refreshed, concurrent] = await Promise.all([
      signAction(signMessageAsync, wallet, 'stop-session', 'session-1'),
      signAction(signMessageAsync, wallet, 'rate-agent', 'agent-1'),
    ])

    expect(validateCount).toBe(1)
    expect(signCount).toBe(2)
    expect(loginCount).toBe(2)
    expect(refreshed['x-auth-token']).toBe('session-token-2')
    expect(concurrent).toEqual(refreshed)
  })
})
