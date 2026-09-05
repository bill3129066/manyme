export interface GeminiModel {
  name: string
  displayName?: string
  supportedGenerationMethods?: string[]
}

/** Current numbered text-chat models; exclude legacy, media and specialist endpoints. */
export function selectChatModels(models: GeminiModel[]) {
  return models.flatMap(model => {
    const id = model.name.replace(/^models\//, '')
    const match = /^gemini-(\d+)(?:\.(\d+))?-(flash|pro)(-lite)?(-preview)?$/.exec(id)
    if (!match || Number(match[1]) < 3 || !model.supportedGenerationMethods?.includes('generateContent')) return []
    return [{id, label:model.displayName || id, preview:Boolean(match[5])}]
  }).sort((a,b) => Number(a.preview)-Number(b.preview) || b.id.localeCompare(a.id,undefined,{numeric:true}))
}

export async function getModelCatalog() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini API key is not configured')
  const models: GeminiModel[] = []
  let pageToken: string | undefined
  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
    url.searchParams.set('pageSize','1000')
    if(pageToken) url.searchParams.set('pageToken',pageToken)
    const response = await fetch(url, {
      headers:{'x-goog-api-key':key}, signal:AbortSignal.timeout(10000),
    })
    if(!response.ok) throw new Error(`Gemini model catalog is unavailable (${response.status})`)
    const body = await response.json()
    models.push(...(body.models || []))
    pageToken = body.nextPageToken
  } while(pageToken)
  const options = selectChatModels(models)
  if(!options.length) throw new Error('No current Gemini chat models are available in the catalog')
  return {models:options, updatedAt:new Date().toISOString()}
}
