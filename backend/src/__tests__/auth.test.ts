import { beforeEach, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { privateKeyToAccount } from 'viem/accounts'
import { authRoutes } from '../api/auth.routes.js'
import { requireSignature, type SignatureEnv } from '../middleware/verifySignature.js'
import { AUTH_SESSION_TTL_SEC, resetAuthStateForTests } from '../services/auth/authService.js'

const account = privateKeyToAccount('0x0123456789012345678901234567890123456789012345678901234567890123')

function makeApp() {
  const app = new Hono<SignatureEnv>()
  app.route('/api/auth', authRoutes)
  app.post('/protected/first', requireSignature('first-action'), (c) => c.json({ wallet: c.get('verifiedWallet') }))
  app.post('/protected/second', requireSignature('second-action'), (c) => c.json({ wallet: c.get('verifiedWallet') }))
  return app
}

async function requestAuthToken(app: Hono<SignatureEnv>) {
  const challengeResponse = await app.request('/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: account.address }),
  })
  expect(challengeResponse.status).toBe(200)
  const challenge = await challengeResponse.json() as {
    wallet: string
    nonce: string
    message: string
    chainId: number
    expiresAt: number
  }

  expect(challenge.message).toContain('ManyMe Sign-In')
  expect(challenge.message).toContain('Domain: localhost:3000')
  expect(challenge.message).toContain(`Chain ID: ${challenge.chainId}`)
  expect(challenge.message).toContain(`Nonce: ${challenge.nonce}`)
  expect(challenge.message).toContain(`Expiration Time:`)
  expect(challenge.message).toContain('Session: 30 minutes after verification')
  expect(challenge.message).toContain('Scope: chat, ratings, session records, agent management, and claiming your curator earnings')

  const signature = await account.signMessage({ message: challenge.message })
  const verifyResponse = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: account.address, nonce: challenge.nonce, signature }),
  })
  expect(verifyResponse.status).toBe(200)
  const session = await verifyResponse.json() as { token: string; wallet: string; expiresAt: number }
  expect(session.token).toEqual(expect.any(String))
  expect(session.wallet.toLowerCase()).toBe(account.address.toLowerCase())
  expect(session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  return session.token
}

describe('wallet auth session', () => {
  beforeEach(() => resetAuthStateForTests())

  test('one wallet sign-in authorizes multiple action routes without another signature', async () => {
    const app = makeApp()
    const token = await requestAuthToken(app)
    const headers = { 'x-wallet-address': account.address, 'x-auth-token': token }

    const first = await app.request('/protected/first', { method: 'POST', headers })
    const second = await app.request('/protected/second', { method: 'POST', headers })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect((await first.json()).wallet).toBe(account.address.toLowerCase())
    expect((await second.json()).wallet).toBe(account.address.toLowerCase())
  })

  test('does not accept a reusable token with a different wallet', async () => {
    const app = makeApp()
    const token = await requestAuthToken(app)
    const response = await app.request('/protected/first', {
      method: 'POST',
      headers: { 'x-wallet-address': '0x1111111111111111111111111111111111111111', 'x-auth-token': token },
    })

    expect(response.status).toBe(401)
  })

  test('consumes a nonce after the first verification', async () => {
    const app = makeApp()
    const challengeResponse = await app.request('/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: account.address }),
    })
    const challenge = await challengeResponse.json() as { nonce: string; message: string }
    const signature = await account.signMessage({ message: challenge.message })
    const body = JSON.stringify({ wallet: account.address, nonce: challenge.nonce, signature })

    const first = await app.request('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const replay = await app.request('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(first.status).toBe(200)
    expect(replay.status).toBe(401)
  })

  test('rejects the old action signature shape without an auth session', async () => {
    const app = makeApp()
    const response = await app.request('/protected/first', {
      method: 'POST',
      headers: {
        'x-wallet-address': account.address,
        'x-signature': '0xdeadbeef',
        'x-timestamp': String(Math.floor(Date.now() / 1000)),
      },
    })

    expect(response.status).toBe(401)
  })

  test('expires the reusable session at its server-issued deadline', async () => {
    const app = makeApp()
    const token = await requestAuthToken(app)
    const headers = { 'x-wallet-address': account.address, 'x-auth-token': token }
    const currentNow = Date.now

    try {
      Date.now = () => currentNow()
      const beforeExpiry = await app.request('/protected/first', { method: 'POST', headers })
      expect(beforeExpiry.status).toBe(200)

      Date.now = () => currentNow() + (AUTH_SESSION_TTL_SEC + 1) * 1000
      const afterExpiry = await app.request('/protected/first', { method: 'POST', headers })
      expect(afterExpiry.status).toBe(401)
    } finally {
      Date.now = currentNow
    }
  })
})
