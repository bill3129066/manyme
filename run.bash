#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v bun >/dev/null || { echo 'Install Bun first'; exit 1; }
command -v pnpm >/dev/null || { echo 'Install pnpm first'; exit 1; }
exec bun --env-file=.env scripts/start.ts
