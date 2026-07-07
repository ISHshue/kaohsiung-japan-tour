// /api/chat.js — Vercel Serverless Function
//
// 這支檔案跑在伺服器端，不是瀏覽器端，所以 GEMINI_API_KEY 永遠不會被使用者看到。
// 金鑰請到 Vercel 專案的 Settings → Environment Variables 加入，不要寫在程式碼裡。
//
// 本機用 `npm run dev`（純 Vite）是「不會」執行這支檔案的 —— Vite 的開發伺服器只處理前端，
// 不知道怎麼跑 Vercel Function。要在本機測試這支 API，請改用 `vercel dev`（見 README）。
// 最簡單的方式是直接部署到 Vercel 上測試。

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 每人每分鐘
const RATE_LIMIT_MAX = 15; // 最多 15 次請求

// 簡易記憶體限流：只在單一 function 執行個體存活期間有效，不是跨機房強保證，
// 但足以擋掉「隨手狂點」或簡單的自動化濫用，是低成本的第一道防線。
const rateLimitMap = new Map();

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  rateLimitMap.set(key, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

const SYSTEM_INSTRUCTION_TEMPLATE = (tripContextJson) => `你是「日本跟團旅遊助手」App 裡的專屬小幫手，只服務這一趟行程的相關問題。

你可以協助的範圍：
- 這趟行程的景點、時間、飯店、航班資訊
- 購物清單裡的品項
- 行程站點附近的商家、店舖
- 緊急聯絡資訊（領隊、駐日代表處、警消電話）
- 日本旅遊實用日語（例如怎麼問廁所、殺價、點餐、問路）
- 日本購物相關知識（例如退稅規則、常見藥妝功效、尺寸換算、常見品牌）

規則：
1. 如果使用者問的問題跟這趟行程、日本旅遊、日本購物、日語完全無關（例如寫程式、其他國家的旅遊、時事八卦、感情問題等），禮貌婉拒並引導使用者回到行程相關的問題，不要硬回答。
2. 關於行程細節（時間、飯店名稱、航班號碼、地址等），只根據下面提供的真實行程資料回答；資料裡沒有的資訊要老實說「行程資料裡沒有這項資訊」，絕對不要瞎猜或編造具體的時間、地址、電話。
3. 日語小知識、退稅規則、購物常識這類泛用知識可以用你自己的知識回答，但要清楚說明這是一般性資訊，實際規定以現場公告、店家或海關人員說明為準。
4. 回覆盡量簡短、口語，適合在手機聊天視窗閱讀，不要長篇大論，也不要條列超過 5 點。
5. 不確定的資訊寧可老實說不確定，不要為了讓答案看起來完整而編造細節。

以下是這趟行程目前的實際資料（JSON，包含每日行程、購物清單、緊急聯絡資訊）：
${tripContextJson}
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "伺服器尚未設定 GEMINI_API_KEY。請到 Vercel 專案的 Settings → Environment Variables 加入後，重新部署一次。",
    });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "問太快了，請稍等一下再試（每分鐘上限 15 次）" });
    return;
  }

  const { message, history, tripContext } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "缺少 message 內容" });
    return;
  }
  if (message.length > 1000) {
    res.status(400).json({ error: "問題太長了，請縮短一些" });
    return;
  }

  // 避免 context 過大造成不必要的花費，做個保守長度上限
  const tripContextJson = JSON.stringify(tripContext || {}).slice(0, 60000);

  const contents = [
    ...(Array.isArray(history)
      ? history.slice(-10).map((h) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: String(h.text || "").slice(0, 2000) }],
        }))
      : []),
    { role: "user", parts: [{ text: message }] },
  ];

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_TEMPLATE(tripContextJson) }] },
          generationConfig: { maxOutputTokens: 500, temperature: 0.6 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      res.status(502).json({ error: "Gemini API 回應錯誤", detail: errText.slice(0, 500) });
      return;
    }

    const data = await geminiRes.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "（沒有取得回應內容，可能是問題被安全機制擋下了，換個問法試試）";

    res.status(200).json({ reply: text });
  } catch (err) {
    res.status(500).json({ error: "呼叫 Gemini 時發生錯誤", detail: String(err) });
  }
}
