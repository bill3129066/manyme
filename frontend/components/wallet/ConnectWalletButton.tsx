 'use client'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useConnect, useAccount, useDisconnect, useSwitchChain } from 'wagmi'
export function ConnectWalletButton() {
 const {connect,connectors,error,isPending}=useConnect()
 const {isConnected,address,chainId}=useAccount()
 const {switchChain,error:switchError,isPending:switching}=useSwitchChain()
 const {disconnect}=useDisconnect()
 if(process.env.NEXT_PUBLIC_TEST_WALLET!=='true')return <ConnectButton />
 return <div className="flex flex-wrap items-center gap-3 text-sm">
  {isConnected ? <button onClick={()=>disconnect()}>{address?.slice(0,6)}…{address?.slice(-4)} · Disconnect</button> : connectors.map(connector=><button key={connector.id} disabled={isPending} onClick={()=>connect({connector,chainId:84532})} className="border border-border-subtle px-3 py-2 disabled:opacity-50">Connect {connector.name}</button>)}
  {isConnected && (chainId===84532 ? <span>Base Sepolia</span> : <button disabled={switching} onClick={()=>switchChain({chainId:84532})}>{switching ? 'Switching network…' : 'Switch to Base Sepolia'}</button>)}
  {(error || switchError) && <span role="alert">{(error || switchError)?.message}</span>}
 </div>
}
