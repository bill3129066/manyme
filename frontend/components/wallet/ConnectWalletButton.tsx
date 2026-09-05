 'use client'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useConnect, useAccount, useDisconnect } from 'wagmi'
export function ConnectWalletButton() {
 const {connect,connectors,error,isPending}=useConnect()
 const {isConnected,address}=useAccount()
 const {disconnect}=useDisconnect()
 if(process.env.NEXT_PUBLIC_TEST_WALLET!=='true')return <ConnectButton />
 return <div className="flex flex-wrap items-center gap-3 text-sm">
  {isConnected ? <button onClick={()=>disconnect()}>{address?.slice(0,6)}…{address?.slice(-4)} · Disconnect</button> : connectors.map(connector=><button key={connector.id} disabled={isPending} onClick={()=>connect({connector})} className="border border-border-subtle px-3 py-2 disabled:opacity-50">Connect {connector.name}</button>)}
  {error && <span role="alert">{error.message}</span>}
 </div>
}
