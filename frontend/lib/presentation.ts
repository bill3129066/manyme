/** Display labels only. API category identifiers and authored content stay intact. */
export const CATEGORY_LABELS: Record<string, string> = {
  all: '全部服務', general: '生活與綜合', research: '研究與學習',
  defi: 'DeFi 分析', trading: '交易研究', nft: 'NFT 探索', security: '安全檢查',
  travel: '旅行規劃', career: '職涯發展', life: '在地生活',
}
export const categoryLabel = (category: string) => CATEGORY_LABELS[category] || category
export const sessionStatusLabel = (status: string) => ({active:'使用中', paused:'等待活動更新', stopped:'已結束', failed:'未能完成', created:'準備中'}[status] || status)
export function displayError(error: unknown, fallback = '操作未完成，請稍後再試。'): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/reject|denied|cancel/i.test(message)) return '你已取消錢包操作，填寫的內容仍保留在這裡。'
  if (/fetch|network|connect|Failed to reach/i.test(message)) return '目前無法連上服務，請確認連線後再試一次。'
  if (/insufficient|balance/i.test(message)) return '錢包餘額不足，請確認測試 USDC 與交易所需的 ETH。'
  return /[\u3400-\u9fff]/.test(message) ? message : fallback
}
