// /api/nearby.js — Vercel Serverless Function
//
// 為什麼需要這一層：OpenStreetMap 的 Overpass API 公開伺服器不會回傳
// Access-Control-Allow-Origin 標頭，瀏覽器會直接擋掉跨網域的請求（CORS），
// 不管前端程式碼怎麼寫都繞不過去——這是 Overpass 服務本身的限制，不是設定問題。
//
// 解法：伺服器對伺服器的請求不受 CORS 限制，所以改由這支後端函式代為查詢 Overpass，
// 前端只呼叫自己網域底下的 /api/nearby（同源請求，不會有 CORS 問題）。
//
// 這支函式不需要任何 API 金鑰（Overpass 本身免費、免申請）。
//
// 本機用 `npm run dev`（純 Vite）一樣「不會」執行這支檔案，跟 /api/chat.js 的限制相同，
// 請參考 README 使用 `vercel dev` 或直接部署到 Vercel 上測試。

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
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

// 依序嘗試多個公開 Overpass 鏡像站：第一個回應失敗（含 429 額度限制）就自動換下一個，
// 不用整個功能因為單一鏡像站當下忙碌就掛掉。這些站台都是社群free 資源，穩定度本來就會浮動。
const OVERPASS_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function queryOverpass(query) {
  let lastError = null;

  for (const url of OVERPASS_MIRRORS) {
    try {
      const overpassRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "KaohsiungJapanTourApp/1.0 (personal travel itinerary app; not for commercial use)",
        },
        body: "data=" + encodeURIComponent(query),
      });

      if (!overpassRes.ok) {
        const errText = await overpassRes.text();
        console.error(`Overpass mirror ${url} error:`, overpassRes.status, errText.slice(0, 300));
        lastError = { status: overpassRes.status, detail: errText.slice(0, 300) };
        continue; // 換下一個鏡像站
      }

      return { ok: true, json: await overpassRes.json() };
    } catch (err) {
      console.error(`Overpass mirror ${url} fetch failed:`, err);
      lastError = { status: null, detail: String(err) };
    }
  }

  return { ok: false, error: lastError };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "請求太頻繁，請稍等一下再試" });
    return;
  }

  const { lat, lng, radius } = req.body || {};
  if (typeof lat !== "number" || typeof lng !== "number" || typeof radius !== "number") {
    res.status(400).json({ error: "缺少或格式錯誤的 lat / lng / radius" });
    return;
  }

  const query =
    `[out:json][timeout:25];(` +
    `node["shop"](around:${radius},${lat},${lng});` +
    `node["amenity"~"restaurant|cafe|fast_food|pharmacy|place_of_worship"](around:${radius},${lat},${lng});` +
    `node["tourism"~"attraction|viewpoint|museum|gallery"](around:${radius},${lat},${lng});` +
    `node["historic"](around:${radius},${lat},${lng});` +
    `node["leisure"="park"](around:${radius},${lat},${lng});` +
    `);out body;`;

  const result = await queryOverpass(query);

  if (!result.ok) {
    const status = result.error?.status || 502;
    res.status(status === 429 ? 429 : 502).json({
      error: `所有 Overpass 鏡像站都查詢失敗（最後一個回應：HTTP ${result.error?.status ?? "無回應"}）`,
      detail: result.error?.detail || "",
    });
    return;
  }

  res.status(200).json({ elements: result.json.elements || [] });
}
