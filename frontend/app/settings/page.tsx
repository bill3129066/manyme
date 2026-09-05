'use client'

import Link from 'next/link'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'
import { getNetworkConfig } from '@/lib/networks'

export default function SettingsPage() {
  const { address } = useAccount()
  const network = getNetworkConfig(84532)
  const balance = useReadContract({
    chainId: 84532,
    address: network.usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <h1 className="font-display text-4xl">Wallet &amp; session budgets</h1>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Base Sepolia wallet</h2>
        {address ? (
          <>
            <p className="font-mono text-sm break-all">{address}</p>
            <p>
              {balance.isError
                ? 'Unable to read balance. Please retry.'
                : balance.data === undefined
                  ? 'Loading balance…'
                  : `${formatUnits(balance.data, 6)} USDC`}
            </p>
            <button className="underline" onClick={() => balance.refetch()}>
              Refresh balance
            </button>
          </>
        ) : (
          <p>Connect your wallet using the buttons above.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">
          Fund each session when you start
        </h2>
        <p>
          Choose an agent, enter your question and set a USDC budget. Starting a
          session approves USDC and deposits that budget into its escrow
          session.
        </p>
        <p>
          End the session to stop billing and refund unused USDC to your wallet.
          To take a break, end this session and start a new one when you return.
        </p>
        <Link className="inline-block underline" href="/agents">
          Browse agents →
        </Link>
      </section>
      <Link className="inline-block underline" href="/sessions">
        View sessions →
      </Link>
    </div>
  )
}
