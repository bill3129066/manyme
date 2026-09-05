import { createConnector } from 'wagmi'

export function testWallet(role: 'payer' | 'author') {
  return createConnector((config) => {
    const provider = {
      request: async ({
        method,
        params,
      }: {
        method: string
        params?: unknown
      }) => {
        const response = await fetch('/api/test-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, method, params }),
        })
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error || 'Test wallet request failed')
        return data.result
      },
      on: () => {},
      removeListener: () => {},
    }
    return {
      id: `test-${role}`,
      name: `Test ${role}`,
      type: 'test-wallet',
      async connect(parameters) {
        const accounts = await this.getAccounts()
        return {
          accounts: (parameters?.withCapabilities
            ? accounts.map((address) => ({ address, capabilities: {} }))
            : accounts) as any,
          chainId: 84532,
        }
      },
      async disconnect() {},
      async getAccounts() {
        return provider.request({ method: 'eth_accounts' }) as Promise<
          readonly `0x${string}`[]
        >
      },
      async getChainId() {
        return 84532
      },
      async getProvider() {
        return provider
      },
      async isAuthorized() {
        return false
      },
      onAccountsChanged(accounts) {
        config.emitter.emit('change', { accounts: accounts as `0x${string}`[] })
      },
      onChainChanged() {},
      onDisconnect() {
        config.emitter.emit('disconnect')
      },
    }
  })
}
