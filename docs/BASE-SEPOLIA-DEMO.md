# 第一次跑分身有術

這份指南從一份新 clone 的程式碼開始，帶你完成設定、上架一個旅行服務，
再用買家的身分提問、結束退款，最後回到達人端領款。
全程使用 Base Sepolia 測試網與測試幣，x402 mock 關閉。

## 準備工具

以下是 2026-09-06 本機驗證使用的版本，供重現時對照；不是最低版本承諾。

| 工具 | 驗證版本 | 安裝說明 |
| --- | --- | --- |
| Node.js | 24.15.0 | [Node.js](https://nodejs.org/en/download) |
| pnpm | 9.15.0 | [pnpm](https://pnpm.io/installation) |
| Bun | 1.4.2 | [Bun](https://bun.sh/docs/installation) |
| Foundry / forge | 1.7.1 | [Foundry](https://getfoundry.sh/introduction/installation/) |
| Solidity | 0.8.20 | 由 `contracts/foundry.toml` 指定，Foundry 編譯時取得 |

驗證環境為 macOS arm64。啟動腳本需要 Bash；Windows 請在 WSL 使用。
安裝套件、下載編譯器／Google Fonts、呼叫模型與測試網都需要網路。

## 1. 取得程式碼與安裝依賴

```bash
git clone https://github.com/bill3129066/manyme.git
cd manyme
pnpm install --frozen-lockfile
```

`pnpm-lock.yaml` 固定套件解析結果。合約依賴已放在 `contracts/lib/`，
這個版本不需要另外執行 `forge install` 或初始化 submodule。

## 2. 設定環境檔

以下複製指令只用在第一次設定；已有環境檔時請直接編輯，保留原本的錢包。

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

在根目錄 `.env` 填入 `GEMINI_API_KEY`，可從 [Google AI Studio](https://aistudio.google.com/apikey) 建立。
金鑰所屬專案需要有可用的 Gemini API 額度。這是核心展示唯一需要自行申請的外部 API key。

| 位置／設定 | 要做的事 |
| --- | --- |
| `.env` 的 `GEMINI_API_KEY` | 填入自己的 key，僅供後端使用 |
| `BASE_CHAIN_ID` / `BASE_RPC_URL` | 保留 `84532` / `https://sepolia.base.org` |
| `USDC_ADDRESS` | 保留範例內的 Circle Base Sepolia USDC 地址 |
| `X402_MOCK` / `ALLOW_UNVERIFIED_DEPOSITS` | 兩者保留 `false` |
| `PLATFORM_WALLET`、三個錢包私鑰與 `DEPLOYER_PRIVATE_KEY` | 由下一步產生 |
| `ESCROW_CONTRACT_ADDRESS` | 由部署步驟填入 |
| `frontend/.env.local` | 保留範例；部署會填入公開合約地址 |

前端的 `NEXT_PUBLIC_TEST_WALLET=true` 啟用 Test author／Test payer。
私鑰放在根目錄 `.env`，由伺服器端載入，不能加上 `NEXT_PUBLIC_` 前綴。
環境檔已列入 `.gitignore`。只使用專用測試錢包，不要填入持有真實資產的私鑰。

## 3. 產生錢包並領取測試幣

```bash
bun scripts/testnet/setup.ts
```

指令把測試私鑰存入 `.env`，畫面只列出三個公開地址：

| 地址 | 身分 | 需要的測試幣 |
| --- | --- | --- |
| `platform` | 部署合約、提交 proof 與支付 gas | Base Sepolia ETH |
| `payer` | 買家 | Circle Base Sepolia test USDC |
| `author` | 達人 | 部署指令會從 platform 補少量 ETH gas |

從 [Base 官方列出的 faucet](https://docs.base.org/get-started/get-funds) 取得測試 ETH，
填入 `platform` 地址；從 [Circle faucet](https://faucet.circle.com/) 選擇 Base Sepolia、USDC，
填入 `payer` 地址。請等測試幣入帳後再往下走。

`setup.ts` 會沿用環境檔中已存在的測試私鑰。若要重跑，保留 `.env`，
就能繼續使用原本已領取測試幣的錢包。

## 4. 編譯並部署合約

從專案根目錄執行：

```bash
(cd contracts && forge build)
bun --env-file=.env scripts/testnet/deploy.ts
```

部署指令會確認網路為 Base Sepolia、部署 `ManyMeEscrow`，將地址寫入根目錄 `.env`
及 `frontend/.env.local`，並為 payer／author 補足少量 gas。
已有合約地址且鏈上有程式碼時會沿用；新部署的公開交易紀錄寫入 `scripts/testnet/deployment.json`。

看到部署地址與交易結果後，可到 [Base Sepolia explorer](https://sepolia.basescan.org/) 查詢。
若顯示餘額不足，先替 platform 補測試 ETH，再重跑部署指令。

## 5. 啟動前後端

```bash
./run.bash
```

保持這個終端機開著，等待前端顯示 Ready。啟動器會檢查 Gemini key、付款設定、chain ID 與合約，
啟動後端及前端；後端會自動建表，首次填入範例服務。預設資料庫是 `backend/dev.db`。

- 前端：[http://localhost:3000](http://localhost:3000)
- 後端健康檢查：[http://localhost:3001/health](http://localhost:3001/health)，應回傳 `status: "ok"`。
- 結束本機服務：在啟動終端機按 Ctrl+C。請先結束使用中的 session、完成退款，再關閉服務。

範例資料不等於已完成鏈上註冊的達人服務。第一次完整體驗，請依下方步驟自行上架。

### 連接埠已被占用時

`run.bash` 固定使用 3000／3001。先確認是否已有其他測試在執行；需要兩套同時運行時，
可分別在兩個終端機執行以下命令。命令仍使用同一份真實服務設定，另開資料庫：

```bash
# 終端機一：從專案根目錄啟動後端
PORT=3101 DATABASE_URL=file:./backend/docs-demo.db \
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100 \
bun --env-file=.env backend/src/server.ts
```

```bash
# 終端機二：從專案根目錄進入前端
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:3101 \
bun --env-file=../.env node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100
```

此時開啟 [http://localhost:3100](http://localhost:3100)。

## 走一次完整流程

### 達人：把經驗上架

1. 連接 **Test author**，點選 **Upload**。
2. 建立「三代旅行規劃師」，說明為「協助三代同行家庭比較交通、住宿與每日活動安排」。
3. 在提示詞填入：「先確認旅遊天數、長輩步行能力、小孩年齡與預算，再比較交通和住宿。說明每個安排的取捨；資訊不足時先提問。」
4. 從模型清單選擇帳號可用的 Gemini 模型。示範可將達人收入設為 `0.0097 USDC/sec`。
5. 確認錢包操作，等待鏈上註冊完成，再到市集確認服務出現。

目前平台費另加 `0.0003 USDC/sec`，所以上述例子的買家總費率為 `0.0100 USDC/sec`。
設為零達人收入時，該服務不會產生達人分潤。

### 買家：提出需求，再補充限制

1. 中斷 author 連線，改連 **Test payer**，選擇剛上架的服務。
2. 輸入：「我要帶爸媽和小孩去台北玩半天，不想自駕。長輩不能走太久，小孩五歲，怎麼安排？」設定 `1 USDC` 預算。
3. 按 **Start Session**，完成登入簽名、必要的 USDC 授權與預算存入交易。
4. 查看回覆與工作紀錄，再追問：「如果當天下雨，我希望都在室內，要怎麼調整？」確認回覆有處理新增條件。
5. 按 **End Session**，完成停止與退款交易。查看最後費用、退回金額及鏈上交易。

依範例費率，`1 USDC` 預算約可支付 100 秒；gas 另以測試 ETH 支付。
同一錢包的登入授權可供後續操作重用，鏈上存款、停止與退款仍各有交易。
費用以鏈上結算為準；proof 記錄服務活動，不保證回答正確。

### 達人：領取收入

切回 **Test author**，開啟 **Studio**，點選 **Claim earnings**。
等待交易確認，應看到領款交易連結與更新後的待領餘額。

### 單次查詢：x402

開啟 `/query`，選擇服務與要取得的資源，依畫面支付測試 USDC。
驗收時要同時看到查詢結果與付款交易連結；只有收到 HTTP 402 付款要求，還不代表結算完成。
這段流程與按秒計費的 session 分開。

## 驗證紀錄

完整對話與追問已由團隊人工驗證。開發期間也驗證了達人上架、買家存入預算、
費用顯示、結束退款、評分及達人領款。以下保留可公開查詢的測試網交易：

- [x402 結算交易](https://sepolia.basescan.org/tx/0x092130ef44314f31540f2b1eed603dbf3a5eb1a5df1d6c285e67002c3efcbab7)
- [達人領款交易](https://sepolia.basescan.org/tx/0x9b33e5fd97c13bd341a41cc2274ea4e839dd21192753f823fbef686d39c7c776)

2026-09-06 文件整理以程式版本 `42d2301` 重跑：

| 檢查 | 結果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通過 |
| 前後端 TypeScript | 通過 |
| 後端 `bun test` | 41 通過 |
| 前端 `bun test` | 10 通過 |
| `forge test` | 26 通過 |
| 前端 production build | 通過；有 Newsreader 字型 metrics 與 Browserslist 資料更新提示 |
| 新資料庫後端啟動、健康檢查、x402 CORS 檢查 | 通過，使用 3101 連接埠 |

此次本機檢查沿用已部署的測試網環境，另開資料庫與 3100／3101，未重部署合約。
人工對話驗證與本次程式檢查分別記錄；測試通過的範圍以各項檢查為準。

服務啟動後，可另跑：

```bash
bun scripts/testnet/check-http.ts
# 若使用 3101：NEXT_PUBLIC_API_URL=http://localhost:3101 bun scripts/testnet/check-http.ts
```

## 遇到問題時

| 現象 | 先檢查 |
| --- | --- |
| 啟動要求 Gemini key | 是否填在根目錄 `.env`，且從根目錄執行 `run.bash` |
| 提示先部署 escrow | 是否完成步驟 3、4；根目錄與前端合約地址是否一致 |
| 交易餘額不足 | platform 是否有測試 ETH、payer 是否有 test USDC；重新執行部署可補 payer／author gas |
| Test wallet 無法使用 | 使用 localhost、`NEXT_PUBLIC_TEST_WALLET=true`，私鑰由啟動程序在伺服器端載入 |
| 模型清單或回覆無法載入 | 檢查 Gemini 專案權限、額度與網路；可執行下列獨立探測 |
| 重啟後要求再簽一次 | 登入授權保存在後端記憶體，重啟後需重新登入 |

```bash
# 會呼叫真實模型並使用 API 額度
bun --env-file=.env scripts/testnet/check-model.ts
```

這個探測使用程式內指定的 `gemini-3.8-flash`；上架頁的模型清單則從 API 即時取得。
模型回覆內容不保證逐字相同，請以是否回應問題與新增限制驗收。
