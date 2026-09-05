import { getDb } from '../../db/client.js'
import { syncSession } from '../session/liveSessionOrchestrator.js'

/** Reconcile persisted sessions from chain, including after a backend restart. */
export class EventWatcher {
  private interval?: ReturnType<typeof setInterval>
  private busy = false
  start() {
    this.interval = setInterval(async () => {
      if (this.busy) return
      this.busy = true
      try {
        const rows = getDb()
          .prepare(
            "SELECT id FROM sessions WHERE status IN ('active','paused') AND onchain_session_id IS NOT NULL",
          )
          .all() as { id: string }[]
        for (const row of rows) await syncSession(row.id)
      } catch (e: any) {
        console.error('[SessionSync]', e.shortMessage || e.message)
      } finally {
        this.busy = false
      }
    }, 5000)
  }
  stop() {
    if (this.interval) clearInterval(this.interval)
  }
}
