/// <reference types="bun-types" />
import { expect, test } from 'bun:test'
import { createConfig, createConnector, http, type Config } from 'wagmi'
import { connect, getAccount, getWalletClient } from 'wagmi/actions'
import { baseSepolia } from 'viem/chains'
import { prepareBaseWallet } from './prepare-wallet'

async function connectedWallet(initialChain: number, reject = false) {
  let chainId = initialChain
  const events: string[] = []
  const account = '0x0000000000000000000000000000000000000001' as const
  const config: Config = createConfig({
    chains: [baseSepolia], transports: {[baseSepolia.id]: http()}, storage: null,
    connectors: [createConnector(({emitter}) => ({
      id:'injected-regression',name:'Injected regression',type:'injected',
      async connect() {return {accounts:[account],chainId} as any},
      async disconnect() {}, async getAccounts() {return [account]},
      async getChainId() {return chainId}, async isAuthorized() {return true},
      async getProvider() {return {request:async ({method}:any) => {
        if(method==='eth_accounts') return [account]
        if(method==='eth_chainId') return `0x${chainId.toString(16)}`
        throw new Error(`Unexpected RPC: ${method}`)
      }}},
      async switchChain({chainId:next}:any) {
        events.push('switch')
        if(reject) throw new Error('User rejected network switch')
        chainId=next
        emitter.emit('change',{chainId})
        return baseSepolia
      },
      onAccountsChanged() {}, onChainChanged() {}, onDisconnect() {},
    }))],
  })
  await connect(config,{connector:config.connectors[0]})
  return {config,events}
}

test('reproduces connected account with unavailable wallet client on Katana',async()=>{
  const {config}=await connectedWallet(747474)
  expect(getAccount(config).isConnected).toBe(true)
  await expect(getWalletClient(config,{chainId:84532})).rejects.toThrow('does not match')
})

test('switches the connected provider before resolving a fresh Base client',async()=>{
  const {config,events}=await connectedWallet(747474)
  const wallet=await prepareBaseWallet(config)
  expect(events).toEqual(['switch'])
  expect(wallet.chain.id).toBe(84532)
  expect(await wallet.getChainId()).toBe(84532)
})

test('does not ask to switch an already connected Base wallet',async()=>{
  const {config,events}=await connectedWallet(84532)
  await prepareBaseWallet(config)
  expect(events).toEqual([])
})

test('a rejected switch aborts the action and preserves the connection',async()=>{
  const {config}=await connectedWallet(747474,true)
  await expect(prepareBaseWallet(config)).rejects.toThrow('rejected')
  expect(getAccount(config).isConnected).toBe(true)
  expect(getAccount(config).chainId).toBe(747474)
})
