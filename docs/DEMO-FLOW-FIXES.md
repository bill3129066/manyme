# Demo flow fixes (2026-09-06)

> 目前完整對話與追問已由團隊完成人工驗證。下文保留當時費用、退款與顯示修正的開發紀錄；現行操作以[本機指南](BASE-SEPOLIA-DEMO.md)為準。

Run `./run.bash` from this checkout with the existing ignored `.env` and frontend `.env.local`. This keeps Base Sepolia (84532), real escrow and `X402_MOCK=false`. No new API credentials are required.

## Buyer and seller behavior

- A wallet signs a ManyMe sign-in challenge once. The server consumes its nonce and issues a wallet-bound token valid for 30 minutes. Chat, rating, session registration and curator payout API requests reuse it. Disconnect clears the browser cache. A backend restart invalidates tokens; the next action signs in again. This is a single-process demo auth session, not a production distributed identity service.
- Real x402 payment authorization is unchanged. Escrow USDC approval is requested only when current allowance is insufficient; approval remains bounded to the requested budget. Creating a session still requires a deposit transaction. The deployed contract requires separate stop and refund transactions.
- Live cost is a continuously updated estimate bounded by the last confirmed proof window and deposit. On-chain checkpoints and final settlement remain authoritative. My Sessions filters by the connected buyer, shows the agent name and reads actual accrued cost rather than the old `rate * 4` placeholder.
- Upload accepts decimal USDC/sec for curator income. `0.0097` becomes 9,700 micro-USDC; the current platform fee is 300 micro-USDC/sec, so the buyer rate is 0.0100. A zero curator rate explicitly means zero curator earnings. Existing on-chain listings and historical charges are unchanged.
- Chat and Agent Work render CommonMark plus GFM tables using react-markdown and remark-gfm, without raw HTML. Reload restores persisted executions, steps and proofs.

## Reproduction and evidence

The user's session `7817e458-be2c-4714-ae38-4596d1e5199e` accrued 820,000 micro-USDC. The old history page displayed 40,000 (four seconds at 10,000/sec). History and detail now return 820,000. The user's `回復你好` session `e7646fb3-c3e2-42dc-98d3-67817f525ab7` had curator rate 0, platform rate 300 and accrued 24,000. Its zero curator payout is correct.

Actual browser test with dedicated test wallets:

1. Author published `Demo Markdown Hello`, agent `e9eebc92-f5e5-48d1-adda-5713ac15758b`, curator rate 0.0097.
2. Buyer deposited 1 test USDC and created session `86a28794-3027-462a-9c2f-97407675d6ed`. Live cost advanced between checkpoints. This case exercised generation-failure cleanup: proof renewal stopped and the estimate capped at 0.20.
3. Browser End Session completed stop/refund. On-chain session 6 confirmed final cost 0.20 and refund 0.80, with curator income 0.194 and platform fee 0.006. Rating submitted successfully using cached auth.
4. Author claimed 1.0864 test USDC, including this session and earlier unpaid earnings. Studio showed confirmed payout and pending amount 0. Transaction: https://sepolia.basescan.org/tx/0x9b33e5fd97c13bd341a41cc2274ea4e839dd21192753f823fbef686d39c7c776
5. Reloaded the user's existing successful travel session. Chat and Agent Work displayed actual headings, emphasis and lists; cost showed 0.8200 and nine persisted proofs. Desktop and 390px mobile inspected. No active/paused sessions remained after the test.

This run used the browser's dedicated test-wallet connector. The user's earlier screenshots establish MetaMask on Base Sepolia with real replies; this run does not establish the final auth UX in the native MetaMask extension.

## Checks

- Backend: `cd backend && bun test` — 41 pass.
- Frontend: `cd frontend && bun test` — 10 pass.
- Frontend production build and both TypeScript checks passed.
- Regression coverage includes connected wrong-chain wallets, auth reuse/concurrency/expiry/wallet mismatch/nonce replay, decimal rates, bounded live cost, history/detail consistency and safe Markdown.

Markdown references: https://github.com/remarkjs/react-markdown and https://github.com/remarkjs/remark-gfm
