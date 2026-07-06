import React, { useState, useEffect, useMemo } from "react";
import {
  Sun,
  Moon,
  MapPin,
  ShoppingCart,
  Compass,
  Camera,
  UtensilsCrossed,
  BusFront,
  ChevronDown,
  Check,
  Pill,
  Shirt,
  Cookie,
  Gift,
  ShoppingBag,
  Footprints,
  Navigation2,
  Store,
  Building2,
  Beer,
  Search,
  Pencil,
  X,
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  Phone,
  Siren,
  ShieldAlert,
  FileText,
  Lock,
  LockOpen,
  Settings,
  RotateCcw,
  StickyNote,
  Eye,
  Plane,
  Plus,
  Trash2,
  AlertTriangle,
  LocateFixed,
} from "lucide-react";

/* ======================================================================
   持久化：useLocalStorage Hook（含安全降級）
   ----------------------------------------------------------------------
   - 能用 localStorage 就用（你下載到自己環境／部署後的正常情況）
   - 預覽沙盒 iframe 會擋 localStorage，此時自動 fallback 到記憶體，不報錯
   - 每次 setValue 都會 JSON.stringify 後寫回；初次載入優先讀 localStorage
   ====================================================================== */

const STORAGE_PREFIX = "jptour:"; // 所有鍵統一前綴，方便重置時一次清乾淨

// 偵測 localStorage 是否真的可用（沙盒環境會拋錯）
function storageAvailable() {
  try {
    const k = "__jptour_test__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

const HAS_LS = typeof window !== "undefined" && storageAvailable();

// 記憶體 fallback（預覽環境用），跟 localStorage 同介面
const memoryStore = {};

function readStored(key) {
  const fullKey = STORAGE_PREFIX + key;
  try {
    if (HAS_LS) {
      const raw = window.localStorage.getItem(fullKey);
      return raw == null ? undefined : JSON.parse(raw);
    }
    return fullKey in memoryStore ? JSON.parse(memoryStore[fullKey]) : undefined;
  } catch (e) {
    return undefined;
  }
}

function writeStored(key, value) {
  const fullKey = STORAGE_PREFIX + key;
  try {
    const raw = JSON.stringify(value);
    if (HAS_LS) window.localStorage.setItem(fullKey, raw);
    else memoryStore[fullKey] = raw;
  } catch (e) {
    /* 寫入失敗就靜默略過，不影響操作 */
  }
}

function clearAllStored() {
  try {
    if (HAS_LS) {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .forEach((k) => window.localStorage.removeItem(k));
    } else {
      Object.keys(memoryStore)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .forEach((k) => delete memoryStore[k]);
    }
  } catch (e) {
    /* ignore */
  }
}

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    const stored = readStored(key);
    return stored === undefined ? defaultValue : stored;
  });

  useEffect(() => {
    writeStored(key, value);
  }, [key, value]);

  return [value, setValue];
}

// 管理者密碼（純前端驗證，僅供本機開發／個人備課使用，非高安全機制）。
// 你可以直接改成自己的密碼；正式多人版本應改由後端驗證。
const ADMIN_PASSWORD = "00001010";

/* ======================================================================
   定位：Haversine 距離計算 + Geolocation Hook
   ----------------------------------------------------------------------
   - 不需要任何付費地圖 API，距離是用經緯度直接算出來的（球面距離公式）
   - 定位資料只留在瀏覽器記憶體做即時比對，不會寫入 localStorage、不會上傳到任何地方
   - 沙盒預覽環境通常會擋定位權限，此時會回報 status: 'error'，屬正常現象
   ====================================================================== */

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AUTO_MATCH_RADIUS_M = 400; // 距離景點多近才視為「你在這裡」，可依需求調整

function useGeolocation(enabled) {
  const [state, setState] = useState({ status: "idle", lat: null, lng: null, error: null });

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle", lat: null, lng: null, error: null });
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "unsupported", lat: null, lng: null, error: "此環境不支援定位功能" });
      return;
    }
    setState((s) => ({ ...s, status: "locating" }));
    let watchId;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setState({
            status: "ok",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            error: null,
          });
        },
        (err) => {
          setState({ status: "error", lat: null, lng: null, error: err.message || "無法取得定位" });
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 }
      );
    } catch (e) {
      setState({ status: "error", lat: null, lng: null, error: "定位權限被封鎖" });
    }
    return () => {
      if (watchId != null && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [enabled]);

  return state;
}

/* ======================================================================
   MOCK DATA — 之後可直接替換成自己的行程 / 購物清單 / 周邊資料
   ====================================================================== */

const TRIP_META = {
  tripName: "【時光小江戶】川越、晴空塔、橫濱纜車、小石川、江之島、吃螃蟹、溫泉6日",
  leaderName: "劉成芃",
  leaderPhoneTW: "0919-547-005",
  leaderPhoneJP: "070-3967-6100",
};

// 旅外國人緊急聯絡資訊 — 已於 2026/07 查證自駐日代表處官網（taiwanembassy.org / roc-taiwan.org）。
// 出發前仍建議自行覆核一次號碼是否異動。
const EMERGENCY_INFO = {
  offices: [
    {
      label: "台北駐日經濟文化代表處（東京｜多數行程轄區）",
      emergencyPhone: "03-3280-7917",
      emergencyMobile: "080-1009-7179",
      officePhone: "03-3280-7811",
      note: "夜間、假日緊急聯絡請撥手機或夜間警衛室專線",
    },
    {
      label: "台北駐橫濱分處（鎌倉／橫濱行程轄區）",
      emergencyPhone: "090-3211-7576",
      note: "行程行經鎌倉、橫濱時可就近聯繫",
    },
  ],
  globalHotline: {
    label: "外交部旅外國人急難救助全球免付費專線",
    dialFromJapan: "001-800-0885-0885",
    note: "找不到駐外館處時的備援管道，非急難事件請勿撥打",
  },
  police: "110",
  ambulanceFire: "119",
};

