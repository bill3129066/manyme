import {expect,test} from 'bun:test'
import {createAtomicSession} from './atomic-session'
const address=`0x${'11'.repeat(20)}` as const
const hash=`0x${'22'.repeat(32)}` as const
test('approval and creation are sent in one atomic request',async()=>{
 let sends=0
 const wallet={getCapabilities:async()=>({atomic:{status:'supported'}}),sendCalls:async(args:any)=>{sends++;expect(args.calls).toHaveLength(2);expect(args.forceAtomic).toBe(true);return{id:'batch'}},waitForCallsStatus:async()=>({status:'success',receipts:[{transactionHash:hash,status:'success'}]})}
 expect(await createAtomicSession(wallet,address,address,1n,100n)).toBe(hash)
 expect(sends).toBe(1)
})
test('unsupported wallets return before submitting; rejected batches never fall back',async()=>{
 const wallet={getCapabilities:async()=>({atomic:{status:'unsupported'}}),sendCalls:async()=>{throw new Error('rejected')},waitForCallsStatus:async()=>({status:'success'})}
 expect(await createAtomicSession(wallet,address,address,1n,100n)).toBeNull()
 wallet.getCapabilities=async()=>({atomic:{status:'supported'}})
 await expect(createAtomicSession(wallet,address,address,1n,100n)).rejects.toThrow('rejected')
})
