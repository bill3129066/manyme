import type { Database } from 'bun:sqlite'

// Known demo records only; retain rows because sessions and earnings reference them.
const TEST_IDS = [
  '30bd3e39-71fe-407e-8724-84045d6cb38a',
  '8a5c948c-8b0e-49fe-9840-fe41b259165c',
  '4e33f01a-1240-4226-ac38-a656c7bf907c',
  '9a617e3b-f27f-4809-bbe9-a4364837d79b',
]

export function retireDemoAgents(db: Database, keepIds: string[]): number {
  const rows = db.query(`SELECT id FROM agents WHERE active=1 AND (
    (creator_wallet='system' AND onchain_agent_id IS NULL) OR
    (creator_wallet='0x0000000000000000000000000000000000000001' AND name='DeFi Pool Analyst' AND onchain_agent_id IS NULL) OR
    (creator_wallet='0x0000000000000000000000000000000000000002' AND name='Yield Comparator' AND onchain_agent_id IS NULL) OR
    id IN (${TEST_IDS.map(() => '?').join(',')})
  )`).all(...TEST_IDS) as { id: string }[]
  return db.transaction(() => {
    let count = 0
    for (const { id } of rows) {
      if (keepIds.includes(id)) continue
      count += db.query("UPDATE agents SET active=0,updated_at=datetime('now') WHERE id=?").run(id).changes
    }
    return count
  })()
}