// 注意：gatherAt 使用真實日期時間 ISO 字串（含時區，例如 +08:00 為台灣時間、+09:00 為日本時間）。
// 每天的第一個「集合／出發」站若填了 gatherAt，該站的倒數計時就會自動抓正確剩餘時間。
// 其餘天數的景點時間目前是依你提供的行程重點推算的「合理估算時間」，正式時間表出來後直接改掉即可。
const DAYS = [
  {
    id: 1,
    dayLabel: "Day 1",
    dateLabel: "07/09（四）",
    cityLabel: "高雄 → 成田",
    weather: { condition: "partly", high: 31, low: 24, pop: 20 },
    hotel: { name: "成田MARROAD飯店", url: "https://www.marroad.jp/narita/" },
    stops: [
      {
        id: "d1s1",
        coords: { lat: 22.5771, lng: 120.35 },
        time: "10:55",
        name: "小港國際航廈 集合報到",
        nameJp: "高雄小港空港",
        status: "current",
        duration: "中華航空 團體櫃台",
        intro:
          "第一天的重點不是玩，是「別遲到」。團體報到、掛行李、證照查驗全部排隊做完通常要 1.5～2 小時，10:55 集合是為了讓大家從容通過安檢，不是遲到緩衝時間。行動電源、超過 100ml 的液體記得放託運，隨身背包先檢查一次。",
        photoSpots: [],
        mustBuy: [
          { name: "機場快速採購", note: "若提早到，出境後有短暫時間可逛免稅店，以不脫隊為原則" },
        ],
        gatherAt: "2026-07-09T10:55:00+08:00",
      },
      {
        id: "d1s2",
        time: "12:55",
        name: "CI126 飛往成田",
        nameJp: "成田国際空港ゆき",
        status: "upcoming",
        duration: "飛行時間約 4 小時 40 分（17:35 抵達）",
        intro:
          "中華航空直飛成田，全程約 4 小時 40 分。這段航程會跨過沖繩上空，天氣好時靠窗座位可以看到海面上的雲影變化。機上會供餐，特殊餐食需求應在出發前已跟旅行社確認過。",
        photoSpots: [],
        mustBuy: [],
        flight: { flightNo: "CI126", route: "高雄小港 ✈ 成田", gate: "" },
      },
      {
        id: "d1s3",
        coords: { lat: 35.772, lng: 140.3929 },
        time: "17:35",
        name: "抵達成田空港",
        nameJp: "成田国際空港",
        status: "upcoming",
        duration: "入境、提領行李約 60～90 分鐘",
        intro:
          "成田機場入境動線長，從下飛機到走出海關拿到行李，抓一個半小時是正常的。這是全團第一次通關，領隊會在前方帶隊不需要自己找路，但護照跟入境卡要先準備好夾在護照裡。",
        photoSpots: [],
        mustBuy: [
          { name: "上網 SIM 卡／WiFi 機", note: "入境大廳有電信櫃台，行前已預約取件會快很多" },
        ],
      },
      {
        id: "d1s4",
        coords: { lat: 35.778975, lng: 140.372772 },
        time: "19:00",
        name: "入住 成田MARROAD飯店",
        nameJp: "成田マロウドホテル",
        status: "upcoming",
        duration: "辦理入住",
        intro:
          "第一晚住機場周邊飯店是跨國團體行程的標準安排，主要是讓長途飛行後盡快休息，隔天一早才有體力往輕井澤方向移動。飯店鄰近機場，設施單純但乾淨好睡。",
        photoSpots: [],
        mustBuy: [],
      },
      {
        id: "d1s5",
        time: "20:00",
        name: "飯店周邊 自由活動",
        nameJp: "",
        status: "upcoming",
        duration: "自由活動",
        intro:
          "第一晚抵達較晚，飯店周邊多是機場旅館區，選擇不算多，超商跟簡易食堂是最保險的選項。建議早點休息，明天要開始真正的行程了。",
        photoSpots: [],
        mustBuy: [
          { name: "7-ELEVEN／LAWSON 便當", note: "機場周邊晚間餐飲選擇有限時的保底選項" },
        ],
      },
    ],
  },
  {
    id: 2,
    dayLabel: "Day 2",
    dateLabel: "07/10（五）",
    cityLabel: "川越 → 輕井澤",
    weather: { condition: "cloudy", high: 26, low: 18, pop: 40 },
    hotel: { name: "HOTEL GREEN PLAZA 輕井澤", url: "https://www.hgp.co.jp/karuizawa/" },
    stops: [
      {
        id: "d2s1",
        time: "08:00",
        name: "飯店出發",
        nameJp: "",
        status: "upcoming",
        duration: "車程約 1 小時",
        intro: "（時間為估算，正式行程表確認後請更新）今日往川越方向移動。",
        photoSpots: [],
        mustBuy: [],
      },
      {
        id: "d2s2",
        coords: { lat: 35.9251, lng: 139.4844 },
        time: "09:30",
        name: "川越 藏造老街",
        nameJp: "小江戸 川越",
        status: "upcoming",
        duration: "停留約 2 小時",
        intro:
          "被稱為「小江戶」，江戶時代倉庫式建築保存完整的商店街，是關東少見還能感受江戶氛圍的地方，時之鐘是地標建築。",
        photoSpots: ["時之鐘與周邊老街建築", "菓子屋橫丁小巷"],
        mustBuy: [{ name: "川越地瓜點心", note: "川越以地瓜聞名，各種地瓜甜點都值得一試" }],
      },
      {
        id: "d2s3",
        time: "12:00",
        name: "午餐",
        nameJp: "",
        status: "upcoming",
        duration: "約 60 分鐘",
        intro: "",
        photoSpots: [],
        mustBuy: [],
      },
      {
        id: "d2s4",
        coords: { lat: 36.3489, lng: 138.6169 },
        time: "16:00",
        name: "輕井澤 銀座通",
        nameJp: "軽井沢銀座通り",
        status: "upcoming",
        duration: "停留約 90 分鐘",
        intro:
          "輕井澤最熱鬧的老街，兩旁是果醬、麵包、木工藝品的店家，夏天是避暑勝地，氣氛悠閒。",
        photoSpots: ["銀座通街景", "舊輕井澤郵局周邊"],
        mustBuy: [{ name: "沢屋果醬", note: "輕井澤在地品牌，多種口味可試吃" }],
      },
      {
        id: "d2s5",
        coords: { lat: 36.3497, lng: 138.6172 },
        time: "17:30",
        name: "聖保羅天主教堂",
        nameJp: "軽井沢聖パウロカトリック教会",
        status: "upcoming",
        duration: "停留約 30 分鐘",
        intro: "三角形木造尖頂教堂，是輕井澤的代表建築之一，很多日劇取景過。",
        photoSpots: ["教堂正面尖頂構圖"],
        mustBuy: [],
      },
      {
        id: "d2s6",
        coords: { lat: 36.475371, lng: 138.539418 },
        time: "18:30",
        name: "入住 HOTEL GREEN PLAZA 輕井澤",
        nameJp: "",
        status: "upcoming",
        duration: "辦理入住",
        intro: "",
        photoSpots: [],
        mustBuy: [],
      },
    ],
  },
  {
    id: 3,
    dayLabel: "Day 3",
    dateLabel: "07/11（六）",
    cityLabel: "山中湖",
    weather: { condition: "rain", high: 25, low: 17, pop: 60 },
    hotel: { name: "山中湖溫泉 富士松園", url: "http://www.fujimatsuzono.co.jp/" },
    stops: [
      {
        id: "d3s1",
        time: "08:30",
        name: "飯店出發",
        nameJp: "",
        status: "upcoming",
        duration: "",
        intro: "（時間為估算）今天降雨機率較高，建議隨身攜帶雨具。",
        photoSpots: [],
        mustBuy: [],
      },
      {
        id: "d3s2",
        coords: { lat: 35.9147, lng: 138.4409 },
        time: "09:30",
        name: "萌木之村",
        nameJp: "萌木の村",
        status: "upcoming",
        duration: "停留約 90 分鐘",
        intro: "清里高原上的童話風商店村落，森林小屋造型的餐廳與雜貨舖聚集，適合悠閒散步。",
        photoSpots: ["童話木屋建築群"],
        mustBuy: [{ name: "清里牛奶點心", note: "當地牧場直送乳製品製作的甜點" }],
      },
      {
        id: "d3s3",
        coords: { lat: 35.5087, lng: 138.6398 },
        time: "11:30",
        name: "西湖根場合掌村",
        nameJp: "西湖いやしの里根場",
        status: "upcoming",
        duration: "停留約 60 分鐘",
        intro: "重建的合掌造聚落，背景是富士山（天氣允許時），保留了山梨縣傳統茅草屋風貌。",
        photoSpots: ["合掌屋群與富士山同框（需視天氣）"],
        mustBuy: [],
      },
      {
        id: "d3s4",
        coords: { lat: 35.4197, lng: 138.8654 },
        time: "14:30",
        name: "山中湖遊船",
        nameJp: "山中湖 遊覧船",
        status: "upcoming",
        duration: "船程約 30 分鐘",
        intro: "富士五湖之一，晴天時可以看到富士山倒映在湖面上，天候不佳時仍可搭船欣賞湖景。",
        photoSpots: ["甲板上遠眺富士山方向"],
        mustBuy: [],
      },
      {
        id: "d3s5",
        coords: { lat: 35.41932, lng: 138.85379 },
        time: "17:00",
        name: "入住 山中湖溫泉 富士松園",
        nameJp: "",
        status: "upcoming",
        duration: "辦理入住、溫泉之夜",
        intro: "今晚是全程唯一的溫泉飯店，建議晚餐後留時間泡湯放鬆。",
        photoSpots: [],
        mustBuy: [],
      },
    ],
  },
  {
    id: 4,
    dayLabel: "Day 4",
    dateLabel: "07/12（日）",
    cityLabel: "箱根 → 鎌倉 → 橫濱",
    weather: { condition: "sunny", high: 29, low: 22, pop: 10 },
    hotel: { name: "橫濱玫瑰飯店", url: "https://www.rosehotelyokohama.com/" },
    stops: [
      {
        id: "d4s1",
        time: "08:00",
        name: "飯店出發",
        nameJp: "",
        status: "upcoming",
        duration: "",
        intro: "（時間為估算）今日行程較滿，建議提前梳洗完畢。",
        photoSpots: [],
        mustBuy: [],
      },
      {
        id: "d4s2",
        coords: { lat: 35.2401, lng: 139.0161 },
        time: "09:30",
        name: "大涌谷",
        nameJp: "大涌谷",
        status: "upcoming",
        duration: "停留約 60 分鐘",
        intro:
          "箱根火山地形形成的硫磺谷地，空氣中飄著硫磺味，天氣晴朗時可遠眺富士山，是箱根地熱活動最直接的觀察點。",
        photoSpots: ["谷地蒸氣與遠方富士山"],
        mustBuy: [{ name: "黑玉子（黑蛋）", note: "用溫泉蒸煮至蛋殼變黑，傳說吃一顆延壽七年" }],
      },
      {
        id: "d4s3",
        coords: { lat: 35.3057, lng: 139.5008 },
        time: "13:30",
        name: "江之島電鐵沿線",
        nameJp: "江ノ島電鉄（江ノ電）",
        status: "upcoming",
        duration: "沿線體驗約 40 分鐘",
        intro: "行駛在民宅與海岸線之間的懷舊小電車，是許多動漫、日劇取景的經典畫面。",
        photoSpots: ["電車行經鎌倉高校前站的海景平交道"],
        mustBuy: [],
      },
      {
        id: "d4s4",
        coords: { lat: 35.326, lng: 139.556 },
        time: "15:00",
        name: "鎌倉（鶴岡八幡宮／小町通）",
        nameJp: "鎌倉",
        status: "upcoming",
        duration: "停留約 90 分鐘",
        intro:
          "鎌倉幕府的古都，鶴岡八幡宮是當地信仰中心，小町通則是熱鬧的參道商店街，小吃與伴手禮選擇多。",
        photoSpots: ["鶴岡八幡宮參道大鳥居", "小町通街景"],
        mustBuy: [{ name: "鎌倉鴿子餅乾（鳩サブレー）", note: "鎌倉百年老店豐島屋的招牌奶油餅乾" }],
      },
      {
        id: "d4s5",
        coords: { lat: 35.4527, lng: 139.6425 },
        time: "17:30",
        name: "橫濱紅磚倉庫",
        nameJp: "横浜赤レンガ倉庫",
        status: "upcoming",
        duration: "停留約 60 分鐘",
        intro: "明治時期的紅磚保稅倉庫改建成的商場，傍晚華燈初上時很適合拍港灣夜景。",
        photoSpots: ["紅磚建築與港灣夕陽"],
        mustBuy: [],
      },
      {
        id: "d4s6",
        coords: { lat: 35.4437, lng: 139.6503 },
        time: "19:00",
        name: "入住 橫濱玫瑰飯店",
        nameJp: "",
        status: "upcoming",
        duration: "辦理入住",
        intro: "",
        photoSpots: [],
        mustBuy: [],
      },
    ],
  },
  {
    id: 5,
    dayLabel: "Day 5",
    dateLabel: "07/13（一）",
    cityLabel: "橫濱 → 東京",
    weather: { condition: "partly", high: 30, low: 23, pop: 20 },
    hotel: { name: "東京大森緹馬克城市飯店", url: "https://tmarkcity.com/tokyoomori/" },
    stops: [
      {
        id: "d5s1",
        coords: { lat: 35.4444, lng: 139.6497 },
        time: "08:30",
        name: "山下公園",
        nameJp: "山下公園",
        status: "upcoming",
        duration: "停留約 40 分鐘",
        intro: "面向橫濱港的濱海公園，可以看到停泊的冰川丸號郵輪，是橫濱最經典的散步路線之一。",
        photoSpots: ["公園步道與港灣船隻"],
        mustBuy: [],
      },
      {
        id: "d5s2",
        coords: { lat: 35.453, lng: 139.6329 },
        time: "10:00",
        name: "橫濱空中纜車",
        nameJp: "YOKOHAMA AIR CABIN",
        status: "upcoming",
        duration: "約 30 分鐘",
        intro: "連接櫻木町與港未來的空中纜車，可以居高俯瞰整個港未來 21 區與摩天輪。",
        photoSpots: ["纜車車廂內俯瞰港未來夜景（傍晚班次更佳）"],
        mustBuy: [],
      },
      {
        id: "d5s3",
        time: "13:30",
        name: "免稅店購物",
        nameJp: "",
        status: "upcoming",
        duration: "約 90 分鐘",
        intro: "",
        photoSpots: [],
        mustBuy: [],
      },
      {
        id: "d5s4",
        coords: { lat: 35.7101, lng: 139.8107 },
        time: "16:00",
        name: "東京晴空塔",
        nameJp: "東京スカイツリー",
        status: "upcoming",
        duration: "停留約 90 分鐘",
        intro:
          "全高 634 公尺，是東京地標之一，晴天時展望台可遠眺富士山，塔下的 SOLAMACHI 商場也適合逛街。",
        photoSpots: ["塔身仰角構圖", "展望台俯瞰東京市區"],
        mustBuy: [{ name: "晴空塔限定周邊", note: "SOLAMACHI 商場內有多間官方紀念品店" }],
      },
      {
        id: "d5s5",
        coords: { lat: 35.5878, lng: 139.7381 },
        time: "19:00",
        name: "入住 東京大森緹馬克城市飯店",
        nameJp: "",
        status: "upcoming",
        duration: "辦理入住",
        intro: "",
        photoSpots: [],
        mustBuy: [],
      },
    ],
  },
  {
    id: 6,
    dayLabel: "Day 6",
    dateLabel: "07/14（二）",
    cityLabel: "東京 → 高雄",
    weather: { condition: "sunny", high: 31, low: 24, pop: 10 },
    hotel: null,
    stops: [
      {
        id: "d6s1",
        coords: { lat: 35.7075, lng: 139.7492 },
        time: "09:00",
        name: "小石川後樂園",
        nameJp: "小石川後楽園",
        status: "upcoming",
        duration: "停留約 60 分鐘",
        intro: "東京都內歷史最悠久的大名庭園之一，融合中式意象的迴遊式庭園，鬧中取靜。",
        photoSpots: ["圓月橋倒影"],
        mustBuy: [],
      },
      {
        id: "d6s2",
        coords: { lat: 35.7148, lng: 139.7967 },
        time: "11:00",
        name: "淺草觀音寺",
        nameJp: "浅草寺",
        status: "upcoming",
        duration: "停留約 90 分鐘",
        intro:
          "東京都內歷史最悠久的寺廟，雷門大燈籠是必拍地標，仲見世通參道兩旁滿滿老店與伴手禮鋪。",
        photoSpots: ["雷門大燈籠", "仲見世通參道街景", "五重塔與晴空塔同框"],
        mustBuy: [
          { name: "人形燒", note: "仲見世通經典現烤點心" },
          { name: "雷おこし", note: "淺草代表性米菓伴手禮" },
        ],
      },
      {
        id: "d6s3",
        time: "13:30",
        name: "前往成田機場",
        nameJp: "",
        status: "upcoming",
        duration: "車程約 90 分鐘",
        intro: "",
        photoSpots: [],
        mustBuy: [],
      },
      {
        id: "d6s4",
        coords: { lat: 35.772, lng: 140.3929 },
        time: "18:35",
        name: "CI127 起飛返台",
        nameJp: "",
        status: "upcoming",
        duration: "飛行時間約 3 小時 5 分（21:40 抵達高雄）",
        intro: "六天的行程在此告一段落，登機前記得確認免稅品是否都已收妥在隨身行李中限額內。",
        photoSpots: [],
        mustBuy: [],
        flight: { flightNo: "CI127", route: "成田 ✈ 高雄小港", gate: "" },
      },
    ],
  },
];

