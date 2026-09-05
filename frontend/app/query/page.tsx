'use client'
import { useState, useEffect } from 'react'
import { useAccount, useConfig, useSwitchChain } from 'wagmi'
import { prepareBaseWallet } from '@/lib/prepare-wallet'
import { fetchAgents } from '@/lib/api'
import { displayError } from '@/lib/presentation'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
// Explicit opt-in for local development. Real x402 is the default.
const X402_MOCK = process.env.NEXT_PUBLIC_X402_MOCK === 'true'
const BASE_SEPOLIA_CHAIN_ID = 84532

interface PaymentRequirement {
  amount?: string
  maxAmountRequired?: string
  network?: string
  payTo?: string
  asset?: string
}

interface PaymentRequiredInfo {
  x402Version?: number
  error?: string
  accepts?: PaymentRequirement[]
  resource?: { url?: string; description?: string }
}

function decodeBase64Json(value: string): unknown {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

function parsePaymentRequired(response: Response, body: unknown): PaymentRequiredInfo {
  const header = response.headers.get('PAYMENT-REQUIRED')
  if (header) {
    try {
      const decoded = decodeBase64Json(header)
      if (
        decoded &&
        typeof decoded === 'object' &&
        Array.isArray((decoded as PaymentRequiredInfo).accepts)
      ) {
        return decoded as PaymentRequiredInfo
      }
    } catch {
      // Fall through to the v1 body shape so an older gateway can still be diagnosed.
    }
  }

  if (body && typeof body === 'object' && Array.isArray((body as PaymentRequiredInfo).accepts)) {
    return body as PaymentRequiredInfo
  }

  throw new Error('The payment challenge was missing or malformed. 再試一次.')
}

function formatAtomicUsdc(amount: string | undefined, fallback: string): string {
  if (!amount || !/^\d+$/.test(amount)) return fallback

  const value = BigInt(amount)
  const whole = value / 1_000_000n
  const fraction = (value % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return `$${whole.toString()}${fraction ? `.${fraction}` : ''}`
}

function getResponseError(body: unknown, response: Response): string {
  const settlementHeader = response.headers.get('PAYMENT-RESPONSE')
  if (settlementHeader) {
    try {
      const settlement = decodeBase64Json(settlementHeader) as {
        errorMessage?: string
        errorReason?: string
      }
      if (settlement.errorMessage || settlement.errorReason) {
        return settlement.errorMessage || settlement.errorReason || 'Payment settlement failed.'
      }
    } catch {
      // Fall through to the response body.
    }
  }

  if (body && typeof body === 'object') {
    const payload = body as { error?: unknown; message?: unknown }
    if (typeof payload.message === 'string' && payload.message) return payload.message
    if (typeof payload.error === 'string' && payload.error) return payload.error
  }

  return `The request failed (${response.status}). 再試一次.`
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null)
}

const QUERY_TYPES = [
  { id: 'summary', label: '服務摘要', price: '$0.001', description: '取得最近的分析摘要' },
  { id: 'ask', label: '單次提問', price: '$0.003', description: '針對一個具體問題取得回覆' },
  { id: 'evidence', label: '活動證明', price: '$0.005', description: '取得完整活動證明資料' },
]

export default function QueryPage() {
  const { address, chainId } = useAccount()
  const config = useConfig()
  const { switchChain } = useSwitchChain()
  const [agents, setAgents] = useState<any[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [queryType, setQueryType] = useState('summary')
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<
    'idle' | 'requesting' | 'requires-payment' | 'paying' | 'paid' | 'error'
  >('idle')
  const [result, setResult] = useState<any>(null)
  const [paymentTx, setPaymentTx] = useState<string | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentRequiredInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedQueryType = QUERY_TYPES.find((q) => q.id === queryType)!
  const selectedPayment = paymentInfo?.accepts?.[0]
  const paymentAmount = formatAtomicUsdc(
    selectedPayment?.amount || selectedPayment?.maxAmountRequired,
    selectedQueryType.price,
  )
  const paymentNetwork =
    selectedPayment?.network === 'eip155:84532' || selectedPayment?.network === 'base-sepolia'
      ? 'Base Sepolia'
      : selectedPayment?.network || 'Base Sepolia'
  const walletReady = Boolean(address)
  const wrongNetwork = Boolean(address && chainId !== BASE_SEPOLIA_CHAIN_ID)

  useEffect(() => {
    fetchAgents()
      .then((list) => {
        setAgents(list)
        if (list.length > 0) setSelectedAgent(list[0].id)
      })
      .catch((e: any) => setError(displayError(e)))
      .finally(() => setLoadingAgents(false))
  }, [])

  const handleQuery = async () => {
    if (!selectedAgent) return

    setState('requesting')
    setResult(null)
    setPaymentTx(null)
    setPaymentInfo(null)
    setError(null)

    const url = `${API_BASE}/queries/agent/${selectedAgent}/${queryType}`
    try {
      const res = await fetch(url, {
        method: queryType === 'ask' ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: queryType === 'ask' ? JSON.stringify({ question }) : undefined,
      })
      const body = await readJson(res)

      if (res.status === 402) {
        setPaymentInfo(parsePaymentRequired(res, body))
        setState('requires-payment')
        return
      }

      if (!res.ok) throw new Error(getResponseError(body, res))
      const receiptHeader = res.headers.get('PAYMENT-RESPONSE')
      if (receiptHeader) {
        const receipt = decodeBase64Json(receiptHeader) as {
          success?: boolean
          transaction?: string
        }
        if (!receipt.success) throw new Error('Payment settlement was not confirmed')
        setPaymentTx(receipt.transaction || null)
      } else if (!X402_MOCK) throw new Error('Payment receipt is missing')
      setResult(body)
      setState('paid')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start the query. 再試一次.')
      setState('error')
    }
  }

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: BASE_SEPOLIA_CHAIN_ID })
      setError(null)
    } catch (e) {
      setError(displayError(e, '切換網路未完成，請從錢包切換至 Base Sepolia。'))
    }
  }

  const handlePay = async () => {
    if (!X402_MOCK && !walletReady) {
      setError('請先連接錢包，再確認付款。')
      setState('requires-payment')
      return
    }
    if (!X402_MOCK && wrongNetwork) {
      setError('請先將錢包切換至 Base Sepolia，再確認付款。')
      setState('requires-payment')
      return
    }

    setState('paying')
    setError(null)

    const url = `${API_BASE}/queries/agent/${selectedAgent}/${queryType}`
    const init: RequestInit = {
      method: queryType === 'ask' ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: queryType === 'ask' ? JSON.stringify({ question }) : undefined,
    }

    try {
      let res: Response
      if (!X402_MOCK && address) {
        const walletClient = await prepareBaseWallet(config)
        // Real x402: the SDK signs the EIP-3009 authorization and retries with PAYMENT-SIGNATURE.
        const [{ wrapFetchWithPaymentFromConfig }, { ExactEvmScheme }] = await Promise.all([
          import('@x402/fetch'),
          import('@x402/evm/exact/client'),
        ])
        const account = walletClient.account
        const signer = {
          address: account.address,
          signTypedData: (msg: any) => walletClient.signTypedData({ ...msg, account }),
        }
        const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
          schemes: [{ network: 'eip155:84532', client: new ExactEvmScheme(signer) }],
        })
        res = await fetchWithPayment(url, init)
      } else {
        await new Promise((r) => setTimeout(r, 1500))
        res = await fetch(url, {
          ...init,
          headers: { ...init.headers, 'PAYMENT-SIGNATURE': `mock-payment-${Date.now()}` },
        })
      }

      const body = await readJson(res)
      if (res.status === 402) {
        setPaymentInfo(parsePaymentRequired(res, body))
        throw new Error('The payment was not accepted. Review the challenge and try again.')
      }
      if (!res.ok) throw new Error(getResponseError(body, res))

      const receiptHeader = res.headers.get('PAYMENT-RESPONSE')
      if (receiptHeader) {
        const receipt = decodeBase64Json(receiptHeader) as {
          success?: boolean
          transaction?: string
        }
        if (!receipt.success) throw new Error('Payment settlement was not confirmed')
        setPaymentTx(receipt.transaction || null)
      } else if (!X402_MOCK) throw new Error('Payment receipt is missing')
      setResult(body)
      setState('paid')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to complete the payment. 再試一次.')
      setState('error')
    }
  }

  return (
    <div className="app-legacy">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-4xl leading-none mb-6">單次查詢</h1>
        <p className="font-display italic text-2xl text-text-secondary mb-16">
          選一份服務，按次付費取得摘要、回覆或活動證明。
        </p>

        {error && state !== 'error' && (
          <div className="flex items-center justify-between border border-error/30 bg-error/5 px-6 py-3 mb-8">
            <p className="text-error text-sm">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-error hover:text-text-primary text-sm transition-colors"
            >
              &times;
            </button>
          </div>
        )}

        <div className="border border-border-subtle bg-surface-elevated p-8 mb-12">
          <label
            htmlFor="agent-select"
            className="block text-xs uppercase tracking-widest text-text-secondary mb-4"
          >
            選擇服務
          </label>
          {loadingAgents ? (
            <div className="animate-pulse h-12 bg-surface-dim w-full border border-border-subtle" />
          ) : (
            <select
              id="agent-select"
              value={selectedAgent}
              onChange={(e) => {
                setSelectedAgent(e.target.value)
                setState('idle')
                setResult(null)
                setPaymentInfo(null)
                setError(null)
              }}
              className="w-full bg-surface-dim border border-border-subtle px-4 py-3 text-text-primary outline-none focus:border-accent font-sans cursor-pointer"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-12">
          <h2 className="text-xs uppercase tracking-widest text-text-secondary mb-4">
            這次想查什麼？
          </h2>
          <div className="flex flex-col border border-border-subtle bg-surface-elevated divide-y divide-border-subtle">
            {QUERY_TYPES.map((qt) => (
              <button
                key={qt.id}
                aria-pressed={queryType === qt.id}
                type="button"
                onClick={() => {
                  setQueryType(qt.id)
                  setState('idle')
                  setResult(null)
                  setPaymentInfo(null)
                  setError(null)
                }}
                className={`p-6 text-left transition-all ${
                  queryType === qt.id
                    ? 'bg-accent/10 ring-1 ring-inset ring-accent'
                    : 'hover:bg-surface-dim'
                }`}
              >
                <div className="flex justify-between items-baseline mb-2">
                  <div className="font-display font-bold text-2xl text-text-primary">
                    {qt.label}
                  </div>
                  <div className="text-accent font-mono font-bold">{qt.price}</div>
                </div>
                <div className="text-text-secondary">{qt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {queryType === 'ask' && (
          <div className="mb-12">
            <label
              htmlFor="question-input"
              className="block text-xs uppercase tracking-widest text-text-secondary mb-4"
            >
              你的問題
            </label>
            <input
              id="question-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="說明這次想釐清的問題…"
              className="w-full bg-surface-dim border border-border-subtle px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none font-sans"
            />
          </div>
        )}

        {state === 'idle' && (
          <button
            type="button"
            onClick={handleQuery}
            disabled={!selectedAgent || (queryType === 'ask' && !question.trim())}
            className="w-full bg-accent text-accent-foreground font-bold py-4 uppercase tracking-widest hover:bg-text-secondary transition-colors"
          >
            確認查詢費用 {selectedQueryType.price} →
          </button>
        )}

        {state === 'requesting' && (
          <div
            className="border border-border-subtle p-12 bg-surface-elevated text-center mt-8"
            role="status"
            aria-live="polite"
          >
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-text-secondary uppercase tracking-widest text-sm">
              正在確認本次付款資訊…
            </p>
          </div>
        )}

        {state === 'requires-payment' && paymentInfo && (
          <div className="border border-accent p-8 bg-surface-elevated mt-8">
            <div className="flex items-center gap-3 mb-8 border-b border-border-subtle pb-4">
              <div className="w-3 h-3 bg-warning" />
              <span className="font-bold uppercase tracking-widest text-sm text-text-primary">
                確認本次付款
              </span>
            </div>
            <div className="space-y-4 text-sm mb-8">
              <div className="flex justify-between py-2 border-b border-border-subtle">
                <span className="text-text-secondary">金額</span>
                <span className="font-mono font-bold text-accent">{paymentAmount} USDC</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-subtle">
                <span className="text-text-secondary">網路</span>
                <span className="font-mono text-text-primary">{paymentNetwork}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-text-secondary">付款協定</span>
                <span className="font-mono text-text-primary">x402</span>
              </div>
            </div>
            {paymentInfo.error && (
              <p className="text-error text-sm mb-6" role="alert">
                {displayError(paymentInfo.error, '付款尚未被接受，請確認付款資訊。')}
              </p>
            )}
            {!X402_MOCK && !walletReady ? (
              <div className="border border-border-subtle bg-surface-dim p-6" role="status">
                <p className="text-text-secondary text-sm mb-4">
                  連接 Base Sepolia 錢包，再確認這次付款。
                </p>
                <ConnectWalletButton />
              </div>
            ) : !X402_MOCK && wrongNetwork ? (
              <div className="border border-warning/30 bg-warning/5 p-6" role="alert">
                <p className="text-text-secondary text-sm mb-4">
                  目前錢包網路不符，請切換到 Base Sepolia 再繼續。
                </p>
                <button
                  type="button"
                  onClick={handleSwitchNetwork}
                  className="w-full border border-border-strong text-text-primary font-bold py-3 uppercase tracking-widest hover:bg-surface-dim transition-colors"
                >
                  切換至 Base Sepolia
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePay}
                className="w-full bg-accent text-accent-foreground font-bold py-4 uppercase tracking-widest hover:bg-text-secondary transition-colors"
              >
                確認支付 {paymentAmount} USDC →
              </button>
            )}
          </div>
        )}

        {state === 'paying' && (
          <div className="border border-border-subtle p-12 bg-surface-elevated text-center mt-8">
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-text-secondary uppercase tracking-widest text-sm">
              正在確認 Base Sepolia 付款，請稍候…
            </p>
          </div>
        )}

        {state === 'paid' && result && (
          <div className="border border-accent/30 bg-surface-elevated p-8 mt-8">
            <div className="flex items-center gap-3 mb-8 border-b border-border-subtle pb-4">
              <div className="w-3 h-3 bg-accent" />
              <span className="font-bold uppercase tracking-widest text-sm text-accent">
                付款已確認，以下是查詢結果
              </span>
            </div>

            {result.summary && (
              <p className="text-text-primary text-lg leading-relaxed mb-6 font-display">
                {result.summary}
              </p>
            )}
            {result.answer && (
              <div className="mb-6">
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2">
                  你的問題：{result.question}
                </p>
                <p className="text-text-primary text-lg leading-relaxed font-display">
                  {result.answer}
                </p>
              </div>
            )}
            {result.proofs && (
              <div className="mb-6 bg-surface-dim p-6 border border-border-subtle">
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-4">
                  {result.proofCount} 筆活動證明
                </p>
                {result.proofs.slice(0, 3).map((p: any) => (
                  <div
                    key={p.seq || p.proofHash || Math.random()}
                    className="text-sm font-mono text-text-tertiary mb-2 pb-2 border-b border-border-subtle last:border-0 last:pb-0 last:mb-0"
                  >
                    <span className="text-text-secondary font-bold mr-4">#{p.seq}</span>
                    {p.proofHash?.slice(0, 32)}...
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-border-strong flex justify-between text-xs font-mono text-text-tertiary">
              <span>已支付： {result.pricePaid}</span>
              {paymentTx && (
                <a
                  className="underline"
                  href={`https://sepolia.basescan.org/tx/${paymentTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看付款交易
                </a>
              )}
              <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setState('idle')
                setResult(null)
                setPaymentInfo(null)
              }}
              className="mt-8 w-full border border-border-strong text-text-primary font-bold uppercase tracking-widest py-4 hover:bg-surface-dim transition-colors text-sm"
            >
              再查詢一次
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-error/5 border border-error/20 p-6 mt-8 flex justify-between items-center">
            <span className="text-error font-bold text-sm uppercase tracking-widest">
              {error || '這次查詢未完成，請稍後再試。'}
            </span>
            <button
              type="button"
              onClick={() => {
                setState('idle')
                setError(null)
              }}
              className="text-error underline text-sm uppercase tracking-widest font-bold hover:opacity-80"
            >
              再試一次
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
