# 參與開發

謝謝你花時間看分身有術。這是兩個人從 hackathon 做起的作品，
我們很需要第一次使用時的真實回饋：哪一步看不懂、哪個建議沒接住你的條件，或哪段程式不好理解。

先依 [Base 部署與啟動](docs/BASE-DEPLOY.md)跑起來，再看[架構導讀](docs/ARCHITECTURE.md)找到修改入口。
回報問題可開 [GitHub issue](https://github.com/bill3129066/manyme/issues)，寫下操作步驟、預期與實際結果，
附上瀏覽器及工具版本。請先遮掉 API key、私鑰、登入 token 與私人對話。

## 修改與驗證

小修正可以直接提出 PR，說明改了什麼、為什麼，以及你怎麼確認。
涉及計費、退款或服務互動的大改動，先在 issue 說明使用情境，方便我們一起確認方向。
程式命名沿用鄰近檔案，文件以繁體中文說明行為，保留技術名稱與命令。

```bash
# 從專案根目錄執行
pnpm --dir backend exec tsc --noEmit
pnpm --dir frontend exec tsc --noEmit --incremental false
(cd backend && bun test)
(cd frontend && bun test)
(cd contracts && forge test)
pnpm --dir frontend build
```

依修改範圍執行相關檢查。文件修改要確認連結、命令與現行程式一致；
付款／計費修改需跑合約與後端測試，再用測試網確認操作結果。
測試使用的固定資料與 mock 只證明測試涵蓋的行為；真實付款的驗收需有鏈上交易結果。

引入第三方程式、skill、字型或資料時，請保留原著作權與授權，更新
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。新增 npm 依賴也要更新 lockfile 與依賴清單。
對來源不確定的素材，請先確認使用與散布的權利。

本專案的原始程式與文件採 MIT 授權，第三方內容保留各自條款。
請尊重不同背景與經驗，針對具體問題討論，讓下一位參與的人也容易接手。
