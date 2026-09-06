import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { retireDemoAgents } from '../db/retireDemoAgents'
import { DEMO_CATALOG } from '../db/demoCatalog'

describe('curated paid catalog', () => {
  test('covers each market filter equally with distinct services', () => {
    for (const category of ['general', 'research', 'defi', 'trading', 'nft', 'security']) {
      expect(DEMO_CATALOG.filter(a => a.category === category)).toHaveLength(3)
    }
    expect(new Set(DEMO_CATALOG.map(a => a.id)).size).toBe(18)
    expect(new Set(DEMO_CATALOG.map(a => a.name)).size).toBe(18)
  })
  test('retirement preserves user services and historical sessions, and can repeat', () => {
    const db = new Database(':memory:')
    db.exec('PRAGMA foreign_keys=ON')
    db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
    const insert = db.query('INSERT INTO agents(id,creator_wallet,name,description,system_prompt) VALUES (?,?,?,?,?)')
    insert.run('old', 'system', 'DEX Analytics', '', 'old prompt')
    insert.run('user', '0x123', 'DEX Analytics', '', 'user prompt')
    insert.run('kept', 'system', 'Selected', '', 'selected prompt')
    db.query(`INSERT INTO sessions(id,agent_id,user_wallet,total_rate,curator_rate,platform_fee,deposit_amount)
      VALUES ('history','old','0xabc',1000,700,300,100000)`).run()
    expect(retireDemoAgents(db, ['kept'])).toBe(1)
    expect(db.query('SELECT active FROM agents WHERE id=?').get('old')).toEqual({ active: 0 })
    expect(db.query('SELECT id FROM agents WHERE active=1 ORDER BY id').all()).toEqual([{ id: 'kept' }, { id: 'user' }])
    expect(db.query('SELECT agent_id FROM sessions').get()).toEqual({ agent_id: 'old' })
    expect(retireDemoAgents(db, ['kept'])).toBe(0)
    db.close()
  })
})
