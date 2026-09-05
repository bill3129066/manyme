import { expect, test } from 'bun:test'
import { selectChatModels } from '../services/agent/modelCatalog.js'

test('shows current text models without legacy, media or non-generation entries',()=>{
  const names=['gemini-2.0-flash','gemini-2.5-pro','gemini-3.8-flash','gemini-3.7-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview','gemini-3.1-flash-image','gemini-3.1-flash-tts-preview','gemini-3.5-transcribe','gemini-3.1-flash-live-preview']
  const input=names.map(id=>({name:`models/${id}`,supportedGenerationMethods:['generateContent']}))
  input.push({name:'models/gemini-4-flash',supportedGenerationMethods:['countTokens']})
  expect(selectChatModels(input).map(m=>m.id)).toEqual(['gemini-3.8-flash','gemini-3.7-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview'])
  expect(selectChatModels(input).at(-1)?.preview).toBe(true)
})

test('automatically includes a future stable text model returned by the provider',()=>{
  expect(selectChatModels([{name:'models/gemini-4-flash',supportedGenerationMethods:['generateContent']}])[0].id).toBe('gemini-4-flash')
})
