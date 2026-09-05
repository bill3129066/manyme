import type { Context, MiddlewareHandler, Next } from 'hono'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import {
  decodePaymentResponseHeader,
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
} from '@x402/core/http'
import type { PaymentPayload, PaymentRequired, SettleResponse } from '@x402/core/types'
import { getDb } from '../../db/client.js'
import { randomUUID } from 'crypto'
import { config } from '../../config.js'
import { parseUnits, formatUnits } from 'viem'

export interface PriceConfig {
  amount: string
  asset: 'USDC'
  network: 'base' | 'base-sepolia'
}

export const QUERY_PRICES: Record<string, PriceConfig> = {
  '/queries/agent/:id/summary': { amount: '0.001', asset: 'USDC', network: 'base-sepolia' },
  '/queries/agent/:id/ask': { amount: '0.003', asset: 'USDC', network: 'base-sepolia' },
  '/queries/agent/:id/evidence': { amount: '0.005', asset: 'USDC', network: 'base-sepolia' },
}

const CAIP2_NETWORKS: Record<PriceConfig['network'], `eip155:${number}`> = {
  'base': 'eip155:8453',
  'base-sepolia': 'eip155:84532',
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE'
const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE'

function getAtomicAmount(amount: string): string {
  return parseUnits(amount, 6).toString()
}

function getPaymentRequirements(price: PriceConfig) {
  return {
    amount: getAtomicAmount(price.amount),
    asset: config.usdcAddress,
    extra: {
      name: 'USDC',
      version: '2',
    },
  }
}

function hasPlatformWallet(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(config.platformWallet)
    && config.platformWallet.toLowerCase() !== ZERO_ADDRESS
}

// Shared resource server: verifies and settles payments via the facilitator
let resourceServer: x402ResourceServer | null = null
function getResourceServer(): x402ResourceServer {
  if (!resourceServer) {
    const facilitator = new HTTPFacilitatorClient({ url: config.x402FacilitatorUrl })
    resourceServer = new x402ResourceServer(facilitator)
      .register('eip155:84532', new ExactEvmScheme())
      .register('eip155:8453', new ExactEvmScheme())
  }
  return resourceServer
}

function logSale(
  c: Context,
  price: PriceConfig,
  settlement: SettleResponse,
  paymentPayload?: PaymentPayload,
) {
  try {
    if (!settlement.success) return

    const db = getDb()
    // agents.id is a UUID string — keep it verbatim or the FK check fails
    const agentId = c.req.param('id') || ''
    const payerAddress = settlement.payer || extractPayer(paymentPayload) || 'unknown'
    const amount = settlement.amount || paymentPayload?.accepted.amount || getAtomicAmount(price.amount)
    db.prepare(`
      INSERT INTO query_sales (id, agent_id, route, payer_address, amount_usdc, receipt_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      randomUUID(),
      agentId,
      c.req.path,
      payerAddress,
      formatUnits(BigInt(amount),6),
      settlement.transaction || null,
    )
  } catch (e) {
    console.error('[x402] Failed to record query sale:', e)
  }
}

/** Best-effort payer extraction from a decoded x402 payment payload. */
function extractPayer(paymentPayload?: PaymentPayload): string | undefined {
  const payload = paymentPayload?.payload
  if (!payload || typeof payload !== 'object') return undefined

  const authorization = (payload as Record<string, unknown>).authorization
  if (authorization && typeof authorization === 'object') {
    const payer = (authorization as Record<string, unknown>).from
    if (typeof payer === 'string' && payer) return payer
  }

  const permit2Authorization = (payload as Record<string, unknown>).permit2Authorization
  if (permit2Authorization && typeof permit2Authorization === 'object') {
    const payer = (permit2Authorization as Record<string, unknown>).from
    if (typeof payer === 'string' && payer) return payer
  }

  const payer = (payload as Record<string, unknown>).from
  return typeof payer === 'string' && payer ? payer : undefined
}

function extractPaymentPayload(c: Context): PaymentPayload | undefined {
  const header = c.req.header(PAYMENT_SIGNATURE_HEADER)
  if (!header) return undefined

  try {
    return decodePaymentSignatureHeader(header)
  } catch {
    return undefined
  }
}

function recordSettlementFromResponse(
  c: Context,
  price: PriceConfig,
  response: Response | undefined,
  paymentPayload?: PaymentPayload,
): void {
  const header = response?.headers.get(PAYMENT_RESPONSE_HEADER)
  if (!header) return

  try {
    const settlement = decodePaymentResponseHeader(header)
    if (settlement.success) logSale(c, price, settlement, paymentPayload)
  } catch (error) {
    console.error('[x402] Failed to decode settlement response:', error)
  }
}

/**
 * Real x402 middleware: 402 challenge + facilitator verify/settle.
 * The '*' route pattern is used because this middleware is attached per-route,
 * so whatever path reaches it is the protected resource.
 */
function realX402Middleware(price: PriceConfig): MiddlewareHandler {
  const payment = getPaymentRequirements(price)
  const gate = paymentMiddleware(
    {
      '*': {
        accepts: {
          scheme: 'exact',
          price: payment,
          network: CAIP2_NETWORKS[price.network],
          payTo: config.platformWallet as `0x${string}`,
          maxTimeoutSeconds: 300,
        },
        description: `Pay ${price.amount} ${price.asset} to access this analysis`,
      },
    },
    getResourceServer(),
  )

  return async (c: Context, next: Next) => {
    const paymentPayload = extractPaymentPayload(c)
    const gateResult = await gate(c, async () => {
      await next()
    })
    const response = c.res || (gateResult instanceof Response ? gateResult : undefined)
    recordSettlementFromResponse(c, price, response, paymentPayload)
    return gateResult
  }
}

/** Mock middleware (X402_MOCK=true): accepts any non-empty payment header. */
function mockX402Middleware(price: PriceConfig): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const paymentHeader = c.req.header(PAYMENT_SIGNATURE_HEADER) || c.req.header('X-PAYMENT')

    if (!paymentHeader) {
      const paymentRequired: PaymentRequired = {
        x402Version: 2,
        resource: {
          url: c.req.url,
          description: `Pay ${price.amount} ${price.asset} to access this analysis`,
          mimeType: 'application/json',
        },
        accepts: [{
          scheme: 'exact',
          network: CAIP2_NETWORKS[price.network],
          amount: getAtomicAmount(price.amount),
          payTo: config.platformWallet || ZERO_ADDRESS,
          maxTimeoutSeconds: 300,
          asset: config.usdcAddress,
          extra: { name: 'USDC', version: '2' },
        }],
      }
      c.header('PAYMENT-REQUIRED', encodePaymentRequiredHeader(paymentRequired))
      return c.json({ error: 'Payment Required' }, 402)
    }

    await next()
  }
}

function unavailableX402Middleware(): MiddlewareHandler {
  return async (c: Context) => c.json({
    error: 'x402 payments are unavailable',
    message: 'PLATFORM_WALLET must be configured for real x402 payments',
  }, 503)
}

export function x402Middleware(price: PriceConfig): MiddlewareHandler {
  if (config.x402Mock) return mockX402Middleware(price)

  if (!hasPlatformWallet()) return unavailableX402Middleware()
  return realX402Middleware(price)
}
