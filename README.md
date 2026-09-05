# ManyMe 分身有術

讓人們按需使用達人經驗的 AI 服務市集。

> 攻略我看過了，但我家不是範例家庭。

達人把判斷原則、提問方式和案例上架；買家選擇服務、設定本次預算，
透過對話補充自己的限制。服務依使用時間計費，結束後退回剩餘預算，
達人可以領取收入。完整產品敘事見 [PITCH](docs/PITCH.md)。

## Run locally

Follow [the Base Sepolia demo guide](docs/BASE-SEPOLIA-DEMO.md) for dependencies,
minimum environment variables, dedicated test wallets, deployment and the
browser walkthrough. After setup:

```bash
./run.bash
```

Open http://localhost:3000. The API runs on port 3001. The demo uses
Gemini 3.8 Flash, Circle test USDC, real escrow transactions and real x402
settlement on Base Sepolia (84532). OKX is not required.

## Core browser flow

1. **Seller:** connect Test author → Upload → publish a service on-chain.
2. **Buyer:** connect Test payer → choose the service → enter a question and
   session budget → Start Session → receive an answer and ask follow-ups.
3. **Settlement:** End Session → unused USDC returns to the buyer → seller
   opens Studio and claims earnings.
4. **Single query:** `/query` → choose a resource → receive a 402 challenge →
   sign payment → receive the resource and a payment transaction link.

The deployed contract charges a fixed platform fee of 0.0003 USDC per second,
plus the seller's rate. There is no separate platform deposit step. To take a
break, end the session and start a new one later; manual pause/resume is not
supported by the deployed contract.

Proof heartbeats anchor service activity on-chain. They do not establish answer
correctness. Model failures stop proof renewal and trigger browser stop/refund;
the contract's existing proof window bounds residual billing. This is not a
zero-charge guarantee for failed generation.

## Architecture

- `contracts/`: Solidity registry, session escrow, accrual, refunds and claims.
- `backend/`: Hono, Bun and SQLite; Gemini execution, session reconciliation,
  confirmed proof submission, seller payouts and x402 verification/settlement.
- `frontend/`: Next.js, wagmi and viem; seller publishing, session chat, wallet
  transactions, Studio and single-query payments.
- `shared/`: contract ABI shared by the browser and backend.
- `scripts/testnet/`: dedicated wallet setup, deployment and diagnostic checks.
- `skills/`: example experience packs used by the service registry.

The local test-wallet connectors keep private keys in the Next.js server and
allow only bounded Base Sepolia operations on localhost. This is a development
harness, not a production wallet custody service. Never use real asset keys.

## Validation and current limitations

```bash
pnpm --dir backend exec tsc --noEmit
pnpm --dir frontend exec tsc --noEmit --incremental false
(cd backend && bun test)
(cd contracts && forge test)
bun scripts/testnet/check-http.ts # requires the running server
bun --env-file=.env scripts/testnet/check-model.ts # real Gemini request
```

The [demo guide](docs/BASE-SEPOLIA-DEMO.md) records observed browser and chain
results. Seller publication, buyer funding, automatic failure cleanup,
stop/refund, seller payout and x402 evidence settlement have been exercised.
Full conversation/follow-up remains unverified while the supplied Gemini
project returns 429 with Search and 503 for the travel generation request.