const SHOPPING_CATEGORIES = ["全部", "藥妝", "服飾", "零食", "伴手禮"];

const SHOPPING_ITEMS = [
  {
    id: "p1",
    name: "SHISEIDO 藥用美白化妝水",
    category: "藥妝",
    price: "¥2,480",
    qty: 1,
    checked: false,
    foundAt: ["松本清", "大國藥妝"],
  },
  {
    id: "p2",
    name: "興和 EVE 止痛藥",
    category: "藥妝",
    price: "¥780",
    qty: 2,
    checked: false,
    foundAt: ["松本清", "SUNDRUG"],
  },
  {
    id: "p3",
    name: "小林製藥 眼藥水（金）",
    category: "藥妝",
    price: "¥1,200",
    qty: 3,
    checked: true,
    foundAt: ["唐吉訶德"],
  },
  {
    id: "p4",
    name: "UNIQLO 極輕羽絨外套",
    category: "服飾",
    price: "¥5,990",
    qty: 1,
    checked: false,
    foundAt: ["UNIQLO 京都四条店"],
  },
  {
    id: "p5",
    name: "無印良品 舒眠頸枕",
    category: "服飾",
    price: "¥1,990",
    qty: 1,
    checked: false,
    foundAt: ["無印良品"],
  },
  {
    id: "p6",
    name: "白色戀人 12 入",
    category: "零食",
    price: "¥1,080",
    qty: 2,
    checked: false,
    foundAt: ["唐吉訶德", "機場免稅店"],
  },
  {
    id: "p7",
    name: "Royce 生巧克力",
    category: "零食",
    price: "¥900",
    qty: 1,
    checked: true,
    foundAt: ["百貨地下街"],
  },
  {
    id: "p8",
    name: "KitKat 抹茶 / 酒粕限定款",
    category: "零食",
    price: "¥650",
    qty: 4,
    checked: false,
    foundAt: ["唐吉訶德", "松本清"],
  },
  {
    id: "p9",
    name: "京都限定 御守（學業）",
    category: "伴手禮",
    price: "¥800",
    qty: 2,
    checked: false,
    foundAt: ["北野天滿宮"],
  },
  {
    id: "p10",
    name: "清水燒 小茶杯組",
    category: "伴手禮",
    price: "¥3,300",
    qty: 1,
    checked: false,
    foundAt: ["清水坂店家"],
  },
];

const NEARBY_FILTERS = [
  { key: "convenience", label: "🏪 便利商店" },
  { key: "mall", label: "🛍️ 商場／街區" },
  { key: "izakaya", label: "🍜 宵夜/居酒屋" },
  { key: "drugstore", label: "💊 藥妝店" },
];

// 以下資料已於 2026/07 逐一查證各飯店周邊的真實店家（來源：飯店官網、訂房網站住客評論、地圖服務）。
// distanceMin 標示「約」是因為沒有 Google Maps 距離矩陣 API 可用，是依查到的車站/飯店步行時間資訊換算的估計值，
// 正式使用前建議直接用 Google Maps 走一次路線確認。mapsQuery 皆為可在 Google 地圖中搜尋到的真實店名。
const NEARBY_BY_DAY = {
  1: {
    remoteNotice:
      "成田MARROAD飯店位在成田機場周邊，僅提供機場↔飯店免費接駁車，步行範圍內幾乎沒有對外店家。官方資訊顯示館內設有便利商店，訂房網站也有「步行5分鐘內有超商」的說法但未指名店家，建議入住後直接請櫃檯指引最近的選擇。",
    places: [
      {
        id: "n1-1",
        name: "飯店館內 コンビニ",
        category: "convenience",
        distanceMin: 0,
        distanceLabel: "館內（免出飯店）",
        hoursLabel: "營業時間依館方公告",
        hoursType: "normal",
        mapsQuery: "マロウドインターナショナルホテル成田",
      },
    ],
  },
  2: {
    remoteNotice:
      "查證後發現行程表上的「HOTEL GREEN PLAZA 輕井澤」實際地址在群馬縣嬬恋村北輕井澤山區（鄰近輕井澤玩具王國），並不在輕井澤車站或銀座通周邊。住客評論提到最近的便利商店開車約5分鐘，步行範圍內沒有可靠資訊，建議晚上以飯店內的溫泉、賣店、餐廳為主，或請櫃檯協助叫車外出。",
    places: [],
  },
  3: {
    remoteNotice: null,
    places: [
      {
        id: "n3-1",
        name: "7-ELEVEN（山中湖エリア）",
        category: "convenience",
        distanceMin: 10,
        distanceLabel: "約 10 分鐘（住客評論實測步行時間）",
        hoursLabel: "24 小時營業",
        hoursType: "24h",
        mapsQuery: "セブンイレブン 山中湖",
      },
    ],
  },
  4: {
    remoteNotice: null,
    places: [
      {
        id: "n4-1",
        name: "7-ELEVEN 橫濱中華街東門店",
        category: "convenience",
        distanceMin: 5,
        distanceLabel: "約 5 分鐘（含飯店到車站的路程估算）",
        hoursLabel: "24 小時營業",
        hoursType: "24h",
        mapsQuery: "セブンイレブン 横浜中華街東門店",
      },
      {
        id: "n4-2",
        name: "全家便利商店 山下町店",
        category: "convenience",
        distanceMin: 5,
        distanceLabel: "約 5 分鐘（含飯店到車站的路程估算）",
        hoursLabel: "06:00-24:00",
        hoursType: "normal",
        mapsQuery: "ファミリーマート 山下町店 横浜",
      },
      {
        id: "n4-3",
        name: "Natural LAWSON 橫濱元町店",
        category: "convenience",
        distanceMin: 6,
        distanceLabel: "約 6 分鐘（近山下公園）",
        hoursLabel: "24 小時營業",
        hoursType: "24h",
        mapsQuery: "ナチュラルローソン 横浜元町店",
      },
      {
        id: "n4-4",
        name: "橫濱中華街",
        category: "mall",
        distanceMin: 2,
        distanceLabel: "約 2 分鐘（飯店就在中華街朝陽門旁）",
        hoursLabel: "多數店家營業至 21:00～22:00",
        hoursType: "normal",
        mapsQuery: "横浜中華街",
      },
    ],
  },
  5: {
    remoteNotice: null,
    places: [
      {
        id: "n5-1",
        name: "全家便利商店（飯店隔壁）",
        category: "convenience",
        distanceMin: 1,
        distanceLabel: "約 1 分鐘（緊鄰飯店，多筆住客評論提及）",
        hoursLabel: "多數市區店鋪為 24 小時，實際請以店家公告為準",
        hoursType: "24h",
        mapsQuery: "ファミリーマート 大森本町 東京",
      },
      {
        id: "n5-2",
        name: "JR大森駅前商店街",
        category: "mall",
        distanceMin: 10,
        distanceLabel: "約 10 分鐘（飯店官網標示的步行時間）",
        hoursLabel: "各店營業時間不一",
        hoursType: "normal",
        mapsQuery: "大森駅前 商店街",
      },
    ],
  },
  6: {
    remoteNotice:
      "今天上午退房地點與 Day5 相同（東京大森緹馬克城市飯店），下方沿用同一批已查證地點，下午會前往成田機場。",
    places: [
      {
        id: "n6-1",
        name: "全家便利商店（飯店隔壁）",
        category: "convenience",
        distanceMin: 1,
        distanceLabel: "約 1 分鐘（緊鄰飯店，多筆住客評論提及）",
        hoursLabel: "多數市區店鋪為 24 小時，實際請以店家公告為準",
        hoursType: "24h",
        mapsQuery: "ファミリーマート 大森本町 東京",
      },
    ],
  },
};

