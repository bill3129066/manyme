export interface SignedHeaders {
  'x-wallet-address': string
  'x-auth-token': string
}

interface AuthSession {
  token: string
  wallet: string
  expiresAt: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const SESSION_STORAGE_PREFIX = 'manyme.auth-session:'
const REFRESH_SKEW_SEC = 30
const cachedSessions = new Map<string, AuthSession>()
const pendingSessions = new Map<string, Promise<AuthSession>>()

function walletKey(wallet: string): string {
  return wallet.toLowerCase()
}

function readStoredSession(wallet: string): AuthSession | undefined {
  const key = walletKey(wallet)
  const cached = cachedSessions.get(key)
  if (cached) return cached
  if (typeof window === 'undefined') return undefined

  try {
    const raw = window.sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}${key}`)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.wallet !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      walletKey(parsed.wallet) !== key
    ) {
      window.sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}${key}`)
      return undefined
    }
    cachedSessions.set(key, parsed as AuthSession)
    return parsed as AuthSession
  } catch {
    return undefined
  }
}

function storeSession(session: AuthSession): void {
  const key = walletKey(session.wallet)
  cachedSessions.set(key, session)
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}${key}`, JSON.stringify(session))
  } catch {
    // The in-memory cache still covers the current page when storage is unavailable.
  }
}

async function signIn(
  signMessageAsync: (args: { message: string }) => Promise<string>,
  wallet: string,
): Promise<AuthSession> {
  const key = walletKey(wallet)
  const pending = pendingSessions.get(key)
  if (pending) return pending

  const promise = (async () => {
    const now = Math.floor(Date.now() / 1000)
    const cached = readStoredSession(wallet)
    if (cached && cached.expiresAt > now + REFRESH_SKEW_SEC) {
      const response = await fetch(`${API_BASE}/api/auth/session`, {
        headers: { 'x-wallet-address': wallet, 'x-auth-token': cached.token },
      }).catch(() => undefined)
      if (!response || response.ok) return cached
      if (response.status !== 401) return cached
      clearAuthSession(wallet)
    }

    const challengeResponse = await fetch(`${API_BASE}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
    })
    const challengeBody = await challengeResponse.json().catch(() => ({})) as {
      message?: unknown
      nonce?: unknown
      error?: unknown
    }
    if (!challengeResponse.ok || typeof challengeBody.message !== 'string' || typeof challengeBody.nonce !== 'string') {
      throw new Error(typeof challengeBody.error === 'string' ? challengeBody.error : 'Failed to start wallet sign-in')
    }

    const signature = await signMessageAsync({ message: challengeBody.message })
    const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, nonce: challengeBody.nonce, signature }),
    })
    const sessionBody = await verifyResponse.json().catch(() => ({})) as Partial<AuthSession> & { error?: unknown }
    if (
      !verifyResponse.ok ||
      typeof sessionBody.token !== 'string' ||
      typeof sessionBody.wallet !== 'string' ||
      typeof sessionBody.expiresAt !== 'number'
    ) {
      throw new Error(typeof sessionBody.error === 'string' ? sessionBody.error : 'Failed to complete wallet sign-in')
    }
    if (walletKey(sessionBody.wallet) !== key) {
      throw new Error('Wallet sign-in returned a different wallet')
    }

    const session = sessionBody as AuthSession
    storeSession(session)
    return session
  })()

  pendingSessions.set(key, promise)
  try {
    return await promise
  } finally {
    pendingSessions.delete(key)
  }
}

/** Clear the cached session after a wallet disconnect or an explicit sign-out. */
export function clearAuthSession(wallet?: string): void {
  if (!wallet) {
    cachedSessions.clear()
    if (typeof window !== 'undefined') {
      try {
        for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
          const key = window.sessionStorage.key(i)
          if (key?.startsWith(SESSION_STORAGE_PREFIX)) window.sessionStorage.removeItem(key)
        }
      } catch {
        // Ignore storage errors while clearing the in-memory state.
      }
    }
    return
  }

  const key = walletKey(wallet)
  cachedSessions.delete(key)
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}${key}`) } catch { /* ignore */ }
  }
}

export async function signAction(
  signMessageAsync: (args: { message: string }) => Promise<string>,
  wallet: string,
  _action: string,
  _resourceId?: string,
): Promise<SignedHeaders> {
  const session = await signIn(signMessageAsync, wallet)
  return {
    'x-wallet-address': wallet,
    'x-auth-token': session.token,
  }
}
