'use client'
import { parseCuratorRate } from '@/lib/session-cost'
import { PLATFORM_FEE } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useEscrowActions } from '@/lib/escrow-actions'
import { createAgent as saveAgent, compressContent } from '@/lib/agents-api'
import { signAction } from '@/lib/sign-action'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { categoryLabel, displayError } from '@/lib/presentation'

/**
 * Parse SKILL.md frontmatter format
 */
function parseSkillMd(
  content: string,
): { name: string; description: string; systemPrompt: string } | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/)
  if (!fmMatch) return null

  const frontmatter = fmMatch[1]
  const body = fmMatch[2].trim()

  const nameMatch = frontmatter.match(/name:\s*(.+)/)
  const descMatch = frontmatter.match(/description:\s*(.+)/)

  return {
    name: nameMatch?.[1]?.trim() || '未命名服務',
    description: descMatch?.[1]?.trim() || '',
    systemPrompt: body.slice(0, 8000),
  }
}

export default function UploadAgentPage() {
  const escrow = useEscrowActions()
  const createAgent = async (data: any, auth: any) => {
    const registrationTxHash = await escrow.register(
      data.ratePerSecond || 0,
      data.metadataUri || data.name,
    )
    return saveAgent({ ...data, registrationTxHash }, auth)
  }
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'manual' | 'import'>('manual')

  // Manual form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'general',
    systemPrompt: '',
    userPromptTemplate: '',
    model: 'gemini-3.8-flash',
    temperature: '0.3',
    maxTokens: '1024',
    ratePerSecond: '0.0097',
    metadataUri: '',
  })
  const [models, setModels] = useState<{ id: string; label: string; preview: boolean }[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState('')
  async function loadModels() {
    setModelsLoading(true)
    setModelsError('')
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${api}/api/models`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load models')
      setModels(data.models)
      setForm((previous) => ({
        ...previous,
        model: data.models.some((model: any) => model.id === previous.model)
          ? previous.model
          : data.models[0].id,
      }))
    } catch (error: any) {
      setModelsError(displayError(error, '目前無法取得模型清單，請重新載入。'))
      setModels([])
    } finally {
      setModelsLoading(false)
    }
  }
  useEffect(() => {
    void loadModels()
  }, [])

  const [inputFields, setInputFields] = useState<
    { name: string; type: string; required: boolean }[]
  >([])

  // Import state
  const [skillMdContent, setSkillMdContent] = useState('')
  const [patternFiles, setPatternFiles] = useState<{ name: string; content: string }[]>([])
  const [importPreview, setImportPreview] = useState<{
    name: string
    description: string
    patterns: string[]
  } | null>(null)
  const [importCategory, setImportCategory] = useState('defi')
  const [importPrice, setImportPrice] = useState('0.0097')
  const [autoCompress, setAutoCompress] = useState(true)
  const [compressStatus, setCompressStatus] = useState('')

  const update =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const addInputField = () => {
    setInputFields((prev) => [...prev, { name: '', type: 'text', required: true }])
  }

  const updateField = (index: number, key: string, value: string | boolean) => {
    setInputFields((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)))
  }

  const removeField = (index: number) => {
    setInputFields((prev) => prev.filter((_, i) => i !== index))
  }

  const detectVariables = () => {
    const matches = form.userPromptTemplate.match(/\{\{(\w+)\}\}/g)
    if (!matches) return
    const vars = [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))]
    const existing = new Set(inputFields.map((f) => f.name))
    const newFields = vars
      .filter((v) => !existing.has(v))
      .map((v) => ({ name: v, type: 'text', required: true }))
    if (newFields.length > 0) setInputFields((prev) => [...prev, ...newFields])
  }

  const processImportedContent = (content: string, pFiles: { name: string; content: string }[]) => {
    setSkillMdContent(content)
    const parsed = parseSkillMd(content)
    if (parsed) {
      setImportPreview({
        name: parsed.name,
        description: parsed.description,
        patterns: pFiles.map((p) => p.name),
      })
    } else {
      setImportPreview(null)
    }
  }

  // Handle Directory Upload
  const handleDirectoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    let masterContent = ''
    const newPatterns: { name: string; content: string }[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name === 'SKILL.md') {
        masterContent = await file.text()
      } else if (file.webkitRelativePath.includes('/patterns/') && file.name.endsWith('.md')) {
        const content = await file.text()
        newPatterns.push({ name: file.name.replace('.md', ''), content })
      } else if (file.name.endsWith('.md') && file.name !== 'README.md') {
        // Fallback if not inside a strict "patterns/" folder but uploaded together
        const content = await file.text()
        newPatterns.push({ name: file.name.replace('.md', ''), content })
      }
    }

    setPatternFiles(newPatterns)
    if (masterContent) {
      processImportedContent(masterContent, newPatterns)
    } else {
      setError('資料夾根目錄需要包含 SKILL.md，請重新選擇。')
    }
  }

  // Submit manual form
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) {
      setError('請先連接錢包。')
      return
    }
    if (modelsLoading || !models.some((model) => model.id === form.model)) {
      setError('請選擇目前可用的 AI 模型。')
      return
    }
    if (!form.name || !form.description || !form.systemPrompt) {
      setError('請填寫服務名稱、介紹與引導方法。')
      return
    }
    setLoading(true)
    setError('')

    try {
      let inputSchemaJson: string | undefined
      if (inputFields.length > 0) {
        const schema: Record<string, unknown> = {
          type: 'object',
          properties: {} as Record<string, unknown>,
          required: inputFields.filter((f) => f.required).map((f) => f.name),
        }
        for (const field of inputFields) {
          ;(schema.properties as Record<string, unknown>)[field.name] = {
            type: field.type === 'number' ? 'number' : 'string',
          }
        }
        inputSchemaJson = JSON.stringify(schema)
      }

      // Auto-compress
      let systemPrompt = form.systemPrompt
      if (autoCompress && systemPrompt.length > 3000) {
        setCompressStatus('正在精簡引導內容…')
        const result = await compressContent(systemPrompt, 'skill')
        systemPrompt = result.content
        setCompressStatus(
          `Compression: ${result.original}B -> ${result.compressed}B (${result.ratio})`,
        )
      }

      await escrow.prepare()
      const auth = await signAction(signMessageAsync, address, 'create-agent')
      const created = await createAgent(
        {
          name: form.name,
          description: form.description,
          category: form.category,
          systemPrompt,
          rawSystemPrompt: systemPrompt !== form.systemPrompt ? form.systemPrompt : undefined,
          userPromptTemplate: form.userPromptTemplate || undefined,
          model: form.model,
          temperature: parseFloat(form.temperature),
          maxTokens: parseInt(form.maxTokens),
          ratePerSecond: parseCuratorRate(form.ratePerSecond),
          metadataUri: form.metadataUri || undefined,
          inputSchemaJson,
        },
        auth,
      )

      router.push(`/agents/${created.id}`)
    } catch (err: any) {
      setError(displayError(err, '上架尚未完成，請確認設定與錢包操作後再試。'))
    } finally {
      setLoading(false)
    }
  }

  // Submit import
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) {
      setError('請先連接錢包。')
      return
    }
    if (modelsLoading || !models.some((model) => model.id === form.model)) {
      setError('請選擇目前可用的 AI 模型。')
      return
    }

    const parsed = parseSkillMd(skillMdContent)
    if (!parsed) {
      setError('Invalid SKILL.md format. Must have --- frontmatter ---')
      return
    }

    setLoading(true)
    setError('')
    setCompressStatus('')

    try {
      // Auto-compress if enabled
      let masterPrompt = parsed.systemPrompt
      const processedPatterns = [...patternFiles]

      if (autoCompress && masterPrompt.length > 3000) {
        setCompressStatus('Compressing SKILL.md...')
        const result = await compressContent(masterPrompt, 'skill')
        masterPrompt = result.content
        setCompressStatus(
          `SKILL.md: ${result.original}B -> ${result.compressed}B (${result.ratio})`,
        )

        for (let i = 0; i < processedPatterns.length; i++) {
          if (processedPatterns[i].content.length > 2000) {
            setCompressStatus(`Compressing ${processedPatterns[i].name}...`)
            const pr = await compressContent(processedPatterns[i].content, 'pattern')
            processedPatterns[i] = { ...processedPatterns[i], content: pr.content }
          }
        }
        setCompressStatus('Compression complete. Deploying...')
      }

      await escrow.prepare()
      const auth = await signAction(signMessageAsync, address, 'create-agent')
      let createdAgentId = ''

      // Create master agent from SKILL.md
      const created = await createAgent(
        {
          name: parsed.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          description: parsed.description,
          category: importCategory,
          systemPrompt: masterPrompt,
          rawSystemPrompt: parsed.systemPrompt,
          userPromptTemplate:
            'Analyze: {{query}}\n\nChain: {{chain}}\nTarget address (if any): {{address}}',
          model: form.model,
          temperature: 0.2,
          maxTokens: 2048,
          ratePerSecond: parseCuratorRate(importPrice),
          metadataUri: form.metadataUri || undefined,
          inputSchemaJson: JSON.stringify({
            type: 'object',
            properties: {
              query: { type: 'string' },
              chain: { type: 'string' },
              address: { type: 'string' },
            },
            required: ['query'],
          }),
        },
        auth,
      )
      createdAgentId = created.id

      // Create individual pattern agents
      for (let i = 0; i < processedPatterns.length; i++) {
        const pattern = processedPatterns[i]
        const originalPattern = patternFiles[i]
        await escrow.prepare()
        const patternAuth = await signAction(signMessageAsync, address, 'create-agent')
        const patternName = pattern.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

        await createAgent(
          {
            name: patternName,
            description: `${patternName} — sub-agent from ${parsed.name}`,
            category: importCategory,
            systemPrompt: pattern.content.slice(0, 8000),
            rawSystemPrompt: originalPattern?.content,
            userPromptTemplate: '{{query}}\n\nTarget: {{address}}\nChain: {{chain}}',
            model: form.model,
            temperature: 0.2,
            maxTokens: 2048,
            ratePerSecond: parseCuratorRate(importPrice),
            inputSchemaJson: JSON.stringify({
              type: 'object',
              properties: {
                query: { type: 'string' },
                address: { type: 'string' },
                chain: { type: 'string' },
              },
              required: ['query'],
            }),
          },
          patternAuth,
        )
      }

      router.push(`/agents/${createdAgentId}`)
    } catch (err: any) {
      setError(displayError(err, '上架尚未完成，請確認設定與錢包操作後再試。'))
    } finally {
      setLoading(false)
    }
  }

  const categories = ['general', 'research', 'defi', 'trading', 'nft', 'security']
  const pricePreview = (value: string) => (
    <p className="field-hint">
      你每秒收入 {Number(value || 0).toFixed(6)} USDC，加上平台費 {(PLATFORM_FEE / 1e6).toFixed(6)}{' '}
      USDC，使用者每秒合計 {(Number(value || 0) + PLATFORM_FEE / 1e6).toFixed(6)} USDC。
      {Number(value) === 0 && '你的費率為零時，這份服務不會產生可領收入。'}
    </p>
  )
  const modelPicker = (
    <div className="form-group">
      <label htmlFor="agent-model" className="field-label">
        AI 模型
      </label>
      <select
        id="agent-model"
        value={form.model}
        onChange={update('model')}
        disabled={modelsLoading || !models.length}
        className="field-input"
      >
        {!models.length && (
          <option value="">{modelsLoading ? '正在載入可用模型…' : '目前沒有可用模型'}</option>
        )}
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
      <p className="field-hint">
        依目前可用的 Gemini 模型提供；能否生成回覆取決於 API 額度與供應狀況。
      </p>
      <button
        className="text-link text-sm mt-2"
        type="button"
        disabled={modelsLoading}
        onClick={() => void loadModels()}
      >
        重新載入模型
      </button>
      {modelsError && (
        <p role="alert" className="notice mt-3">
          {modelsError}
        </p>
      )}
    </div>
  )
  const compression = (
    <div className="py-5 border-y border-border-subtle">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={autoCompress}
          onChange={(e) => setAutoCompress(e.target.checked)}
          className="w-5 h-5 accent-accent"
        />
        精簡過長的引導內容
      </label>
      <p className="field-hint">上架時協助壓縮內容，減少傳送給模型的文字量。</p>
      {compressStatus && (
        <p role="status" className="text-sm text-accent mt-2">
          {compressStatus}
        </p>
      )}
    </div>
  )
  return (
    <div className="page-width page-section">
      <Link href="/studio" className="breadcrumb">
        <Icon name="back" />
        回到達人工作室
      </Link>
      <div className="page-heading">
        <div>
          <h1>把你的經驗，整理成服務。</h1>
          <p>說清楚你能幫什麼忙，再把判斷方法交給 AI，讓需要的人按需使用。</p>
        </div>
      </div>
      <div className="creator-form-layout">
        <aside>
          <h2 className="text-xl font-semibold mb-4">從你熟悉的事開始。</h2>
          <p className="text-sm text-text-secondary">
            好的服務介紹，讓人知道適不適合自己。好的引導方法，讓 AI
            知道該先問什麼、如何判斷，以及哪些事做不到。
          </p>
          <div className="technical-details">
            <p className="text-sm">
              上架需完成錢包簽署與鏈上登記。你設定每秒收入，平台費會另外列出。
            </p>
          </div>
          {!address && (
            <div className="mt-6">
              <p className="field-label">準備上架時，連接錢包</p>
              <ConnectWalletButton />
            </div>
          )}
        </aside>
        <div>
          <div className="market-tabs mb-8" aria-label="上架方式">
            <button
              type="button"
              aria-pressed={mode === 'manual'}
              onClick={() => setMode('manual')}
            >
              自行填寫
            </button>
            <button
              type="button"
              aria-pressed={mode === 'import'}
              onClick={() => setMode('import')}
            >
              匯入資料夾
            </button>
          </div>
          {mode === 'manual' ? (
            <form className="space-y-7" onSubmit={handleManualSubmit}>
              <div>
                <label className="field-label" htmlFor="service-name">
                  服務名稱<span className="text-accent text-xs ml-2">必填</span>
                </label>
                <input
                  id="service-name"
                  className="field-input"
                  required
                  value={form.name}
                  onChange={update('name')}
                  placeholder="例如：陪你整理轉職履歷"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="service-description">
                  這份服務能幫什麼忙？<span className="text-accent text-xs ml-2">必填</span>
                </label>
                <textarea
                  id="service-description"
                  className="field-input"
                  required
                  rows={3}
                  value={form.description}
                  onChange={update('description')}
                  placeholder="說明適合的對象、能協助的問題，以及你的方法特色。"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="service-category">
                  服務分類
                </label>
                <select
                  id="service-category"
                  value={form.category}
                  onChange={update('category')}
                  className="field-input"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {categoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="service-method">
                  你的引導方法<span className="text-accent text-xs ml-2">必填</span>
                </label>
                <textarea
                  id="service-method"
                  className="field-input"
                  required
                  rows={9}
                  value={form.systemPrompt}
                  onChange={update('systemPrompt')}
                  placeholder="你會先確認哪些條件？如何比較選項？遇到資訊不足時，該怎麼回應？可以加入案例與能力界線。"
                />
                <p className="field-hint">
                  這段內容會作為 AI 的系統提示詞，決定服務如何回應使用者。
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="service-rate">
                  你每秒希望取得的收入（USDC）
                </label>
                <input
                  id="service-rate"
                  type="number"
                  min="0"
                  step="0.000001"
                  required
                  value={form.ratePerSecond}
                  onChange={update('ratePerSecond')}
                  className="field-input"
                />
                {pricePreview(form.ratePerSecond)}
              </div>
              {modelPicker}
              <details className="technical-details">
                <summary>進階設定：需求欄位與回應參數</summary>
                <div className="space-y-6">
                  <div>
                    <label className="field-label" htmlFor="prompt-template">
                      使用者需求範本
                    </label>
                    <textarea
                      id="prompt-template"
                      className="field-input"
                      rows={3}
                      value={form.userPromptTemplate}
                      onChange={update('userPromptTemplate')}
                      onBlur={detectVariables}
                      placeholder="請依照 {{query}} 提供引導。"
                    />
                    <p className="field-hint">使用 {'{{變數}}'}，離開欄位後會自動加入需求欄位。</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center gap-4">
                      <h3 className="font-semibold">使用者需要填寫的欄位</h3>
                      <button type="button" className="text-link text-sm" onClick={addInputField}>
                        新增欄位
                        <Icon name="plus" />
                      </button>
                    </div>
                    {inputFields.map((field, i) => (
                      <div key={i} className="border-b border-border-subtle py-4 space-y-3">
                        <input
                          className="field-input"
                          aria-label={`第 ${i + 1} 個欄位名稱`}
                          value={field.name}
                          onChange={(e) => updateField(i, 'name', e.target.value)}
                          placeholder="欄位名稱"
                        />
                        <div className="flex flex-wrap gap-4 items-center">
                          <select
                            aria-label={`第 ${i + 1} 個欄位類型`}
                            className="field-input !w-auto"
                            value={field.type}
                            onChange={(e) => updateField(i, 'type', e.target.value)}
                          >
                            <option value="text">文字</option>
                            <option value="number">數字</option>
                            <option value="select">選項（以文字輸入）</option>
                          </select>
                          <label className="flex gap-2 items-center text-sm">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(i, 'required', e.target.checked)}
                            />
                            必填
                          </label>
                          <button
                            type="button"
                            className="text-link text-sm"
                            aria-label={`移除第 ${i + 1} 個欄位`}
                            onClick={() => removeField(i)}
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ))}
                    {!inputFields.length && (
                      <p className="field-hint mt-4">未設定時，使用者會直接輸入一段需求。</p>
                    )}
                  </div>
                  <div>
                    <label className="field-label" htmlFor="temperature">
                      回應變化程度（Temperature）：{form.temperature}
                    </label>
                    <input
                      id="temperature"
                      type="range"
                      value={form.temperature}
                      onChange={update('temperature')}
                      min="0"
                      max="2"
                      step="0.1"
                      className="w-full accent-accent"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="max-tokens">
                      回覆長度上限（tokens）
                    </label>
                    <input
                      id="max-tokens"
                      type="number"
                      min="128"
                      max="8192"
                      step="128"
                      value={form.maxTokens}
                      onChange={update('maxTokens')}
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="metadata-url">
                      服務中繼資料網址（選填）
                    </label>
                    <input
                      id="metadata-url"
                      type="url"
                      value={form.metadataUri}
                      onChange={update('metadataUri')}
                      placeholder="https://"
                      className="field-input"
                    />
                  </div>
                </div>
              </details>
              {compression}
              {error && (
                <p className="notice" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button-primary w-full"
                type="submit"
                disabled={loading || modelsLoading || !models.length || !address}
              >
                {loading ? '正在處理上架…' : !address ? '請先連接錢包' : '確認設定，上架服務'}
                <Icon />
              </button>
            </form>
          ) : (
            <form onSubmit={handleImportSubmit} className="space-y-7">
              <div className="import-zone">
                <label htmlFor="skill-folder" className="field-label text-xl">
                  選擇服務資料夾
                </label>
                <p className="text-sm text-text-secondary mb-5">
                  根目錄需包含 SKILL.md。patterns 資料夾內的 Markdown 會各自建立服務。
                </p>

                <input
                  id="skill-folder"
                  type="file"
                  {...{ webkitdirectory: '', directory: '' }}
                  onChange={handleDirectoryUpload}
                  className="text-sm w-full"
                />
              </div>
              {importPreview && (
                <section className="py-5 border-y border-border-subtle">
                  <h2 className="text-xl font-semibold">{importPreview.name}</h2>
                  <p className="text-sm text-text-secondary my-3">{importPreview.description}</p>
                  <p className="text-sm">
                    將建立 1 份主要服務與 {importPreview.patterns.length} 份延伸服務，共{' '}
                    {1 + importPreview.patterns.length} 份。
                  </p>
                </section>
              )}
              <div>
                <label className="field-label" htmlFor="import-category">
                  服務分類
                </label>
                <select
                  id="import-category"
                  value={importCategory}
                  onChange={(e) => setImportCategory(e.target.value)}
                  className="field-input"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {categoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="import-rate">
                  每秒收入（USDC）
                </label>
                <input
                  className="field-input"
                  id="import-rate"
                  type="number"
                  min="0"
                  step="0.000001"
                  required
                  value={importPrice}
                  onChange={(e) => setImportPrice(e.target.value)}
                />
                {pricePreview(importPrice)}
              </div>
              {modelPicker}
              {compression}
              {error && (
                <p role="alert" className="notice">
                  {error}
                </p>
              )}
              <button
                className="button-primary w-full"
                type="submit"
                disabled={loading || modelsLoading || !models.length || !address || !skillMdContent}
              >
                {loading
                  ? '正在匯入與上架…'
                  : !address
                    ? '請先連接錢包'
                    : `確認匯入 ${importPreview ? 1 + patternFiles.length : 0} 份服務`}
                <Icon />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
