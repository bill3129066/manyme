import type { Database } from 'bun:sqlite'

// Immutable IDs from the existing demo catalog; never match user content by name.
const LEGACY_DEMO_IDS = [
  '5136f0dc-f177-4a1e-8f5b-94997e4c34f9',
  '0849345a-6d90-4d93-855b-6518e40bc3a5',
  'c4ef6e72-a8da-4c5b-b954-a5c7ca40b1f9',
  'ea4483d0-a7aa-406c-8f27-f928544e2a6a',
  'b595890d-8d1f-41e4-be4f-918071b7fcc7',
  'f311aede-a6e3-4893-a850-59ec49fe9df9',
  '3a500466-f456-40f7-a791-863499779f66',
  'c4bada16-34e7-4b73-b1b4-d7024e9ccbcf',
  '5627593e-9fea-4d15-9e25-9becf5c8be49',
  '58b51998-62b4-4230-8276-827d5061d161',
  '66bb2971-1ee5-42f6-877f-7c85b3dded8c',
  '5844e3ce-a083-4a1c-a7a8-0de3d4db235c',
  'adb039c9-0a24-4b6f-9850-d668810cce0b',
  'fdbc9815-b38a-4fbc-a485-8f1e7183530e',
  'ad525b17-4e54-47c6-986a-d11668616813',
  '279a53b8-afdc-4a8d-9009-699f1729ac4a',
  'dfaf65c5-ab86-49b0-b549-aca6312be216',
  'bd959395-35d2-43f9-b8c6-dd74a2b9fdbe',
  '1931ae32-d089-474c-b3c2-fe7e401ce22f',
  '30bd3e39-71fe-407e-8724-84045d6cb38a',
  '8a5c948c-8b0e-49fe-9840-fe41b259165c',
  '4e33f01a-1240-4226-ac38-a656c7bf907c',
  '9a617e3b-f27f-4809-bbe9-a4364837d79b',
]

export function retireDemoAgents(db: Database, keepIds: string[]): number {
  return db.transaction(() => {
    let count = 0
    for (const id of LEGACY_DEMO_IDS) {
      if (keepIds.includes(id)) continue
      count += db.query("UPDATE agents SET active=0,updated_at=datetime('now') WHERE id=? AND active=1").run(id).changes
    }
    return count
  })()
}
