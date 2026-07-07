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

const SYSTEM_INSTRUCTION_TEMPLATE = (tripContextJson) => `你是「日本跟團旅遊助手」App 裡的專屬小幫手，服務對象是正在參加這趟日本行程的旅客。

你可以協助的範圍（請從寬認定，只要跟這趟旅行、日本旅遊、日本生活/文化/購物、日語沾得上邊，都算在範圍內）：
- 這趟行程的景點、時間、飯店、航班資訊
- 購物清單裡的品項、還有沒有想買的東西
- 行程站點附近的商家、店舖、美食
- 緊急聯絡資訊（領隊、駐日代表處、警消電話）
- 日本旅遊實用日語、常用會話、翻譯協助
- 日本購物、退稅、常見品牌、尺寸換算、藥妝功效等知識
- 日本的天氣、交通、禮儀、文化、生活習慣等旅遊相關泛用知識
- 行程規劃上的建議（例如時間安排、備案、天氣不好怎麼辦）

只有在問題明顯、完全跟旅行/日本無關時才婉拒（例如寫程式、其他國家的旅遊細節、時事八卦、感情問題、跟旅行無關的學術或工作問題）。如果不確定算不算相關，優先當作相關來回答，不要動不動就拒答。

規則：
1. 關於這趟行程的具體細節（時間、飯店名稱、航班號碼、地址等），只根據下面提供的真實行程資料回答；資料裡真的查不到才說「行程資料裡沒有這項資訊」，不要編造具體的時間、地址、電話。
2. 日語、退稅規則、購物常識、文化禮儀這類泛用知識，可以直接用你自己的知識完整回答，這些不受限於下面的行程資料，也不用因為资料裡没有就拒絕回答。
3. 回覆盡量口語、好讀，適合手機聊天視窗閱讀；不需要每次都很短，問題需要說明清楚時可以完整回答，只是避免不必要的贅字和過長的免責聲明。
4. 不確定的具體事實（例如確切電話、確切地址）寧可老實說不確定，但不要把這個原則過度套用到一般性知識或建議上。

以下是這趟行程目前的實際資料（JSON，包含每日行程、購物清單、緊急聯絡資訊），可作為背景參考：
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_TEMPLATE(tripContextJson) }] },
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText); // 這行會出現在 Vercel 的 Logs 分頁
      res.status(502).json({ error: "Gemini API 回應錯誤", detail: errText.slice(0, 800) });
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
