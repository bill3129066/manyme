import { createHash, randomBytes } from 'node:crypto'
import { verifyMessage } from 'viem'
import { config } from '../../config.js'

export const AUTH_CHALLENGE_TTL_SEC = 5 * 60
export const AUTH_SESSION_TTL_SEC = 30 * 60
export const AUTH_DOMAIN = process.env.AUTH_DOMAIN || 'localhost:3000'

export interface AuthChallenge {
  wallet: string
  domain: string
  chainId: number
  nonce: string
  issuedAt: number
  expiresAt: number
  message: string
}

export interface AuthSession {
  token: string
  wallet: string
  expiresAt: number
}

export interface AuthSessionInfo {
  wallet: string
  expiresAt: number
}

interface StoredChallenge extends Omit<AuthChallenge, 'message'> {}

interface StoredSession {
  wallet: string
  domain: string
  chainId: number
  expiresAt: number
}

const challenges = new Map<string, StoredChallenge>()
const sessions = new Map<string, StoredSession>()

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function normalizeWallet(wallet: string): string {
  const normalized = wallet.trim().toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
    throw new AuthError('Invalid wallet address', 400)
  }
  return normalized
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function purgeExpired(now: number): void {
  for (const [nonce, challenge] of challenges) {
    if (challenge.expiresAt <= now) challenges.delete(nonce)
  }
  for (const [tokenHash, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(tokenHash)
  }
}

export function buildAuthMessage(challenge: StoredChallenge): string {
  return [
    'ManyMe Sign-In',
    `Domain: ${challenge.domain}`,
    `Address: ${challenge.wallet}`,
    `Chain ID: ${challenge.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${new Date(challenge.issuedAt * 1000).toISOString()}`,
    `Expiration Time: ${new Date(challenge.expiresAt * 1000).toISOString()}`,
    `Session: ${AUTH_SESSION_TTL_SEC / 60} minutes after verification`,
    'Scope: chat, ratings, session records, agent management, and claiming your curator earnings',
    'On-chain payments and transfers still require separate wallet confirmation.',
  ].join('\n')
}

export function createAuthChallenge(wallet: string): AuthChallenge {
  const normalizedWallet = normalizeWallet(wallet)
  const issuedAt = nowSeconds()
  const expiresAt = issuedAt + AUTH_CHALLENGE_TTL_SEC
  const stored: StoredChallenge = {
    wallet: normalizedWallet,
    domain: AUTH_DOMAIN,
    chainId: config.chainId,
    nonce: randomBytes(16).toString('base64url'),
    issuedAt,
    expiresAt,
  }

  purgeExpired(issuedAt)
  challenges.set(stored.nonce, stored)

  return {
    ...stored,
    message: buildAuthMessage(stored),
  }
}

function takeChallenge(nonce: string): StoredChallenge | undefined {
  const challenge = challenges.get(nonce)
  // Delete before signature verification so two concurrent requests cannot
  // verify the same nonce and mint two sessions.
  if (challenge) challenges.delete(nonce)
  return challenge
}

export class AuthError extends Error {
  constructor(message: string, public readonly status: 400 | 401 = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function verifyAuthChallenge(
  wallet: string,
  nonce: string,
  signature: string,
): Promise<AuthSession> {
  const normalizedWallet = normalizeWallet(wallet)
  if (!nonce || nonce.length > 128 || !signature || signature.length > 256) {
    throw new AuthError('Invalid sign-in challenge response')
  }

  const challenge = takeChallenge(nonce)
  const now = nowSeconds()
  if (!challenge || challenge.expiresAt <= now) {
    throw new AuthError('Sign-in challenge expired or already used')
  }
  if (challenge.wallet !== normalizedWallet) {
    throw new AuthError('Sign-in challenge belongs to another wallet')
  }
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) {
    throw new AuthError('Invalid sign-in signature')
  }

  let valid = false
  try {
    valid = await verifyMessage({
      address: challenge.wallet as `0x${string}`,
      message: buildAuthMessage(challenge),
      signature: signature as `0x${string}`,
    })
  } catch {
    throw new AuthError('Invalid sign-in signature')
  }
  if (!valid) throw new AuthError('Invalid sign-in signature')

  purgeExpired(now)
  const token = randomBytes(32).toString('base64url')
  const expiresAt = now + AUTH_SESSION_TTL_SEC
  sessions.set(hashToken(token), {
    wallet: normalizedWallet,
    domain: AUTH_DOMAIN,
    chainId: config.chainId,
    expiresAt,
  })

  return { token, wallet: normalizedWallet, expiresAt }
}

/**
 * Validate the short-lived opaque token and bind it to the wallet claimed by
 * the request. Returning the stored wallet gives middleware one canonical
 * identity for downstream owner checks.
 */
export function getAuthSession(token: string | undefined, wallet: string | undefined): AuthSessionInfo | null {
  if (!token || !wallet) return null

  let normalizedWallet: string
  try {
    normalizedWallet = normalizeWallet(wallet)
  } catch {
    return null
  }

  const now = nowSeconds()
  purgeExpired(now)
  const tokenHash = hashToken(token)
  const session = sessions.get(tokenHash)
  if (!session || session.expiresAt <= now) {
    if (session) sessions.delete(tokenHash)
    return null
  }
  if (session.wallet !== normalizedWallet) return null
  if (session.domain !== AUTH_DOMAIN || session.chainId !== config.chainId) {
    sessions.delete(tokenHash)
    return null
  }
  return { wallet: session.wallet, expiresAt: session.expiresAt }
}

export function authenticateSession(token: string | undefined, wallet: string | undefined): string | null {
  return getAuthSession(token, wallet)?.wallet ?? null
}

/** Test seam; production state remains process-local and opaque. */
export function resetAuthStateForTests(): void {
  challenges.clear()
  sessions.clear()
}
