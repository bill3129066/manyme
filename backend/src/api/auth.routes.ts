import { Hono } from 'hono'
import {
  AuthError,
  createAuthChallenge,
  getAuthSession,
  verifyAuthChallenge,
} from '../services/auth/authService.js'

export const authRoutes = new Hono()

authRoutes.post('/challenge', async (c) => {
  let body: { wallet?: unknown }
  try {
    body = await c.req.json<{ wallet?: unknown }>()
  } catch {
    return c.json({ error: 'wallet is required' }, 400)
  }

  if (typeof body.wallet !== 'string') {
    return c.json({ error: 'wallet is required' }, 400)
  }

  try {
    return c.json(createAuthChallenge(body.wallet))
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: error.message }, error.status)
    throw error
  }
})

authRoutes.post('/verify', async (c) => {
  let body: { wallet?: unknown; nonce?: unknown; signature?: unknown }
  try {
    body = await c.req.json<{ wallet?: unknown; nonce?: unknown; signature?: unknown }>()
  } catch {
    return c.json({ error: 'wallet, nonce, and signature are required' }, 400)
  }

  if (
    typeof body.wallet !== 'string' ||
    typeof body.nonce !== 'string' ||
    typeof body.signature !== 'string'
  ) {
    return c.json({ error: 'wallet, nonce, and signature are required' }, 400)
  }

  try {
    const session = await verifyAuthChallenge(body.wallet, body.nonce, body.signature)
    return c.json(session)
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: error.message }, error.status)
    throw error
  }
})

// Lets a browser discard a token after a backend restart without asking the
// wallet to sign again until the server can issue a fresh session.
authRoutes.get('/session', (c) => {
  const wallet = c.req.header('x-wallet-address')
  const token = c.req.header('x-auth-token') || extractBearerToken(c.req.header('authorization'))
  const session = getAuthSession(token, wallet)
  if (!session) return c.json({ error: 'Authentication session expired or is invalid' }, 401)
  return c.json(session)
})

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]
}
