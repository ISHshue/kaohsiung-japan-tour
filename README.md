# 日本跟團旅遊助手 — 部署到手機測試

## 為什麼要部署（不能只用預覽視窗）
- Claude 對話裡的預覽視窗跑在沙盒環境，`localStorage` 和 GPS 定位都會被擋掉。
- 手機瀏覽器的定位權限（Geolocation）只在 **HTTPS** 網址下才會生效，用區網 IP（例如
  `http://192.168.x.x:5173`）測試通常也會被手機瀏覽器擋掉。
- 所以要拿到真正可用、能定位、能存資料的版本，必須部署到一個有 HTTPS 的公開網址。
- 部署一次以後，出去玩完全不用帶電腦，手機瀏覽器開網址、或加到主畫面當成 App 圖示即可。

## 你需要準備的東西
- 電腦上已裝 VSCode（你已經有了）
- GitHub 帳號（你已經有了）
- 一個免費的 [Vercel](https://vercel.com) 帳號（用 GitHub 帳號登入即可，不需要另外註冊）
- 電腦需要先安裝 [Node.js](https://nodejs.org)（LTS 版本即可，如果還沒裝的話）

## 步驟一：在本機跑起來確認沒問題
在 VSCode 打開這個資料夾，開啟終端機（Terminal → New Terminal），執行：

```bash
npm install
npm run dev
```

終端機會顯示一個網址（通常是 `http://localhost:5173`），在電腦瀏覽器打開確認畫面正常。
（這階段定位功能在 localhost 是可以測的，因為瀏覽器把 localhost 視為安全環境，但購物清單、行程編輯這些
localStorage 功能這時候就已經可以正常測試。）

## 步驟二：推上 GitHub
在 VSCode 終端機依序執行（把 `你的帳號/你的repo名稱` 換成你自己的）：

```bash
git init
git add .
git commit -m "日本跟團旅遊助手 v1"
git branch -M main
git remote add origin https://github.com/你的帳號/你的repo名稱.git
git push -u origin main
```

如果還沒在 GitHub 上建立 repo，先到 github.com 點右上角「+」→「New repository」建立一個空的 repo，
再照上面指令 push 上去。

## 步驟三：用 Vercel 部署（免費、自動 HTTPS）
1. 到 [vercel.com](https://vercel.com)，用 GitHub 帳號登入
2. 點「Add New...」→「Project」
3. 選擇你剛剛 push 上去的 repo，點「Import」
4. Vercel 會自動偵測到這是 Vite 專案，設定都不用改，直接點「Deploy」
5. 等 1-2 分鐘，會拿到一個網址，例如 `https://kaohsiung-japan-tour.vercel.app`

## 步驟四：手機上測試
1. 用手機瀏覽器（建議 Chrome 或 Safari）打開 Vercel 給你的網址
2. 瀏覽器會跳出「是否允許定位」的權限請求，記得按允許
3. 想要更像 App：
   - iPhone Safari：點分享 → 加入主畫面
   - Android Chrome：點右上角選單 → 加到主畫面
   加入主畫面後點圖示打開，會像獨立 App 一樣全螢幕顯示，沒有瀏覽器網址列

## 之後要修改內容怎麼辦
- 之後想調整行程、改文字、修 bug，就在本機改完 `src/App.jsx`，然後：
  ```bash
  git add .
  git commit -m "更新行程"
  git push
  ```
- Vercel 會自動偵測到 GitHub 有新的 commit，自動重新建置部署，通常 1 分鐘內網址就會更新，
  手機重新整理頁面就會看到最新版本。

## 重要提醒
- **資料只存在你打開網址的那支手機、那個瀏覽器裡**（localStorage）。如果你在旅程中途換手機、
  清除瀏覽器資料、或用無痕模式打開，行程時間調整、購物清單、個人筆記都會消失，回到預設值。
- 出發前建議先在自己手機上完整測試一次：開定位、切換管理者模式、勾選購物清單，確認一切正常再上路。
- 管理者密碼目前寫在 `src/App.jsx` 裡的 `ADMIN_PASSWORD` 常數，要換密碼直接改這裡再重新 push 部署。

## 設定「旅遊小幫手」（Gemini AI 聊天功能）

App 裡第三個分頁「旅遊小幫手」需要額外設定才能運作，因為它牽涉到 API 金鑰，不能直接寫在程式碼裡
（寫在前端程式碼裡的金鑰任何人打開瀏覽器開發者工具都看得到，會被盜用）。

### 步驟一：申請 Gemini API Key（免費）

1. 到 [Google AI Studio](https://aistudio.google.com/apikey)，用你的 Google 帳號登入
2. 點「Create API key」
3. 選一個 Google Cloud 專案（沒有的話它會幫你建一個新的即可）
4. 複製產生出來的金鑰（一長串英數字），先貼到記事本存著，等一下要用

### 步驟二：把金鑰加到 Vercel（不要加到程式碼裡）

1. 到 [vercel.com](https://vercel.com)，打開你這個專案
2. 點上方「Settings」分頁 → 左側選單「Environment Variables」
3. Name 填：`GEMINI_API_KEY`
4. Value 貼上你剛剛複製的金鑰
5. Environment 三個都勾（Production、Preview、Development）
6. 點「Save」

### 步驟三：重新部署

加環境變數不會自動生效，需要觸發一次重新部署：
1. 到「Deployments」分頁
2. 找到最新的一筆部署，點右邊「...」選單 → 「Redeploy」

等 1-2 分鐘部署完成後，手機打開網址，點「旅遊小幫手」分頁，問看看「今天行程有什麼？」測試看看。

### 關於本機測試

`npm run dev`（純 Vite）**不會**執行 `/api/chat.js` 這支後端函式，因為 Vite 開發伺服器只懂前端，
不知道怎麼跑 Vercel Function。所以在本機用 `npm run dev` 時，聊天功能一定會顯示連線錯誤，
這是正常現象，不是壞掉。

如果想在本機也測試聊天功能，需要改用 Vercel 的 CLI 工具：
```bash
npm install -g vercel
vercel dev
```
第一次執行會問你要不要連結到 Vercel 帳號、選哪個專案，跟著指示做即可。也需要在本機建立
`.env.local` 檔案，內容為 `GEMINI_API_KEY=你的金鑰`（這個檔案已經在 `.gitignore` 裡，不會被
不小心 push 上 GitHub）。

如果只是想確認功能能不能用，最簡單還是直接部署到 Vercel 上用手機測試，不用在本機折騰。

### 費用與用量

Google AI Studio 的免費額度對這種個人使用規模非常足夠（一趟六天的行程，就算每天問幾十個問題
也遠遠用不完免費額度）。後端已經加了簡單的限流（每人每分鐘最多 15 次請求），避免網址不小心
外流被濫用刷爆額度。如果之後想要更嚴謹的用量控管，可以考慮在 Google Cloud 主控台幫這個專案
設定每日預算上限的告警通知。

## 天氣自動更新（Open-Meteo，免金鑰、不需要後端）

行程頁的天氣卡片會在每天第一次打開 App 時，自動向 [Open-Meteo](https://open-meteo.com/) 查詢當天
所在城市的天氣預報並存起來，同一天不會重複查詢。Open-Meteo 是完全免費、不需要申請金鑰、
瀏覽器可以直接呼叫的公開氣象 API，所以這個功能**不需要**額外設定，也跟 Gemini 的額度完全無關。

同樣地，這不是真正的背景推播——沒開 App 的時候不會自動更新，是「打開 App 時檢查有沒有查過
今天」。查詢失敗時（例如離線）會自動顯示行程裡預先寫好的估算天氣，不會讓畫面壞掉。


