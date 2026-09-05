import { Hono } from 'hono';
import { modelsRoutes } from './api/models.routes.js';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { agentsRoutes } from './api/agents.routes.js';
import { sessionsRoutes } from './api/sessions.routes.js';
import { curatorRoutes } from './api/curator.routes.js';
import { queriesRoutes } from './api/queries.routes.js';
import { initDb } from './db/init.js';
import { EventWatcher } from './services/onchain/eventWatcher.js';
import { ProofRelayer } from './services/proof/proofRelayer.js';
import { sseHub } from './services/realtime/sseHub.js';

const app = new Hono();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim())

app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'],
  allowHeaders: ['Access-Control-Expose-Headers', 'Content-Type', 'Cache-Control', 'X-Payment', 'PAYMENT-SIGNATURE', 'Last-Event-ID', 'X-Wallet-Address', 'X-Signature', 'X-Timestamp'],
}));

initDb();

const eventWatcher = new EventWatcher();
const proofRelayer = new ProofRelayer();


app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/models', modelsRoutes);
app.route('/api/agents', agentsRoutes);
app.route('/api/sessions', sessionsRoutes);
app.route('/api/curator', curatorRoutes);
app.route('/api/queries', queriesRoutes);
app.route('/queries', queriesRoutes);

const port = parseInt(process.env.PORT || '3001');
serve({ fetch: app.fetch, port }, async () => {
  console.log(`Backend running on http://localhost:${port}`);
  eventWatcher.start();
  await proofRelayer.start();

  sseHub.startPingLoop();
});

export { app };
