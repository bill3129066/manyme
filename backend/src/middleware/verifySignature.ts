import type { MiddlewareHandler } from 'hono'
import { authenticateSession } from '../services/auth/authService.js'

export type SignatureEnv = {
  Variables: {
    verifiedWallet: string
  }
}

/**
 * Hono middleware that verifies the short-lived wallet sign-in session.
 * The session is reusable across action routes, while its wallet binding
 * preserves the owner checks in each downstream service.
 */
export function requireSignature(action: string): MiddlewareHandler<SignatureEnv> {
  return async (c, next) => {
    const wallet = c.req.header('x-wallet-address')
    const token = c.req.header('x-auth-token') || extractBearerToken(c.req.header('authorization'))

    if (!wallet || !token) {
      return c.json({ error: `Authentication required for ${action}. Please sign in.` }, 401)
    }

    const verifiedWallet = authenticateSession(token, wallet)
    if (!verifiedWallet) {
      return c.json({ error: 'Authentication session expired or belongs to another wallet. Please sign in again.' }, 401)
    }

    c.set('verifiedWallet', verifiedWallet)
    await next()
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]
}
