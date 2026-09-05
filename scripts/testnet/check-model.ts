// Run from the repository root: bun --env-file=.env scripts/testnet/check-model.ts
// A real generation probe; prints only status and response text, never credentials.
const key = process.env.GEMINI_API_KEY
if (!key) throw new Error('GEMINI_API_KEY is required')
const grounding = process.argv.includes('--search')
const response = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
  {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { parts: [{ text: '請用繁體中文給一個台北半日三代旅行簡短方案。' }] },
      ],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      ...(grounding ? { tools: [{ googleSearch: {} }] } : {}),
    }),
  },
)
const body = await response.json()
const reply = body.candidates?.[0]?.content?.parts
  ?.filter((part: any) => part.text && !part.thought)
  .map((part: any) => part.text)
  .join('\n')
console.log(
  JSON.stringify({
    grounding,
    status: response.status,
    reply,
    error: body.error?.message,
  }),
)
if (!response.ok || !reply) process.exitCode = 1
