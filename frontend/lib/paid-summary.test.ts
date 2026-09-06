import {expect,test} from 'bun:test'
import {purchaseSummary,selectSummaryPayment} from './paid-summary'
import {getNetworkConfig} from './networks'
const requirement={scheme:'exact',network:'eip155:84532' as const,amount:'1000',asset:getNetworkConfig(84532).usdcAddress,payTo:`0x${'22'.repeat(20)}`,maxTimeoutSeconds:300,extra:{name:'USDC',version:'2'}}
const tx=`0x${'33'.repeat(32)}`
const challenge=(price=requirement)=>new Response('{}',{status:402,headers:{'PAYMENT-REQUIRED':btoa(JSON.stringify({x402Version:2,resource:{url:'http://localhost:3001/queries/agent/a/summary',description:'summary',mimeType:'application/json'},accepts:[price]}))}})
test('one exact payment returns the selected summary and confirmed transaction',async()=>{
 let signatures=0,calls=0
 const signer={address:`0x${'11'.repeat(20)}` as `0x${string}`,signTypedData:async()=>{signatures++;return `0x${'11'.repeat(65)}` as `0x${string}`}}
 const request=(async(_input:any,init?:RequestInit)=>{
  calls++
  if(calls===1)return challenge()
  expect(new Headers(_input instanceof Request ? _input.headers : init?.headers).has('PAYMENT-SIGNATURE')).toBe(true)
  return new Response(JSON.stringify({agentId:'a',agentName:'test',summary:'最近分析',timestamp:'2026-09-06'}),{headers:{'PAYMENT-RESPONSE':btoa(JSON.stringify({success:true,transaction:tx,network:'eip155:84532'}))}})
 }) as unknown as typeof fetch
 expect((await purchaseSummary('a',signer,request)).transaction).toBe(tx)
 expect(calls).toBe(2);expect(signatures).toBe(1)
})
test('changed prices are rejected before a signature',async()=>{
 let signatures=0
 const signer={address:`0x${'11'.repeat(20)}` as `0x${string}`,signTypedData:async()=>{signatures++;return '0x' as const}}
 await expect(purchaseSummary('a',signer,(async()=>challenge({...requirement,amount:'2000'})) as unknown as typeof fetch)).rejects.toThrow('付款條件')
 expect(signatures).toBe(0)
 expect(()=>selectSummaryPayment(2,[{...requirement,network:'eip155:8453'}])).toThrow()
})
test('wallet cancellation does not retry payment',async()=>{
 let calls=0
 const signer={address:`0x${'11'.repeat(20)}` as `0x${string}`,signTypedData:async()=>{throw new Error('User rejected')}}
 await expect(purchaseSummary('a',signer,(async()=>{calls++;return challenge()}) as unknown as typeof fetch)).rejects.toThrow('User rejected')
 expect(calls).toBe(1)
})
