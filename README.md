# kaohsiung-japan-tour
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
