# ManyMe 開發約定

修改功能前先讀 `docs/ARCHITECTURE.md`，確認操作入口與資料流。
啟動、環境設定或展示問題，讀 `docs/BASE-DEPLOY.md`；產品敘事以 README 為準。

- 文件使用繁體中文，以使用者操作與結果說明行為。已知限制與驗證結果分開記錄。
- 沿用所在檔案的 TypeScript／Solidity 寫法。一次修改集中在一個可驗證的行為。
- 現行展示使用 Base Sepolia（84532）與真實 x402；`run.bash` 是標準啟動入口。
- `.env` 與 `frontend/.env.local` 保留在本機。測試私鑰只在伺服器端使用，不能加上 `NEXT_PUBLIC_`。
- 計費、退款與收入以合約結果為準。proof 記錄活動；UI 的即時費用是估算。
- 變更 ABI 或付款流程時，一併檢查 `contracts/`、`shared/`、前端交易呼叫與後端同步。
- 引入或修改第三方內容時，讀 `THIRD_PARTY_NOTICES.md`，保留原授權並更新來源清單。

## 驗證

從根目錄依修改範圍執行：

```bash
pnpm --dir backend exec tsc --noEmit
pnpm --dir frontend exec tsc --noEmit --incremental false
(cd backend && bun test)
(cd frontend && bun test)
(cd contracts && forge test)
pnpm --dir frontend build
```

文件修改確認所有相對連結與命令；行為修改用實際操作或相應測試確認結果。
交付時寫清楚跑了哪些檢查與未涵蓋的範圍，保留團隊人工驗證的來源。