/* ======================================================================
   THEME TOKENS（不使用 Tailwind 任意值，顏色一律透過 inline style 套用）
   ====================================================================== */

const LIGHT = {
  bgPage: "#EEF0F4",
  bgCard: "#FFFFFF",
  bgCardHighlight: "#F4F1FB",
  bgSunken: "#E4E7EF",
  textPrimary: "#1B2130",
  textSecondary: "#636B7A",
  textFaint: "#9AA1AE",
  border: "#DDE1E8",
  indigo: "#2F3E6B",
  indigoSoft: "#5470A6",
  accentRed: "#C13B3B",
  accentRedSoft: "#F1DADA",
  green: "#3E8E5C",
  greenSoft: "#DEF0E4",
  orange: "#C97418",
  orangeSoft: "#F7E7D2",
  navBg: "#FFFFFF",
};

const DARK = {
  bgPage: "#12141C",
  bgCard: "#1C202B",
  bgCardHighlight: "#232A44",
  bgSunken: "#262C3A",
  textPrimary: "#EEF0F5",
  textSecondary: "#9CA3B4",
  textFaint: "#6B7180",
  border: "#454E68",
  indigo: "#7C93C9",
  indigoSoft: "#9AAEDA",
  accentRed: "#E36565",
  accentRedSoft: "#3A2229",
  green: "#5FBE85",
  greenSoft: "#1E3126",
  orange: "#E5A356",
  orangeSoft: "#3A2C18",
  navBg: "#181B24",
};

const CATEGORY_ICON = {
  藥妝: Pill,
  服飾: Shirt,
  零食: Cookie,
  伴手禮: Gift,
  全部: ShoppingBag,
};

const NEARBY_ICON = {
  convenience: Store,
  mall: Building2,
  izakaya: Beer,
  drugstore: Pill,
};

/* ======================================================================
   小元件
   ====================================================================== */

