# Base Sepolia demo

The current demo uses Base Sepolia (chain ID 84532), Circle test USDC,
Gemini 3.8 Flash and real x402 settlement. It does not require OKX.

## Run locally

Use Bun, pnpm and Foundry. Install workspace dependencies with
`pnpm install --frozen-lockfile`. Copy `.env.example` to `.env` and
`frontend/.env.example` to `frontend/.env.local`. Enter `GEMINI_API_KEY` in
`.env`, then run `bun scripts/testnet/setup.ts` to generate dedicated wallets.
Fund the printed platform address with Base Sepolia ETH and the payer with
Circle Base Sepolia test USDC. Build with `cd contracts && forge build`, return
to the root and run `bun --env-file=.env scripts/testnet/deploy.ts` to deploy
and fund the buyer/author gas wallets. Keep credentials in the ignored `.env`.
Run `./run.bash` from the repository root; it starts the API on port 3001
and the frontend on port 3000.

The local development wallet connectors sign using dedicated test keys on the
Next.js server. They are restricted to localhost and Base Sepolia. Never use
mainnet keys. The private keys must not have a `NEXT_PUBLIC_` prefix.

## Demo path

1. Connect **Test author**, open **Upload**, publish an agent. Registration is
   a real escrow transaction; publication then records its confirmed ID.
2. Connect **Test payer**, open that agent, enter a question and set a USDC
   budget. **Start Session** approves USDC and creates a funded escrow session.
3. Read the generated answer, ask a follow-up, and inspect anchored proof
   transactions. Proof heartbeats show service liveness; they do not prove that
   an answer is correct or that generation succeeded.
4. **End Session** stops billing and refunds unused USDC. To take a break,
   end the session and start a new one later. The deployed contract has no
   manual pause/resume pair.
5. Connect **Test author**, open **Studio**, and **Claim earnings**. Confirm
   the transaction and pending balance becoming zero.
6. Open `/query` for a separate x402 payment. A 402 challenge alone does not
   prove settlement; require a successful result and an on-chain receipt.

Settings displays wallet USDC and points to per-session funding. There is no
separate platform deposit step in this demo.

## Diagnose generation

Run `bun --env-file=.env scripts/testnet/check-model.ts` from the root.
Add `--search` to reproduce the Google Search-enabled request. The probe exits
nonzero for a failed or empty generation and never prints the API key.

Observed on 2026-09-05: Gemini 3.8 Flash generated a short response successfully,
but the travel request returned 503 without Search and 429 with Search.
Ordinary chat now omits implicit Google Search; only explicitly configured
chain tools are sent. The browser conversation and follow-up remain unverified until the full path
returns real answers. Do not replace them with canned output.

## Verification status

Browser verified: seller publication, buyer escrow funding, stop/refund,
proof anchoring, Studio income, author payout, corrected wallet balance,
Settings funding instructions, automatic stop/refund on model failure and
zero successful replies for that failure. x402 evidence payment also settled:
`0x092130ef44314f31540f2b1eed603dbf3a5eb1a5df1d6c285e67002c3efcbab7`.
Successful conversation/follow-up remains unverified.

Run `bun scripts/testnet/check-http.ts` against the running server to check the
CORS preflight used by the x402 browser SDK. Run backend tests with
`cd backend && bun test`, and type checks with
`pnpm --dir backend exec tsc --noEmit` and
`pnpm --dir frontend exec tsc --noEmit --incremental false`.

Known billing boundary: the deployed escrow caps accrual at the last proof plus
its proof window. Stopping proof renewal after generation failure bounds billing
even if the browser closes; stopping/refunding from the browser settles sooner.
This does not promise zero charges for a failed generation.
