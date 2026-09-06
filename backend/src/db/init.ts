import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function initDb(): void {
  getDb().exec(readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8'));
  // Publishing is explicit: an unregistered example cannot start a paid session.
  // Use backend/scripts/publish-catalog.ts after configuring Base Sepolia.
}

if (import.meta.main) {
  initDb();
  console.log('DB initialized successfully.');
}
