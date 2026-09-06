# 展示服務目錄

市集保留六類，每類三項。每份服務使用獨立的達人提問流程，先理解使用者條件，再提供比較與下一步。
旅行從三代同行與秋季備案出發；研究聚焦 AI 資訊判讀；數位資產服務聚焦提供資料的解讀與風險教育。
所有服務都是文字對話，不宣稱具有即時搜尋、即時報價、訂票、交易或完整合約稽核能力。

## 更新與上架

從根目錄依 [Base 部署與啟動](BASE-DEPLOY.md) 設定 `.env`、測試錢包與前端環境，啟動 `./run.bash`。
`DATABASE_URL` 的相對路徑以 `backend/` 為基準；腳本會先比對本機資料庫與 API 目前顯示的服務。

```bash
# 真實註冊 Base Sepolia，交易確認後才寫入市集
bun --env-file=.env backend/scripts/publish-catalog.ts --apply

# 每項存入 0.5 test USDC，對話後結束並退回未用預算；會使用 Gemini 額度與測試 ETH
bun --env-file=.env backend/scripts/check-catalog.ts

# 驗證後下架已知的舊範例與四個測試項目，保留歷史紀錄
bun --env-file=.env backend/scripts/publish-catalog.ts --apply --retire
```

定義位於 [`demoCatalog.ts`](../backend/src/db/demoCatalog.ts)。現有「三代旅行規劃師」沿用原服務 ID 與鏈上登記；
新服務達人費率為每秒 0.0097 test USDC，總費率由合約取得。預設平台費率為 0.0003 時，買家每秒支付 0.01。
腳本不替其他作者修改鏈上登記，也不刪除對話、評分或結算。

`.catalog-registration.json` 保存每份新服務的註冊交易；等待確認中斷時，重跑會使用同一筆交易。
`.catalog-smoke.json` 保存逐項驗證進度與回覆，成功項目重跑時略過。
已結束的失敗案例要重新測試，可用 `CATALOG_REPORT_PATH=.catalog-smoke-retry.json` 另存一次完整驗證。
這兩種本機紀錄不含私鑰，不納入 Git；分享前仍須確認測試輸入可以公開。

一般啟動只初始化資料表，不會再把 skill pack 的每個 pattern 自動上架，避免重複服務與未登記的卡片重新出現。
舊 `skills/` 來源檔與授權仍保留供參考；目前展示能力不依賴那些本機參考檔或 RPC 工具。

## 主題依據

- 秋季旅行備案：日本氣象廳指出，颱風生成、接近與登陸集中於七至十月。
  [氣象廳統計說明](https://www.jma.go.jp/jma/kishou/know/typhoon/1-4.html)。這是季節背景，並非某一天的預報。
- AI 資訊判讀與詐騙防範：[CISA 的 deepfake 威脅說明](https://www.cisa.gov/news-events/alerts/2023/09/12/nsa-fbi-and-cisa-release-cybersecurity-information-sheet-deepfake-threats)
  提供風險背景；服務依使用者提供的文字整理查核步驟，不宣稱鑑定真假。

## 已知限制

- 模型服務受外部額度限制。此次原先的 Gemini 3.8 Flash 回傳每日免費額度耗盡；目錄使用已探測的其他型號。
  生活與研究使用 3.7 Flash，DeFi 與交易研究使用 3.6 Flash，NFT 與安全使用 3.5 Flash。
  可透過 `CATALOG_MODEL` 指定另一個已確認可用的 Gemini 型號；變更後須重跑驗證。
- 對話驗證能確認這次輸入有回覆並保存，不能保證所有問題答案正確或未來 API 一直可用。
- 下架是本機市集的狀態變更；舊鏈上登記及歷史交易仍可查詢。

## 驗證紀錄

本次自動化與瀏覽器檢查結果完成後記錄於此；團隊過去的人工驗證來源仍保留在 [部署文件](BASE-DEPLOY.md#驗證紀錄)。
