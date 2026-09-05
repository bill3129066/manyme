export interface ActivityStep {
  kind: string
  title: string
  body: string
  ts: string
}
export interface ActivityProof {
  seq: number
  proofHash: string
  txHash?: string
  ts: string
}

function timestamp(value: string) {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const parsed = Date.parse(normalized)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function activityEntries(steps: ActivityStep[], proofs: ActivityProof[]) {
  const titles: Record<string, string> = {
    'Execution started': '接到任務，開始處理',
    'Tool call': '調用工具，接著查',
    Complete: '整理完成，回覆送達',
  }
  const entries = [
    ...steps.map((step) => ({
      id: `step-${step.ts}-${step.title}-${step.body}`,
      title: titles[step.title] || step.title,
      detail: step.kind === 'finding' ? '' : step.body,
      timestamp: timestamp(step.ts),
      url: undefined as string | undefined,
    })),
    ...proofs.map((proof) => ({
      id: `proof-${proof.seq}-${proof.proofHash}`,
      title: `第 ${proof.seq} 次活動留存`,
      detail: proof.proofHash ? `${proof.proofHash.slice(0, 12)}…${proof.proofHash.slice(-6)}` : '',
      timestamp: timestamp(proof.ts),
      url: /^0x[a-fA-F0-9]{64}$/.test(proof.txHash || '')
        ? `https://sepolia.basescan.org/tx/${proof.txHash}`
        : undefined,
    })),
  ]
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((entry) => ({
      ...entry,
      time: entry.timestamp
        ? new Date(entry.timestamp).toLocaleTimeString('zh-TW', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '',
    }))
}
