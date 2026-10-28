# Password Saver

一個在本機加密儲存密碼、並自動填入登入表單的 Chrome 擴充功能（Manifest V3）。所有資料只存在你的電腦上，不會上傳到任何伺服器。

## 功能

- **登入時提示儲存**：送出登入表單後，右上角會詢問是否儲存密碼；密碼有變更時會改為詢問是否更新。支援一般表單、沒有 `<form>` 的 SPA、帳號與密碼分兩頁的多步驟登入，以及變更密碼表單。
- **欄位內自動填入**：聚焦帳號或密碼欄位時，右側會出現鑰匙圖示，並列出此網站已儲存的帳號，點一下即可填入。同源的 iframe 也能使用。
- **Popup 保險庫**：目前網站的帳號置頂，可搜尋、一鍵填入、複製帳號或密碼，也能新增、編輯、刪除。
- **自動鎖定**：閒置一段時間（預設 15 分鐘，可調整）或關閉瀏覽器後自動鎖定。
- **匯入與匯出**：支援 Chrome / Google 密碼管理工具匯出的 CSV，也相容 Bitwarden 等常見格式。
- **永不儲存清單**：可以指定某些網站不再詢問是否儲存。
- 支援深色模式。

## 安全設計

| 項目 | 做法 |
| --- | --- |
| 金鑰衍生 | 主密碼經 PBKDF2-SHA256（600,000 次迭代）加隨機 salt 產生金鑰 |
| 加密 | AES-256-GCM，每次寫入都使用新的隨機 IV |
| 儲存位置 | 加密後的保險庫存在 `chrome.storage.local`；解鎖後的金鑰只存在 `chrome.storage.session`（記憶體內，瀏覽器關閉即清除） |
| 明文存取 | 只有 Service Worker 能接觸明文；網頁中的內容腳本只會拿到符合目前網站的帳號，且網站來源由瀏覽器判定，不信任網頁傳來的網址 |
| 填入 | 必須由使用者點選才會填入，不會在頁面載入時靜默填入；只在頂層頁面與同源 iframe 中運作 |
| HTTPS | 在 HTTPS 儲存的密碼不會提供給同網站的 HTTP 頁面，HTTP 網站會顯示警告 |
| 頁面隔離 | 網頁上的介面放在封閉的 Shadow DOM 中，網頁腳本無法讀取帳號建議 |
| 匯出 | 必須重新輸入主密碼，並提醒匯出的 CSV 是未加密的明文 |

> **忘記主密碼將無法復原任何資料。** 沒有任何人（包括開發者）能解密你的保險庫。

## 安裝（開發者模式）

需要 Node.js 18 以上。

```bash
npm install
npm run build
```

1. 在 Chrome 開啟 `chrome://extensions`
2. 開啟右上角的「開發人員模式」
3. 按「載入未封裝項目」，選擇 `dist` 資料夾
4. 安裝後會自動開啟設定頁，建立主密碼即可開始使用

## 開發

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開發模式（支援熱更新），在 Chrome 載入 `dist` 資料夾 |
| `npm run build` | 型別檢查並建置正式版到 `dist` |
| `npm test` | 執行單元測試（加密、網址比對、CSV 解析） |
| `npm run e2e` | 建置測試版並以 Playwright Chromium 執行端到端測試 |
| `npm run serve:test-pages` | 在 `http://localhost:5500` 提供手動測試用的登入頁 |

第一次執行端到端測試前，需要先下載測試用的瀏覽器：

```bash
PLAYWRIGHT_BROWSERS_PATH=$PWD/.playwright npx playwright install chromium
```

端到端測試會涵蓋建立保險庫、各種登入表單的儲存與更新、自動填入、鎖定與解鎖、永不儲存、CSV 匯入匯出，並確認儲存的資料沒有明文。截圖會輸出到 `test-results/`。

## 專案結構

```
src/
  background/   Service Worker：保險庫、加解密、自動鎖定、訊息處理
  content/      內容腳本：表單偵測、送出攔截、填入，以及 Shadow DOM 介面
  popup/        工具列 Popup：鎖定畫面、密碼清單、詳細資料與編輯
  options/      設定頁：初始設定精靈、自動鎖定、永不儲存清單、匯入匯出
  lib/          共用邏輯：加密、網址比對、CSV、訊息型別
  ui/           Popup 與設定頁共用的元件
test-pages/     手動與自動測試用的登入頁
scripts/        圖示產生器與端到端測試腳本
```

技術棧：TypeScript、React 18、Vite、[CRXJS](https://crxjs.dev/)、Tailwind CSS、Vitest、Playwright。

## 權限說明

| 權限 | 用途 |
| --- | --- |
| `storage` | 在本機儲存加密後的保險庫與設定，並在 session 中暫存解鎖狀態 |
| `alarms` | 閒置一段時間後自動鎖定保險庫 |
| `favicon` | 在 Popup 中顯示網站圖示 |
| `<all_urls>`（網站存取權） | 在使用者造訪的網站上偵測登入表單、提示儲存並填入密碼 |

## 已知限制

- 目前無法更改主密碼。
- 沒有密碼產生器與跨裝置同步。
- 不支援跨網域的 iframe（例如嵌入第三方登入頁）。

## 授權

[Apache License 2.0](LICENSE)
