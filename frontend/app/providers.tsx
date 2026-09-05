'use client'

import * as React from 'react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import { createWagmiConfig } from '@/lib/wagmi'
import '@rainbow-me/rainbowkit/styles.css'

export function Providers({ children }: { children: React.ReactNode }) {
  const [config] = useState(() => createWagmiConfig())
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale="zh-TW"
          theme={lightTheme({
            accentColor: '#ad422e',
            accentColorForeground: '#fffcf5',
            borderRadius: 'none',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