function useFonts() {
  useEffect(() => {
    if (document.getElementById("jp-tour-fonts")) return;
    const link = document.createElement("link");
    link.id = "jp-tour-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;700&family=Noto+Sans+TC:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

function CountdownTicket({ theme, targetTime }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const diffMs = targetTime.getTime() - now.getTime();
  const isPast = diffMs <= 0;
  const abs = Math.max(diffMs, 0);
  const hh = Math.floor(abs / 3600000);
  const mm = Math.floor((abs % 3600000) / 60000);
  const ss = Math.floor((abs % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div
      className="relative flex items-stretch rounded-2xl overflow-hidden mt-4"
      style={{
        border: `1px solid ${theme.border}`,
        backgroundColor: isPast ? theme.accentRedSoft : theme.bgSunken,
      }}
    >
      <div className="flex flex-col items-center justify-center gap-1 px-4 py-3">
        <BusFront size={20} color={isPast ? theme.accentRed : theme.indigo} />
        <span
          className="text-xs font-medium text-center leading-tight"
          style={{ color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}
        >
          遊覽車
          <br />
          集合倒數
        </span>
      </div>

      {/* 撕票孔洞效果 */}
      <div className="relative" style={{ width: 0, borderLeft: `2px dashed ${theme.border}` }}>
        <span
          className="absolute rounded-full"
          style={{
            width: 16,
            height: 16,
            backgroundColor: theme.bgCardHighlight,
            top: -8,
            left: -8,
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            width: 16,
            height: 16,
            backgroundColor: theme.bgCardHighlight,
            bottom: -8,
            left: -8,
          }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-3">
        {isPast ? (
          <span
            className="text-base font-bold"
            style={{ color: theme.accentRed, fontFamily: "'Noto Sans TC', sans-serif" }}
          >
            請立即前往集合點
          </span>
        ) : (
          <>
            <span
              className="text-2xl tracking-widest"
              style={{
                color: theme.textPrimary,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
              }}
            >
              {pad(hh)}:{pad(mm)}:{pad(ss)}
            </span>
            <span
              className="text-xs mt-0.5"
              style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}
            >
              時 : 分 : 秒
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function FlightInfoCard({ theme, flight, isAdmin, onSaveGate }) {
  const [gateDraft, setGateDraft] = useState(flight.gate || "");

  useEffect(() => {
    setGateDraft(flight.gate || "");
  }, [flight.gate]);

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3 mt-4"
      style={{ backgroundColor: theme.bgSunken, border: `1px solid ${theme.border}` }}
    >
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 36, height: 36, backgroundColor: theme.indigo }}
      >
        <Plane size={16} color="#fff" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}>
          {flight.flightNo} ・ {flight.route}
        </p>
        {isAdmin ? (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
              登機門
            </span>
            <input
              value={gateDraft}
              onChange={(e) => setGateDraft(e.target.value)}
              onBlur={() => onSaveGate(gateDraft)}
              placeholder="例如 A5（登機當天才會公布）"
              className="text-xs rounded-md px-2 py-1 outline-none flex-1"
              style={{
                backgroundColor: theme.bgCard,
                color: theme.textPrimary,
                border: `1px solid ${theme.indigoSoft}`,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>
        ) : (
          <p className="text-xs mt-0.5" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            登機門：{flight.gate ? flight.gate : "尚待航空公司公布，請以機場螢幕為準"}
          </p>
        )}
      </div>
    </div>
  );
}

function isoToDatetimeLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatHM(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function TimelineStop({
  stop,
  isExpanded,
  onToggle,
  theme,
  isLast,
  isAdmin,
  isNearby,
  isEditing,
  editValue,
  onStartEdit,
  onChangeEditValue,
  onSaveEdit,
  onCancelEdit,
  note,
  onChangeNote,
  onSaveGate,
}) {
  const isCurrent = stop.status === "current" || isNearby;
  const isDone = stop.status === "done";

  const dot = isCurrent ? (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: 26,
        height: 26,
        backgroundColor: theme.bgCard,
        border: `2px solid ${theme.accentRed}`,
        boxShadow: `0 0 0 3px ${theme.accentRedSoft}`,
      }}
    >
      <div className="rounded-full" style={{ width: 9, height: 9, backgroundColor: theme.accentRed }} />
    </div>
  ) : isDone ? (
    <div
      className="flex items-center justify-center rounded-full"
      style={{ width: 22, height: 22, backgroundColor: theme.green }}
    >
      <Check size={13} color="#fff" strokeWidth={3} />
    </div>
  ) : (
    <div
      className="rounded-full"
      style={{
        width: 22,
        height: 22,
        backgroundColor: theme.bgCard,
        border: `2px solid ${theme.border}`,
      }}
    />
  );

  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center" style={{ width: 26 }}>
        {dot}
        {!isLast && (
          <div
            className="flex-1"
            style={{ width: 2, backgroundColor: theme.border, marginTop: 2, minHeight: 20 }}
          />
        )}
      </div>

      <div className="flex-1 pb-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onToggle(stop.id)}
          onKeyDown={(e) => (e.key === "Enter" ? onToggle(stop.id) : null)}
          className="w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer"
          style={{
            backgroundColor: isCurrent ? theme.bgCardHighlight : theme.bgCard,
            border: `1px solid ${isCurrent ? theme.indigoSoft : theme.border}`,
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type={stop.gatherAt ? "datetime-local" : "time"}
                    value={editValue}
                    onChange={(e) => onChangeEditValue(e.target.value)}
                    autoFocus
                    className="text-xs rounded-lg px-2 py-1 outline-none"
                    style={{
                      backgroundColor: theme.bgSunken,
                      color: theme.textPrimary,
                      border: `1px solid ${theme.indigoSoft}`,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                  <button
                    onClick={() => onSaveEdit(stop.id)}
                    className="flex items-center justify-center rounded-md flex-shrink-0"
                    style={{ width: 22, height: 22, backgroundColor: theme.green }}
                    aria-label="儲存時間"
                  >
                    <Check size={13} color="#fff" strokeWidth={3} />
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="flex items-center justify-center rounded-md flex-shrink-0"
                    style={{ width: 22, height: 22, backgroundColor: theme.bgSunken, border: `1px solid ${theme.border}` }}
                    aria-label="取消編輯"
                  >
                    <X size={13} color={theme.textSecondary} strokeWidth={3} />
                  </button>
                </div>
              ) : isAdmin ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit(stop.id);
                  }}
                  className="flex items-center gap-1 rounded-md px-1 -ml-1"
                  style={{ backgroundColor: "transparent" }}
                >
                  <span
                    className="text-xs font-semibold tracking-wide"
                    style={{
                      color: isDone ? theme.textFaint : theme.indigo,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {stop.time}
                  </span>
                  <Pencil size={11} color={theme.textFaint} />
                </button>
              ) : (
                <span
                  className="text-xs font-semibold tracking-wide px-1 -ml-1"
                  style={{
                    color: isDone ? theme.textFaint : theme.indigo,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {stop.time}
                </span>
              )}
              {isCurrent && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                  style={{ backgroundColor: theme.accentRed, color: "#fff", fontFamily: "'Noto Sans TC', sans-serif" }}
                >
                  {isNearby && <LocateFixed size={10} />}
                  {isNearby ? "你在這附近" : "現在"}
                </span>
              )}
            </div>
            <h3
              className="mt-1 truncate"
              style={{
                color: isDone ? theme.textFaint : theme.textPrimary,
                fontFamily: "'Noto Serif TC', serif",
                fontWeight: 700,
                fontSize: 16,
                textDecoration: isDone ? "line-through" : "none",
              }}
            >
              {stop.name}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
              {stop.nameJp} ・ {stop.duration}
            </p>
          </div>
          <ChevronDown
            size={18}
            color={theme.textSecondary}
            style={{
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              flexShrink: 0,
            }}
          />
        </div>

        {isExpanded && (
          <div
            className="mt-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
          >
            {stop.intro && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}
              >
                {stop.intro}
              </p>
            )}

            {stop.photoSpots.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Camera size={15} color={theme.indigo} />
                  <span
                    className="text-sm font-bold"
                    style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}
                  >
                    特色拍照地
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {stop.photoSpots.map((spot, i) => (
                    <li
                      key={i}
                      className="text-sm pl-3 relative"
                      style={{ color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}
                    >
                      <span
                        className="absolute rounded-full"
                        style={{ width: 4, height: 4, backgroundColor: theme.indigoSoft, left: 0, top: 8 }}
                      />
                      {spot}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stop.mustBuy.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <UtensilsCrossed size={15} color={theme.accentRed} />
                  <span
                    className="text-sm font-bold"
                    style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}
                  >
                    必買 / 必吃
                  </span>
                </div>
                <div className="space-y-2">
                  {stop.mustBuy.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl px-3 py-2"
                      style={{ backgroundColor: theme.bgSunken }}
                    >
                      <p
                        className="text-sm font-semibold"
                        style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}
                      >
                        {item.name}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}
                      >
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isCurrent && stop.gatherAt && (
              <CountdownTicket theme={theme} targetTime={new Date(stop.gatherAt)} />
            )}

            {stop.flight && (
              <FlightInfoCard
                theme={theme}
                flight={stop.flight}
                isAdmin={isAdmin}
                onSaveGate={(gate) => onSaveGate(stop.id, gate)}
              />
            )}

            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <StickyNote size={15} color={theme.orange} />
                <span
                  className="text-sm font-bold"
                  style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}
                >
                  我的筆記
                </span>
              </div>
              <textarea
                value={note}
                onChange={(e) => onChangeNote(e.target.value)}
                placeholder="寫下想買的東西、集合位置、同行提醒…（自動儲存）"
                rows={2}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                style={{
                  backgroundColor: theme.bgSunken,
                  color: theme.textPrimary,
                  border: `1px solid ${theme.border}`,
                  fontFamily: "'Noto Sans TC', sans-serif",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const WEATHER_ICON = {
  sunny: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
};

function WeatherCard({ theme, weather }) {
  const Icon = WEATHER_ICON[weather.condition] || CloudSun;
  const isRainy = weather.condition === "rain";
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4"
      style={{
        backgroundColor: isRainy ? theme.orangeSoft : theme.bgSunken,
        border: `1px solid ${theme.border}`,
      }}
    >
      <Icon size={28} color={isRainy ? theme.orange : theme.indigo} />
      <div className="flex-1">
        <p
          className="text-sm font-bold"
          style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}
        >
          {weather.high}° / {weather.low}°C
        </p>
        <p className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}>
          今日行程天氣參考（預估）
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Droplets size={14} color={theme.textFaint} />
        <span className="text-xs" style={{ color: theme.textFaint, fontFamily: "'JetBrains Mono', monospace" }}>
          {weather.pop}%
        </span>
      </div>
    </div>
  );
}

function DaySwitcher({ theme, days, dayIndex, setDayIndex }) {
  return (
    <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {days.map((d, i) => {
        const active = i === dayIndex;
        return (
          <button
            key={d.id}
            onClick={() => setDayIndex(i)}
            className="flex flex-col items-center rounded-xl px-3 py-1.5 flex-shrink-0"
            style={{
              backgroundColor: active ? theme.indigo : theme.bgCard,
              border: `1px solid ${active ? theme.indigo : theme.border}`,
            }}
          >
            <span
              className="text-xs font-bold"
              style={{ color: active ? "#fff" : theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}
            >
              {d.dayLabel}
            </span>
            <span
              className="text-xs"
              style={{
                color: active ? "rgba(255,255,255,0.8)" : theme.textFaint,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {d.dateLabel.split("（")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LocationTracker({ theme, enabled, onToggle, geo, matchedStopName }) {
  const statusText = () => {
    if (!enabled) return "點擊開啟，靠近哪個景點就自動標示為目前行程";
    if (geo.status === "locating") return "定位中…";
    if (geo.status === "unsupported") return "此環境不支援定位（例如預覽視窗），請在手機瀏覽器開啟";
    if (geo.status === "error") return `定位失敗：${geo.error || "請確認已允許定位權限"}`;
    if (geo.status === "ok" && matchedStopName) return `📍 偵測到你在「${matchedStopName}」附近`;
    if (geo.status === "ok") return "已定位，但目前不在任何景點 400 公尺內";
    return "";
  };

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-3"
      style={{ backgroundColor: theme.bgSunken, border: `1px solid ${theme.border}` }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 36, height: 36, backgroundColor: enabled ? theme.indigo : theme.bgCard, border: `1px solid ${enabled ? theme.indigo : theme.border}` }}
        aria-label="切換定位偵測"
      >
        <LocateFixed size={17} color={enabled ? "#fff" : theme.textSecondary} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}>
          依目前位置自動偵測行程
        </p>
        <p className="text-xs mt-0.5" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
          {statusText()}
        </p>
      </div>
    </div>
  );
}

function ItineraryTab({
  theme,
  day,
  days,
  dayIndex,
  setDayIndex,
  isAdmin,
  updateDayStops,
  notes,
  setNotes,
}) {
  const stops = day.stops;
  const [expandedId, setExpandedId] = useState(
    (stops.find((s) => s.status === "current") || stops[0]).id
  );
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [locationEnabled, setLocationEnabled] = useLocalStorage("locationEnabled", false);
  const geo = useGeolocation(locationEnabled);

  // 依目前位置比對這一天所有有座標的站點，找出最近且在範圍內的一個
  const autoCurrentId = useMemo(() => {
    if (geo.status !== "ok") return null;
    let bestId = null;
    let bestDist = Infinity;
    stops.forEach((s) => {
      if (!s.coords) return;
      const d = distanceMeters(geo.lat, geo.lng, s.coords.lat, s.coords.lng);
      if (d < bestDist) {
        bestDist = d;
        bestId = s.id;
      }
    });
    return bestDist <= AUTO_MATCH_RADIUS_M ? bestId : null;
  }, [geo.status, geo.lat, geo.lng, stops]);

  // 偵測到附近景點時，自動展開該站
  useEffect(() => {
    if (autoCurrentId) setExpandedId(autoCurrentId);
  }, [autoCurrentId]);

  // 切換天數時，重設展開項與編輯狀態
  useEffect(() => {
    setExpandedId((day.stops.find((s) => s.status === "current") || day.stops[0]).id);
    setEditingId(null);
  }, [dayIndex]);

  const startEdit = (stopId) => {
    const target = stops.find((s) => s.id === stopId);
    setEditValue(target.gatherAt ? isoToDatetimeLocal(target.gatherAt) : target.time);
    setEditingId(stopId);
  };

  const saveEdit = (stopId) => {
    const newStops = stops.map((s) => {
      if (s.id !== stopId) return s;
      if (s.gatherAt) {
        const newDate = new Date(editValue);
        if (isNaN(newDate.getTime())) return s;
        return { ...s, gatherAt: newDate.toISOString(), time: formatHM(newDate) };
      }
      return { ...s, time: editValue };
    });
    updateDayStops(dayIndex, newStops);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const setNoteFor = (stopId, text) => {
    setNotes((prev) => ({ ...prev, [stopId]: text }));
  };

  const saveGate = (stopId, gate) => {
    const newStops = stops.map((s) => (s.id === stopId ? { ...s, flight: { ...s.flight, gate } } : s));
    updateDayStops(dayIndex, newStops);
  };

  const matchedStop = stops.find((s) => s.id === autoCurrentId);

  return (
    <div className="pt-4 pb-6">
      <div className="px-4">
        <h2
          className="text-lg mb-3 flex items-center gap-2"
          style={{ color: theme.textPrimary, fontFamily: "'Noto Serif TC', serif", fontWeight: 700 }}
        >
          行程時間軸
        </h2>
      </div>

      <DaySwitcher theme={theme} days={days} dayIndex={dayIndex} setDayIndex={setDayIndex} />

      <div className="px-4">
        <WeatherCard theme={theme} weather={day.weather} />

        <LocationTracker
          theme={theme}
          enabled={locationEnabled}
          onToggle={() => setLocationEnabled((v) => !v)}
          geo={geo}
          matchedStopName={matchedStop ? matchedStop.name : null}
        />

        <p
          className="text-xs mb-3 flex items-center gap-1"
          style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}
        >
          {isAdmin ? (
            <>
              <Pencil size={11} /> 管理者模式：點時間旁的鉛筆圖示可調整行程時間
            </>
          ) : (
            <>
              <Eye size={11} /> 使用者檢視：行程時間唯讀，可在各站寫個人筆記
            </>
          )}
        </p>

        <div>
          {stops.map((stop, i) => (
            <TimelineStop
              key={stop.id}
              stop={stop}
              isExpanded={expandedId === stop.id}
              onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              theme={theme}
              isLast={i === stops.length - 1}
              isAdmin={isAdmin}
              isNearby={stop.id === autoCurrentId}
              isEditing={editingId === stop.id}
              editValue={editValue}
              onStartEdit={startEdit}
              onChangeEditValue={setEditValue}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              note={notes[stop.id] || ""}
              onChangeNote={(text) => setNoteFor(stop.id, text)}
              onSaveGate={saveGate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ItemFormModal({ theme, isOpen, onClose, onSubmit, editingItem }) {
  const blank = { name: "", category: "藥妝", price: "", qty: 1, foundAt: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (editingItem) {
      setForm({
        name: editingItem.name,
        category: editingItem.category,
        price: editingItem.price,
        qty: editingItem.qty,
        foundAt: editingItem.foundAt.join("、"),
      });
    } else {
      setForm(blank);
    }
  }, [editingItem, isOpen]);

  if (!isOpen) return null;

  const canSubmit = form.name.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: form.name.trim(),
      category: form.category,
      price: form.price.trim() || "¥—",
      qty: Number(form.qty) || 1,
      foundAt: form.foundAt
        .split(/[、,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  const fieldStyle = {
    backgroundColor: theme.bgSunken,
    color: theme.textPrimary,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Sans TC', sans-serif",
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 430,
          maxHeight: "85vh",
          backgroundColor: theme.bgPage,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <h2 className="text-base font-bold" style={{ color: theme.textPrimary, fontFamily: "'Noto Serif TC', serif" }}>
            {editingItem ? "編輯商品" : "新增商品"}
          </h2>
          <button onClick={onClose} className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, backgroundColor: theme.bgSunken }}>
            <X size={15} color={theme.textSecondary} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
              商品名稱
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例如：SHISEIDO 化妝水"
              autoFocus
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
          </div>

          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
              分類
            </label>
            <div className="flex gap-2 flex-wrap">
              {SHOPPING_CATEGORIES.filter((c) => c !== "全部").map((cat) => (
                <button
                  key={cat}
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className="px-3 py-1.5 rounded-full text-xs"
                  style={{
                    backgroundColor: form.category === cat ? theme.indigo : theme.bgSunken,
                    color: form.category === cat ? "#fff" : theme.textSecondary,
                    border: `1px solid ${form.category === cat ? theme.indigo : theme.border}`,
                    fontFamily: "'Noto Sans TC', sans-serif",
                    fontWeight: form.category === cat ? 700 : 500,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold mb-1 block" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
                預估價格
              </label>
              <input
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="¥1,000"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ ...fieldStyle, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
            <div style={{ width: 90 }}>
              <label className="text-xs font-bold mb-1 block" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
                數量
              </label>
              <input
                type="number"
                min={1}
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ ...fieldStyle, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
              在附近尋找（用頓號、逗號分隔多間店）
            </label>
            <input
              value={form.foundAt}
              onChange={(e) => setForm((f) => ({ ...f, foundAt: e.target.value }))}
              placeholder="例如：松本清、唐吉訶德"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
            <p className="text-xs mt-1" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
              這是你自己知道／打算去找的店家，每個人清單不同，這裡也會不一樣
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-xl py-3 text-sm font-bold mt-2"
            style={{
              backgroundColor: canSubmit ? theme.indigo : theme.bgSunken,
              color: canSubmit ? "#fff" : theme.textFaint,
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          >
            {editingItem ? "儲存修改" : "新增到清單"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShoppingItemCard({ theme, item, isEditing, onToggleEdit, onCommit, onToggleChecked, isConfirmingDelete, onRequestDelete, onCancelDelete, onDelete }) {
  const [draft, setDraft] = useState(null);

  // 進入編輯模式時，建立這張卡片自己的暫存草稿
  useEffect(() => {
    if (isEditing) {
      setDraft({
        name: item.name,
        category: item.category,
        price: item.price,
        qty: item.qty,
        foundAtText: item.foundAt.join("、"),
        note: item.note || "",
      });
    }
  }, [isEditing]);

  const commitAndClose = () => {
    if (!draft) {
      onToggleEdit();
      return;
    }
    onCommit({
      name: draft.name.trim() || item.name,
      category: draft.category,
      price: draft.price.trim() || "¥—",
      qty: Number(draft.qty) || 1,
      foundAt: draft.foundAtText
        .split(/[、,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      note: draft.note.trim(),
    });
  };

  const Icon = CATEGORY_ICON[item.category] || ShoppingBag;
  const fieldStyle = {
    backgroundColor: theme.bgSunken,
    color: theme.textPrimary,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Sans TC', sans-serif",
  };

  if (isEditing && draft) {
    return (
      <div
        className="rounded-2xl px-3 py-3"
        style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.indigoSoft}` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            autoFocus
            className="flex-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none"
            style={fieldStyle}
          />
          <button
            onClick={commitAndClose}
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 30, height: 30, backgroundColor: theme.green }}
            aria-label="完成編輯"
          >
            <Check size={15} color="#fff" strokeWidth={3} />
          </button>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-2">
          {SHOPPING_CATEGORIES.filter((c) => c !== "全部").map((cat) => (
            <button
              key={cat}
              onClick={() => setDraft((d) => ({ ...d, category: cat }))}
              className="px-2.5 py-1 rounded-full text-xs"
              style={{
                backgroundColor: draft.category === cat ? theme.indigo : theme.bgSunken,
                color: draft.category === cat ? "#fff" : theme.textSecondary,
                border: `1px solid ${draft.category === cat ? theme.indigo : theme.border}`,
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: draft.category === cat ? 700 : 500,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-2">
          <input
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            placeholder="¥1,000"
            className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none"
            style={{ ...fieldStyle, fontFamily: "'JetBrains Mono', monospace" }}
          />
          <input
            type="number"
            min={1}
            value={draft.qty}
            onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
            className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
            style={{ ...fieldStyle, width: 70, fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>

        <input
          value={draft.foundAtText}
          onChange={(e) => setDraft((d) => ({ ...d, foundAtText: e.target.value }))}
          placeholder="在附近尋找：松本清、唐吉訶德"
          className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none mb-2"
          style={fieldStyle}
        />

        <textarea
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          placeholder="備註（例如：幫朋友代買、要記得比價…）"
          rows={2}
          className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none"
          style={fieldStyle}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl px-3 py-3"
      style={{
        backgroundColor: theme.bgCard,
        border: `1px solid ${theme.border}`,
        opacity: item.checked ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onToggleEdit}>
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 44, height: 44, backgroundColor: theme.bgSunken }}
          >
            <Icon size={20} color={theme.indigo} />
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{
                color: item.checked ? theme.textFaint : theme.textPrimary,
                textDecoration: item.checked ? "line-through" : "none",
                fontFamily: "'Noto Sans TC', sans-serif",
              }}
            >
              {item.name}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{
                color: theme.textFaint,
                textDecoration: item.checked ? "line-through" : "none",
                fontFamily: "'Noto Sans TC', sans-serif",
              }}
            >
              {item.category} ・ {item.price} ・ 數量 x{item.qty}
            </p>
          </div>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleChecked();
          }}
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: 26,
            height: 26,
            backgroundColor: item.checked ? theme.green : "transparent",
            border: `2px solid ${item.checked ? theme.green : theme.border}`,
          }}
        >
          {item.checked && <Check size={16} color="#fff" strokeWidth={3} />}
        </button>
      </div>

      {item.note && (
        <div className="flex items-start gap-1.5 mt-2.5">
          <StickyNote size={12} color={theme.orange} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs" style={{ color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}>
            {item.note}
          </p>
        </div>
      )}

      {item.foundAt.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          <Search size={12} color={theme.textFaint} />
          <span
            className="text-xs"
            style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}
          >
            在附近尋找：
          </span>
          {item.foundAt.map((store, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: theme.bgSunken,
                color: theme.indigo,
                fontFamily: "'Noto Sans TC', sans-serif",
              }}
            >
              {store}
            </span>
          ))}
        </div>
      )}

      {isConfirmingDelete ? (
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs flex-1" style={{ color: theme.accentRed, fontFamily: "'Noto Sans TC', sans-serif" }}>
            確定刪除這個項目？
          </span>
          <button
            onClick={onCancelDelete}
            className="text-xs px-3 py-1 rounded-lg"
            style={{ backgroundColor: theme.bgSunken, color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}
          >
            取消
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-3 py-1 rounded-lg"
            style={{ backgroundColor: theme.accentRed, color: "#fff", fontFamily: "'Noto Sans TC', sans-serif" }}
          >
            刪除
          </button>
        </div>
      ) : (
        <button onClick={onRequestDelete} className="flex items-center gap-1 mt-2.5">
          <Trash2 size={11} color={theme.textFaint} />
          <span className="text-xs" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            刪除
          </span>
        </button>
      )}
    </div>
  );
}

function ShoppingTab({ theme, items, setItems }) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const toggleChecked = (id) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)));
  };

  const displayed = useMemo(() => {
    const filtered =
      activeCategory === "全部" ? items : items.filter((it) => it.category === activeCategory);
    return [...filtered].sort((a, b) => Number(a.checked) - Number(b.checked));
  }, [items, activeCategory]);

  const commitEdit = (id, data) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
    setEditingCardId(null);
  };

  const handleAddSubmit = (data) => {
    setItems((prev) => [...prev, { id: `p${Date.now()}`, checked: false, note: "", ...data }]);
    setFormOpen(false);
  };

  const deleteItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <div className="pt-4 pb-24 relative">
      <h2
        className="text-lg mb-3 px-4 flex items-center gap-2"
        style={{ color: theme.textPrimary, fontFamily: "'Noto Serif TC', serif", fontWeight: 700 }}
      >
        購物清單
      </h2>
      <p
        className="text-xs mb-3 px-4"
        style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}
      >
        點項目即可編輯名稱、分類、價格、備註與「在附近尋找」的店家；清單只存在你自己的裝置
      </p>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {SHOPPING_CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-4 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                backgroundColor: active ? theme.indigo : theme.bgCard,
                color: active ? "#fff" : theme.textSecondary,
                border: `1px solid ${active ? theme.indigo : theme.border}`,
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: active ? 700 : 500,
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="px-4 flex flex-col gap-3">
        {displayed.length === 0 && (
          <div
            className="rounded-2xl px-4 py-8 flex flex-col items-center gap-2"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
          >
            <ShoppingBag size={28} color={theme.textFaint} />
            <p className="text-sm" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
              這個分類還沒有項目，點右下角「＋」新增
            </p>
          </div>
        )}

        {displayed.map((item) => (
          <ShoppingItemCard
            key={item.id}
            theme={theme}
            item={item}
            isEditing={editingCardId === item.id}
            onToggleEdit={() => setEditingCardId((prev) => (prev === item.id ? null : item.id))}
            onCommit={(data) => commitEdit(item.id, data)}
            onToggleChecked={() => toggleChecked(item.id)}
            isConfirmingDelete={confirmDeleteId === item.id}
            onRequestDelete={() => setConfirmDeleteId(item.id)}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onDelete={() => deleteItem(item.id)}
          />
        ))}
      </div>

      <button
        onClick={() => setFormOpen(true)}
        className="fixed flex items-center justify-center rounded-full shadow-lg"
        style={{
          width: 52,
          height: 52,
          backgroundColor: theme.indigo,
          bottom: 84,
          right: "calc(50% - 199px)",
        }}
        aria-label="新增商品"
      >
        <Plus size={24} color="#fff" />
      </button>

      <ItemFormModal
        theme={theme}
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleAddSubmit}
        editingItem={null}
      />
    </div>
  );
}

function NearbyTab({ theme, day, days, dayIndex, setDayIndex }) {
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);

  const dayData = NEARBY_BY_DAY[day.id] || { remoteNotice: null, places: [] };

  const toggleFilter = (key) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const displayed =
    activeFilters.size === 0
      ? dayData.places
      : dayData.places.filter((p) => activeFilters.has(p.category));

  const hoursStyle = (type) => {
    if (type === "24h") return { color: theme.green, bg: theme.greenSoft, label: "24H" };
    if (type === "late") return { color: theme.orange, bg: theme.orangeSoft, label: "夜間" };
    return { color: theme.textSecondary, bg: theme.bgSunken, label: "營業中" };
  };

  return (
    <div className="pt-4 pb-6">
      <div className="px-4">
        <h2
          className="text-lg mb-1"
          style={{ color: theme.textPrimary, fontFamily: "'Noto Serif TC', serif", fontWeight: 700 }}
        >
          周邊探索
        </h2>
        <p className="text-xs mb-3" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
          依當晚住宿地點顯示，距離與店名已逐一查證，出發前仍建議實際用 Google 地圖走一次路線
        </p>
      </div>

      <DaySwitcher theme={theme} days={days} dayIndex={dayIndex} setDayIndex={setDayIndex} />

      <div className="px-4">
        {dayData.remoteNotice && (
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-3 mb-4"
            style={{ backgroundColor: theme.orangeSoft, border: `1px solid ${theme.orange}` }}
          >
            <AlertTriangle size={16} color={theme.orange} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed" style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}>
              {dayData.remoteNotice}
            </p>
          </div>
        )}

        <div className="flex gap-2 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {NEARBY_FILTERS.map((f) => {
            const active = activeFilters.has(f.key);
            return (
              <button
                key={f.key}
                onClick={() => toggleFilter(f.key)}
                className="px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: active ? theme.indigo : theme.bgCard,
                  color: active ? "#fff" : theme.textSecondary,
                  border: `1px solid ${active ? theme.indigo : theme.border}`,
                  fontFamily: "'Noto Sans TC', sans-serif",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          {displayed.length === 0 && !dayData.remoteNotice && (
            <div
              className="rounded-2xl px-4 py-8 flex flex-col items-center gap-2"
              style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
            >
              <Compass size={28} color={theme.textFaint} />
              <p className="text-sm text-center" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
                這個分類今天沒有查到符合的地點
              </p>
            </div>
          )}

          {displayed.length === 0 && dayData.remoteNotice && dayData.places.length === 0 && (
            <div
              className="rounded-2xl px-4 py-6 flex flex-col items-center gap-2"
              style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
            >
              <MapPin size={24} color={theme.textFaint} />
              <p className="text-xs text-center" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
                今晚步行範圍內沒有查到可靠的店家資訊，請參考上方說明
              </p>
            </div>
          )}

          {displayed.map((place) => {
            const Icon = NEARBY_ICON[place.category] || Store;
            const hs = hoursStyle(place.hoursType);
            const isOpen = expandedId === place.id;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              place.mapsQuery
            )}`;

            return (
              <div
                key={place.id}
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
              >
                <button
                  className="w-full text-left px-3 py-3 flex items-center gap-3"
                  onClick={() => setExpandedId((prev) => (prev === place.id ? null : place.id))}
                >
                  <div
                    className="flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ width: 44, height: 44, backgroundColor: theme.bgSunken }}
                  >
                    <Icon size={20} color={theme.indigo} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}
                    >
                      {place.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Footprints size={13} color={theme.textFaint} />
                      <span
                        className="text-xs"
                        style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}
                      >
                        {place.distanceLabel}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: hs.bg, color: hs.color, fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 700 }}
                      >
                        {place.hoursLabel}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={17}
                    color={theme.textSecondary}
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  />
                </button>

                {isOpen && (
                  <div className="px-3 pb-3">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
                      style={{ backgroundColor: theme.indigo, textDecoration: "none" }}
                    >
                      <Navigation2 size={16} color="#fff" />
                      <span
                        className="text-sm font-bold"
                        style={{ color: "#fff", fontFamily: "'Noto Sans TC', sans-serif" }}
                      >
                        導航至 Google Maps
                      </span>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   緊急聯絡卡
   ====================================================================== */

function EmergencyModal({ theme, isOpen, onClose, day }) {
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  const CallRow = ({ icon: Icon, label, phone, sub, color }) => (
    <a
      href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
      className="flex items-center gap-3 rounded-xl px-3 py-3"
      style={{ backgroundColor: theme.bgSunken, textDecoration: "none" }}
    >
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 36, height: 36, backgroundColor: color || theme.indigo }}
      >
        <Icon size={16} color="#fff" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}>
          {label}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            {sub}
          </p>
        )}
      </div>
      <span className="text-sm font-bold" style={{ color: theme.indigo, fontFamily: "'JetBrains Mono', monospace" }}>
        {phone}
      </span>
    </a>
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 430,
          maxHeight: "85vh",
          backgroundColor: theme.bgPage,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} color={theme.accentRed} />
            <h2 className="text-base font-bold" style={{ color: theme.textPrimary, fontFamily: "'Noto Serif TC', serif" }}>
              緊急聯絡卡
            </h2>
          </div>
          <button onClick={onClose} className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, backgroundColor: theme.bgSunken }}>
            <X size={15} color={theme.textSecondary} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-xs mb-2 font-bold" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            領隊
          </p>
          <div className="flex flex-col gap-2 mb-5">
            <CallRow icon={Phone} label={TRIP_META.leaderName} phone={TRIP_META.leaderPhoneJP} sub="當地門號" color={theme.indigo} />
            <CallRow icon={Phone} label={TRIP_META.leaderName} phone={TRIP_META.leaderPhoneTW} sub="台灣門號（漫遊）" color={theme.indigoSoft} />
          </div>

          {day.hotel && (
            <>
              <p className="text-xs mb-2 font-bold" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
                今晚住宿
              </p>
              <div
                className="flex items-center gap-3 rounded-xl px-3 py-3 mb-5"
                style={{ backgroundColor: theme.bgSunken }}
              >
                <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 36, height: 36, backgroundColor: theme.green }}>
                  <Building2 size={16} color="#fff" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}>
                    {day.hotel.name}
                  </p>
                  <a
                    href={day.hotel.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs"
                    style={{ color: theme.indigo, fontFamily: "'Noto Sans TC', sans-serif" }}
                  >
                    查看飯店官網
                  </a>
                </div>
              </div>
            </>
          )}

          <p className="text-xs mb-2 font-bold" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            日本當地報案／急救
          </p>
          <div className="flex gap-2 mb-5">
            <CallRow icon={Siren} label="警察" phone={EMERGENCY_INFO.police} color={theme.accentRed} />
          </div>
          <div className="flex gap-2 mb-5">
            <CallRow icon={Siren} label="消防／救護車" phone={EMERGENCY_INFO.ambulanceFire} color={theme.orange} />
          </div>

          <p className="text-xs mb-2 font-bold" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            駐日代表處（護照遺失／遭遇急難）
          </p>
          <div className="flex flex-col gap-2 mb-2">
            {EMERGENCY_INFO.offices.map((o, i) => (
              <CallRow key={i} icon={ShieldAlert} label={o.label} phone={o.emergencyMobile || o.emergencyPhone} sub={o.note} color={theme.indigo} />
            ))}
          </div>
          <p className="text-xs mb-5" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            {EMERGENCY_INFO.globalHotline.label}（日本境內撥打 {EMERGENCY_INFO.globalHotline.dialFromJapan}）：{EMERGENCY_INFO.globalHotline.note}
          </p>

          <p className="text-xs mb-2 font-bold flex items-center gap-1" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            <FileText size={12} /> 隨身備忘（僅存在本次瀏覽，不會上傳）
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可先記下護照號碼、保單號碼等資訊，方便真的遺失時申報"
            rows={3}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
            style={{
              backgroundColor: theme.bgSunken,
              color: theme.textPrimary,
              border: `1px solid ${theme.border}`,
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          />
          <p className="text-xs mt-4" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            以上緊急電話資訊已於 2026 年 7 月核對駐日代表處官網，出發前仍建議自行覆核一次。
          </p>
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   設定面板：管理者登入／登出、重置資料
   ====================================================================== */

function SettingsModal({ theme, isOpen, onClose, isAdmin, setIsAdmin, onReset, hasLocalStorage }) {
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPwInput("");
      setPwError(false);
      setConfirmReset(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tryLogin = () => {
    if (pwInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setPwInput("");
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 430,
          maxHeight: "85vh",
          backgroundColor: theme.bgPage,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2">
            <Settings size={20} color={theme.indigo} />
            <h2 className="text-base font-bold" style={{ color: theme.textPrimary, fontFamily: "'Noto Serif TC', serif" }}>
              設定
            </h2>
          </div>
          <button onClick={onClose} className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, backgroundColor: theme.bgSunken }}>
            <X size={15} color={theme.textSecondary} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* 管理者區塊 */}
          <p className="text-xs mb-2 font-bold" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            管理者模式
          </p>

          {isAdmin ? (
            <div
              className="rounded-xl px-3 py-3 mb-5"
              style={{ backgroundColor: theme.greenSoft, border: `1px solid ${theme.green}` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <LockOpen size={16} color={theme.green} />
                <span className="text-sm font-bold" style={{ color: theme.textPrimary, fontFamily: "'Noto Sans TC', sans-serif" }}>
                  已解鎖 — 你現在可以編輯所有行程與時間
                </span>
              </div>
              <button
                onClick={() => setIsAdmin(false)}
                className="w-full rounded-lg py-2 text-sm font-bold"
                style={{ backgroundColor: theme.bgCard, color: theme.textSecondary, border: `1px solid ${theme.border}`, fontFamily: "'Noto Sans TC', sans-serif" }}
              >
                登出管理者（切回使用者檢視）
              </button>
            </div>
          ) : (
            <div
              className="rounded-xl px-3 py-3 mb-5"
              style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Lock size={15} color={theme.textSecondary} />
                <span className="text-sm" style={{ color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}>
                  輸入管理者密碼以編輯行程
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={pwInput}
                  onChange={(e) => {
                    setPwInput(e.target.value);
                    setPwError(false);
                  }}
                  onKeyDown={(e) => (e.key === "Enter" ? tryLogin() : null)}
                  placeholder="密碼"
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: theme.bgSunken,
                    color: theme.textPrimary,
                    border: `1px solid ${pwError ? theme.accentRed : theme.border}`,
                    fontFamily: "'Noto Sans TC', sans-serif",
                  }}
                />
                <button
                  onClick={tryLogin}
                  className="rounded-lg px-4 text-sm font-bold"
                  style={{ backgroundColor: theme.indigo, color: "#fff", fontFamily: "'Noto Sans TC', sans-serif" }}
                >
                  解鎖
                </button>
              </div>
              {pwError && (
                <p className="text-xs mt-1.5" style={{ color: theme.accentRed, fontFamily: "'Noto Sans TC', sans-serif" }}>
                  密碼錯誤，請再試一次
                </p>
              )}
            </div>
          )}

          {/* 資料儲存狀態 */}
          <p className="text-xs mb-2 font-bold" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            資料儲存
          </p>
          <div
            className="rounded-xl px-3 py-3 mb-5"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
          >
            <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}>
              {hasLocalStorage
                ? "目前資料會自動儲存在此裝置的瀏覽器（localStorage），下次打開仍在。"
                : "偵測到此環境不支援 localStorage（例如預覽視窗），資料改為暫存於記憶體，重新整理後會還原。下載到自己的環境或部署後即可正常持久化。"}
            </p>
          </div>

          {/* 重置 */}
          <p className="text-xs mb-2 font-bold" style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}>
            開發／測試
          </p>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3"
              style={{ backgroundColor: theme.accentRedSoft, border: `1px solid ${theme.accentRed}` }}
            >
              <RotateCcw size={16} color={theme.accentRed} />
              <span className="text-sm font-bold" style={{ color: theme.accentRed, fontFamily: "'Noto Sans TC', sans-serif" }}>
                重置所有資料
              </span>
            </button>
          ) : (
            <div
              className="rounded-xl px-3 py-3"
              style={{ backgroundColor: theme.accentRedSoft, border: `1px solid ${theme.accentRed}` }}
            >
              <p className="text-sm font-bold mb-1" style={{ color: theme.accentRed, fontFamily: "'Noto Sans TC', sans-serif" }}>
                確定要重置嗎？
              </p>
              <p className="text-xs mb-3" style={{ color: theme.textSecondary, fontFamily: "'Noto Sans TC', sans-serif" }}>
                將清除所有已儲存的行程修改、時間調整、購物勾選與個人筆記，並恢復成預設的行程表。此動作無法復原。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 rounded-lg py-2 text-sm font-bold"
                  style={{ backgroundColor: theme.bgCard, color: theme.textSecondary, border: `1px solid ${theme.border}`, fontFamily: "'Noto Sans TC', sans-serif" }}
                >
                  取消
                </button>
                <button
                  onClick={onReset}
                  className="flex-1 rounded-lg py-2 text-sm font-bold"
                  style={{ backgroundColor: theme.accentRed, color: "#fff", fontFamily: "'Noto Sans TC', sans-serif" }}
                >
                  確定重置
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   Header / Bottom Nav
   ====================================================================== */

function Header({ theme, isDark, setIsDark, day, dayIndex, totalDays, isAdmin, onOpenEmergency, onOpenSettings }) {
  return (
    <div
      className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
      style={{ backgroundColor: theme.navBg, borderBottom: `1px solid ${theme.border}` }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 32, height: 32, backgroundColor: theme.indigo }}
        >
          <MapPin size={17} color="#fff" />
        </div>
        <div>
          <p
            className="text-sm leading-tight flex items-center gap-1.5"
            style={{ color: theme.textPrimary, fontFamily: "'Noto Serif TC', serif", fontWeight: 700 }}
          >
            {day.dayLabel} ・ {day.cityLabel}
            {isAdmin && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                style={{ backgroundColor: theme.green, color: "#fff", fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 700 }}
              >
                <LockOpen size={9} /> 管理
              </span>
            )}
          </p>
          <p
            className="text-xs leading-tight"
            style={{ color: theme.textFaint, fontFamily: "'Noto Sans TC', sans-serif" }}
          >
            行程進度 {dayIndex + 1} / {totalDays}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenEmergency}
          className="flex items-center justify-center rounded-full"
          style={{ width: 36, height: 36, backgroundColor: theme.accentRedSoft }}
          aria-label="緊急聯絡卡"
        >
          <ShieldAlert size={17} color={theme.accentRed} />
        </button>
        <button
          onClick={() => setIsDark((d) => !d)}
          className="flex items-center justify-center rounded-full"
          style={{ width: 36, height: 36, backgroundColor: theme.bgSunken }}
          aria-label="切換深淺色模式"
        >
          {isDark ? <Sun size={18} color={theme.orange} /> : <Moon size={18} color={theme.indigo} />}
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center rounded-full"
          style={{ width: 36, height: 36, backgroundColor: theme.bgSunken }}
          aria-label="設定"
        >
          <Settings size={18} color={theme.textSecondary} />
        </button>
      </div>
    </div>
  );
}

function BottomNav({ theme, activeTab, setActiveTab }) {
  const tabs = [
    { key: "itinerary", label: "今日行程", icon: MapPin },
    { key: "shopping", label: "購物清單", icon: ShoppingCart },
    { key: "nearby", label: "周邊探索", icon: Compass },
  ];

  return (
    <div
      className="sticky bottom-0 z-20 flex items-stretch"
      style={{ backgroundColor: theme.navBg, borderTop: `1px solid ${theme.border}` }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5"
          >
            <Icon size={20} color={active ? theme.indigo : theme.textFaint} strokeWidth={active ? 2.5 : 2} />
            <span
              className="text-xs"
              style={{
                color: active ? theme.indigo : theme.textFaint,
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: active ? 700 : 500,
              }}
            >
              {tab.label}
            </span>
            <div
              className="rounded-full"
              style={{
                width: 4,
                height: 4,
                backgroundColor: active ? theme.indigo : "transparent",
                marginTop: -2,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ======================================================================
   主程式
   ====================================================================== */

export default function JapanTourApp() {
  useFonts();
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState("itinerary");
  const [dayIndex, setDayIndex] = useState(0);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---- 持久化資料（localStorage，含安全降級）----
  const [daysData, setDaysData] = useLocalStorage("days", DAYS);
  const [shoppingItems, setShoppingItems] = useLocalStorage("shopping", SHOPPING_ITEMS);
  const [notes, setNotes] = useLocalStorage("notes", {}); // { [stopId]: "使用者的個人筆記" }
  const [isAdmin, setIsAdmin] = useLocalStorage("isAdmin", false);

  const theme = isDark ? DARK : LIGHT;
  // daysData 可能因重置或舊資料而長度不同，用 dayIndex 邊界保護
  const safeDayIndex = Math.min(dayIndex, daysData.length - 1);
  const day = daysData[safeDayIndex];

  // 更新某一天的 stops（管理者編輯行程用）
  const updateDayStops = (dIndex, newStops) => {
    setDaysData((prev) => prev.map((d, i) => (i === dIndex ? { ...d, stops: newStops } : d)));
  };

  const resetAll = () => {
    clearAllStored();
    setDaysData(DAYS);
    setShoppingItems(SHOPPING_ITEMS);
    setNotes({});
    setIsAdmin(false);
    setDayIndex(0);
    setSettingsOpen(false);
  };

  return (
    <div
      className="min-h-screen flex justify-center"
      style={{ backgroundColor: isDark ? "#0A0B10" : "#D8DBE3" }}
    >
      <div
        className="w-full flex flex-col relative"
        style={{ maxWidth: 430, backgroundColor: theme.bgPage, minHeight: "100vh" }}
      >
        <Header
          theme={theme}
          isDark={isDark}
          setIsDark={setIsDark}
          day={day}
          dayIndex={safeDayIndex}
          totalDays={daysData.length}
          isAdmin={isAdmin}
          onOpenEmergency={() => setEmergencyOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex-1 overflow-y-auto">
          {activeTab === "itinerary" && (
            <ItineraryTab
              theme={theme}
              day={day}
              days={daysData}
              dayIndex={safeDayIndex}
              setDayIndex={setDayIndex}
              isAdmin={isAdmin}
              updateDayStops={updateDayStops}
              notes={notes}
              setNotes={setNotes}
            />
          )}
          {activeTab === "shopping" && (
            <ShoppingTab theme={theme} items={shoppingItems} setItems={setShoppingItems} />
          )}
          {activeTab === "nearby" && (
            <NearbyTab theme={theme} day={day} days={daysData} dayIndex={safeDayIndex} setDayIndex={setDayIndex} />
          )}
        </div>

        <BottomNav theme={theme} activeTab={activeTab} setActiveTab={setActiveTab} />

        <EmergencyModal
          theme={theme}
          isOpen={emergencyOpen}
          onClose={() => setEmergencyOpen(false)}
          day={day}
        />

        <SettingsModal
          theme={theme}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          isAdmin={isAdmin}
          setIsAdmin={setIsAdmin}
          onReset={resetAll}
          hasLocalStorage={HAS_LS}
        />
      </div>
    </div>
  );
}
