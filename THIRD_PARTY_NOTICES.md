# 第三方來源與授權

分身有術建立在許多人的成果上。這份清單說明我們用了什麼、放在哪裡，以及來源與授權。
根目錄 MIT 適用於本專案自行撰寫的程式與文件；第三方內容保留原著作權與條款，
不會因為放進本儲存庫就改成 MIT。

版本依 `pnpm-lock.yaml` 與 2026-09-06 的已安裝套件核對。
[完整 npm 依賴盤點](docs/dependency-licenses.json) 包含直接、間接與開發依賴的名稱、版本、來源及套件宣告授權。
這份盤點是檔案內 sourceCommit 的 macOS arm64 安裝快照，包含當時尚未移除的前端 fetch SDK；目前直接依賴以鎖檔與下表為準。其他平台的選用套件、Solidity 依賴與 skill 另依其來源檔案確認。
套件 metadata 的 `Unknown` 不代表沒有授權，人工補查結果列於下方。

## 直接使用的套件

| 套件／版本 | 用途 | 來源與授權 |
| --- | --- | --- |
| `@google/generative-ai` 0.24.1 | 後端模型 SDK | [Google](https://github.com/google/generative-ai-js)，Apache-2.0 |
| `hono` 4.12.9、`@hono/node-server` 1.19.11 | HTTP API | [Hono](https://github.com/honojs/hono)、[Node adapter](https://github.com/honojs/node-server)，MIT |
| `@x402/core`、`@x402/evm`、`@x402/hono`、`@x402/fetch` 2.25.0 | 後端 x402 驗證與結算；前端錢包頁的付費分析摘要 | [x402](https://github.com/x402-foundation/x402)，Apache-2.0 |
| `next` 14.2.35 | 前端框架 | [Next.js](https://github.com/vercel/next.js)，MIT |
| `react`、`react-dom` 18.3.1 | UI 與渲染 | [React](https://github.com/facebook/react)，MIT |
| `@rainbow-me/rainbowkit` 2.2.10 | 錢包連接 UI | [RainbowKit](https://github.com/rainbow-me/rainbowkit)，MIT |
| `wagmi` 2.19.5、`viem` 2.47.6 | 錢包狀態與 EVM 互動 | [wagmi](https://github.com/wevm/wagmi)、[viem](https://github.com/wevm/viem)，MIT |
| `@tanstack/react-query` 5.95.2 | 前端請求狀態 | [TanStack Query](https://github.com/TanStack/query)，MIT |
| `framer-motion` 12.43.0 | UI 動態效果 | [Motion](https://github.com/motiondivision/motion)，MIT |
| `react-markdown` 10.1.0、`remark-gfm` 4.0.1 | 對話的 Markdown 與表格 | [react-markdown](https://github.com/remarkjs/react-markdown)、[remark-gfm](https://github.com/remarkjs/remark-gfm)，MIT |
| `tailwindcss`、`postcss`、`autoprefixer` | CSS 建置 | [Tailwind](https://github.com/tailwindlabs/tailwindcss)、[PostCSS](https://github.com/postcss/postcss)、[Autoprefixer](https://github.com/postcss/autoprefixer)，MIT |
| `typescript` | 型別檢查 | [TypeScript](https://github.com/microsoft/TypeScript)，Apache-2.0 |
| `eslint`、`eslint-config-next` | 靜態檢查 | [ESLint](https://github.com/eslint/eslint)、[Next.js](https://github.com/vercel/next.js)，MIT |
| `@types/node`、`@types/react`、`@types/react-dom` | TypeScript 型別 | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)，MIT |
| `bun-types` | Bun 型別 | [Bun](https://github.com/oven-sh/bun)，MIT |

開發套件的逐一解析版本見依賴盤點。原始授權文字隨套件或其上游儲存庫提供；
重新散布套件或前端 bundle 時，需一併保留適用的著作權與授權告示。

### 間接依賴的個別條款

錢包套件還帶入以下依賴；直接依賴的 MIT 授權不能代替它們的條款：

| 套件 | 核對結果 |
| --- | --- |
| `@metamask/sdk` 0.33.1、`@metamask/sdk-communication-layer` 0.33.1、`@metamask/sdk-install-modal-web` 0.32.1 | 隨附 ConsenSys 自訂授權，原文保留於 [MetaMask-SDK.txt](docs/licenses/MetaMask-SDK.txt)。其中定義 Non-Commercial Use、通知義務與使用範圍，不能標成 MIT。 |
| `@metamask/eth-json-rpc-provider` 1.0.1 | 已安裝版本與[上游 v1.0.1](https://github.com/MetaMask/eth-json-rpc-provider/tree/v1.0.1) 未附明確 LICENSE，列為待釐清；不推定為 MIT。 |
| `rpc-websockets` 9.3.6 | [上游](https://github.com/elpheria/rpc-websockets)，LGPL-3.0-only。 |
| `@ethereumjs/rlp` 4.0.1、`@ethereumjs/tx` 4.2.0、`@ethereumjs/util` 8.1.0 | [EthereumJS](https://github.com/ethereumjs/ethereumjs-monorepo)，MPL-2.0。 |
| `webextension-polyfill` 0.10.0、`axe-core` 4.11.1 | [Mozilla](https://github.com/mozilla/webextension-polyfill)、[axe-core](https://github.com/dequelabs/axe-core)，MPL-2.0；後者是開發檢查依賴。 |
| `eyes` 0.1.8 | metadata 為 Unknown，隨附 LICENSE 為 MIT。來源：[eyes.js](https://github.com/cloudhead/eyes.js)。 |
| `text-encoding-utf-8` 1.0.2 | metadata 為 Unknown，隨附 LICENSE.md 為 public-domain dedication；並揭露 [WHATWG Encoding](https://encoding.spec.whatwg.org/) 衍生內容。來源：[text-encoding](https://github.com/inexorabletash/text-encoding)。 |

**ConsenSys 告示：**本專案的錢包依賴包含上述 MetaMask SDK 程式，
Copyright ConsenSys Software Inc. 2022. All rights reserved.
包含這些程式的散布版本須遵守隨附原文的通知與 Non-Commercial Use 限制。
這份來源清單不將各依賴的條款合併成一份授權。

## 合約與隨庫保留的程式

| 內容 | 來源／版本 | 使用方式與授權位置 |
| --- | --- | --- |
| OpenZeppelin Contracts | [OpenZeppelin](https://github.com/OpenZeppelin/openzeppelin-contracts)，5.6.1 | escrow 使用 IERC20、SafeERC20、ReentrancyGuard；[MIT](contracts/lib/openzeppelin-contracts/LICENSE) |
| Forge Std | [Foundry](https://github.com/foundry-rs/forge-std)，1.15.0 | 合約測試與部署；[MIT](contracts/lib/forge-std/LICENSE-MIT) 或 [Apache-2.0](contracts/lib/forge-std/LICENSE-APACHE) |
| OpenZeppelin 內的 Forge Std | 同上，1.14.0 | 上游測試依賴；[MIT](contracts/lib/openzeppelin-contracts/lib/forge-std/LICENSE-MIT) 或 [Apache-2.0](contracts/lib/openzeppelin-contracts/lib/forge-std/LICENSE-APACHE) |
| `erc4626-tests`、`halmos-cheatcodes` | [a16z ERC4626 tests](https://github.com/a16z/erc4626-tests)、[halmos-cheatcodes](https://github.com/a16z/halmos-cheatcodes) | 隨 OpenZeppelin 保留的測試工具，非 ManyMe 合約匯入路徑；[AGPL-3.0](contracts/lib/openzeppelin-contracts/lib/erc4626-tests/LICENSE)、[AGPL-3.0](contracts/lib/openzeppelin-contracts/lib/halmos-cheatcodes/LICENSE) |
| Compound Timelock 介面 | OpenZeppelin 隨附的 Compound 衍生檔案 | 保留檔案中的 MIT 標示及目錄內 [Compound 告示](contracts/lib/openzeppelin-contracts/contracts/vendor/compound/LICENSE)，未用於 ManyMe escrow |

這些目錄以一般檔案納入 Git，版本依套件 metadata；原匯入未記錄精確的上游 commit。
本專案沒有把上游測試工具的授權改成根目錄 MIT。

## Skill、資料與示範內容

| 內容 | 來源 | 使用方式與授權 |
| --- | --- | --- |
| `skills/defi-onchain-analytics-main/` | [Omnis Labs / defi-onchain-analytics](https://github.com/Omnis-Labs/defi-onchain-analytics) | 匯入 DeFi 分析方法、patterns 與 references，保留作為歷史範例參考；保留 [MIT](skills/defi-onchain-analytics-main/LICENSE) 與 Omnis Labs 著作權。未記錄上游 commit／修改對照。 |
| `skills/smart-contract-security/` | 團隊自行製作（已由作者確認） | 安全分析範例，適用本專案 [MIT](LICENSE)。 |
| `skills/trading-signal-engine/` | 團隊自行製作（已由作者確認） | 交易分析範例，適用本專案 [MIT](LICENSE)。 |
| `skills/nft-market-intelligence/` | 團隊自行製作（已由作者確認） | NFT 分析範例，適用本專案 [MIT](LICENSE)。 |
| 展示服務目錄 | [`demoCatalog.ts`](backend/src/db/demoCatalog.ts) | 本專案自行撰寫的服務提示詞與測試輸入，適用本專案 MIT；不再自動上架第三方 pattern。主題來源見[展示服務目錄](docs/DEMO-CATALOG.md)。 |
| 鏈上查詢 | [`toolExecutor.ts`](backend/src/services/skill/toolExecutor.ts) 與 skill 內列出的 RPC／協定參考 | 按請求查詢公開鏈上資料；原始協定、ABI 與資料服務的來源保留在 references，未宣稱擁有原資料的授權。 |

上傳新 skill 或資料時，需要保留其來源、授權與修改說明。
本專案沒有發佈 Gemini 模型權重或訓練資料集。

## 字型、圖示與畫面素材

| 素材 | 來源 | 授權與使用方式 |
| --- | --- | --- |
| Noto Sans TC | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosanstc) | [SIL OFL 1.1](docs/licenses/Noto-Sans-TC-OFL.txt)，由 `next/font/google` 自行託管，作為繁體中文主字型 |
| Inter（舊版） | [Inter / Google Fonts](https://github.com/google/fonts/tree/main/ofl/inter) | [SIL OFL 1.1](docs/licenses/Inter-OFL.txt)，由 `next/font/google` 載入 |
| Newsreader（舊版） | [Newsreader / Google Fonts](https://github.com/google/fonts/tree/main/ofl/newsreader) | [SIL OFL 1.1](docs/licenses/Newsreader-OFL.txt)，由 `next/font/google` 載入 |
| Material Symbols Outlined | [Google Material Design Icons](https://github.com/google/material-design-icons) | [Apache-2.0](docs/licenses/Material-Symbols-Apache-2.0.txt)，由 Google Fonts CSS 載入 |

載入位置為 [`frontend/app/layout.tsx`](frontend/app/layout.tsx)。
目前 Git 追蹤的前端沒有另附照片或外部圖片檔；新版品牌記號與操作圖示是專案自行繪製的幾何 SVG。
之後加入截圖、照片、影片或其他素材時，應同步更新此表。

## 外部服務與條款

| 服務 | 在本作品中的用途 | 來源與條款 |
| --- | --- | --- |
| Google Gemini API | 模型清單與生成回覆 | [Gemini API 條款](https://ai.google.dev/gemini-api/terms)；SDK 的 Apache-2.0 不代表模型本身採此授權 |
| Base Sepolia / 公開 RPC | 合約交易與鏈上讀取 | [Base 文件](https://docs.base.org/)、[Base 條款](https://docs.base.org/terms-of-service)；公共端點依提供者規則使用 |
| Circle test USDC / faucet | 展示付款資產與測試幣 | [Circle faucet](https://faucet.circle.com/)、[Circle 條款](https://console.circle.com/legal/developer-terms)；測試幣不代表真實資金 |
| x402 facilitator | 驗證與結算單次付款 | 預設端點 `https://x402.org/facilitator`；[x402 文件](https://www.x402.org/)。服務使用條款依所選提供者確認，協定 SDK 授權不涵蓋代管服務承諾 |
| BaseScan | 顯示公開交易證據連結 | [Base Sepolia explorer](https://sepolia.basescan.org/)、[條款](https://basescan.org/terms) |
| OKX OnchainOS | 保留的鏈上資料 client；核心旅行展示不需要 | [`onchainosClient.ts`](backend/src/services/data/onchainosClient.ts)、[OKX Web3](https://web3.okx.com/)；啟用時另依 API 提供者條款與憑證使用 |

## 更新這份清單

依賴異動後，先按 lockfile 安裝，再取得機器清單：

```bash
pnpm install --frozen-lockfile
pnpm licenses list --json > /tmp/manyme-licenses.json
```

更新 `docs/dependency-licenses.json` 時只保留名稱、版本、授權與公開來源，
不要提交 pnpm 原始輸出中的本機路徑或個人聯絡資料；同時更新日期、程式版本與 lockfile SHA-256。
`Unknown` 項目需另讀隨附 LICENSE，不要直接改填 MIT。

上架頁連結至 [Agent Skills 官方格式說明](https://agentskills.io/specification)，提供作者查閱；本站操作說明依現行匯入器自行撰寫，未複製官方文件全文。首頁分身 SVG 與動畫為本次自行製作。
