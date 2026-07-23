import { HealthData, UserProfile } from '../types';

// Physical Health Database
export const HEALTH_DATABASE: HealthData[] = [
  {
    id: 'health_optimal',
    label: '✨ 元氣滿滿健康態 (Optimal Energy)',
    heartRate: 72,
    bloodPressure: '120/80',
    sleepDuration: 8.2,
    fatigueLevel: 'Low',
    stressLevel: 'Chill',
    bodyTemperature: 36.5
  },
  {
    id: 'health_coder',
    label: '💻 熬夜爆肝程式碼 (Late-night Coding Exhaustion)',
    heartRate: 88,
    bloodPressure: '135/85',
    sleepDuration: 4.5,
    fatigueLevel: 'High',
    stressLevel: 'Overloaded',
    bodyTemperature: 36.8
  },
  {
    id: 'health_sleepy_cat',
    label: '🐱 懶洋洋午後小憩 (Sleepy Cat Mode)',
    heartRate: 64,
    bloodPressure: '110/70',
    sleepDuration: 9.5,
    fatigueLevel: 'Medium',
    stressLevel: 'Chill',
    bodyTemperature: 38.2 // Cat temp is higher!
  },
  {
    id: 'health_streamer',
    label: '🎙️ 熱情高漲直播中 (High-adrenaline Streamer)',
    heartRate: 95,
    bloodPressure: '128/82',
    sleepDuration: 7.0,
    fatigueLevel: 'Medium',
    stressLevel: 'Productive',
    bodyTemperature: 36.6
  },
  {
    id: 'health_chill_out',
    label: '🌇 霓虹慢搖漫步 (Retro Chillwave State)',
    heartRate: 68,
    bloodPressure: '115/75',
    sleepDuration: 8.0,
    fatigueLevel: 'Low',
    stressLevel: 'Chill',
    bodyTemperature: 36.4
  }
];

// Fallback Avatars using beautiful SVG-based avatar generator DiceBear or standard high quality illustration vectors
export const AVATARS = {
  sugar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=sugar&hair=long&hairColor=ff85ad&mouth=smile&eyes=happy',
  leo: 'https://api.dicebear.com/7.x/bottts/svg?seed=leo&colors=blue&texture=radar',
  cat: 'https://api.dicebear.com/7.x/identicon/svg?seed=cat&colors=orange',
  sunny: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sunny&top=shortCurly&accessories=round&hairColor=auburn',
  retro: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=retro&glasses=sunglasses'
};

export const INITIAL_USERS: UserProfile[] = [
  {
    id: "user_sugar",
    name: "夢乃糖糖 🎀",
    avatar: AVATARS.sugar,
    status: "online",
    statusText: "直播進行中",
    todayStatement: "大家早安！今天也是充滿粉紅色泡泡的一天，記得點進來跟我留言聊天哦～ 💖",
    healthDataId: "health_streamer",
    comments: [
      { id: "c1", sender: "極客雷歐 💻", text: "今天直播設備聲音有點小，幫你調好了！", time: "2026-07-20 09:15", healthDataId: "health_coder" },
      { id: "c2", sender: "路人小明", text: "糖糖今天戴的貓耳耳機超可愛！求連結！", time: "2026-07-20 10:20" },
      { id: "c3", sender: "喵喵宇航員 🐱", text: "喵～糖糖，等等要一起連線打遊戲嗎？", time: "2026-07-20 10:45", healthDataId: "health_sleepy_cat" }
    ]
  },
  {
    id: "user_leo",
    name: "極客雷歐 💻",
    avatar: AVATARS.leo,
    status: "busy",
    statusText: "編譯代碼中",
    todayStatement: "別吵我，我正跟一個頑固的 Bug 進行生死決鬥！這段寫完我就要去補眠了... ☕",
    healthDataId: "health_coder",
    comments: [
      { id: "c4", sender: "夢乃糖糖 🎀", text: "雷歐加油！Bug 退散！不要又爆肝了喔～", time: "2026-07-20 09:30", healthDataId: "health_streamer" },
      { id: "c5", sender: "系統管理員", text: "伺服器負載偏高，請雷歐大佬抽空優化一下緩存機制。", time: "2026-07-20 10:05" },
      { id: "c6", sender: "訪客甲", text: "大佬，想請問你鍵盤是用什麼軸的？打字聲好好聽！", time: "2026-07-20 11:00" }
    ]
  },
  {
    id: "user_cat",
    name: "喵喵宇航員 🐱",
    avatar: AVATARS.cat,
    status: "away",
    statusText: "太空飄浮中",
    todayStatement: "喵嗚～在 3 萬英呎的星空進行太空漫遊，有人可以快遞貓罐頭上來嗎？🚀",
    healthDataId: "health_sleepy_cat",
    comments: [
      { id: "c7", sender: "陽光晴晴 ☀️", text: "貓貓太萌了，每次看你飄浮都覺得超療癒！", time: "2026-07-20 08:45", healthDataId: "health_optimal" },
      { id: "c8", sender: "復古霓虹 🌇", text: "太空中聽電子樂最配了，推薦你我的霓虹歌單！", time: "2026-07-20 09:12", healthDataId: "health_chill_out" }
    ]
  },
  {
    id: "user_sunny",
    name: "陽光晴晴 ☀️",
    avatar: AVATARS.sunny,
    status: "online",
    statusText: "心情明亮",
    todayStatement: "今天天氣真好！出門喝杯燕麥拿鐵，祝大家今天都有個順利美好的開始！🍀",
    healthDataId: "health_optimal",
    comments: [
      { id: "c9", sender: "訪客乙", text: "早安晴晴！看到你的留言，感覺今天工作都有動力了！", time: "2026-07-20 08:30" },
      { id: "c10", sender: "夢乃糖糖 🎀", text: "晴晴今天穿的那件黃色洋裝太好看了吧！", time: "2026-07-20 09:50", healthDataId: "health_streamer" }
    ]
  },
  {
    id: "user_retro",
    name: "復古霓虹 🌇",
    avatar: AVATARS.retro,
    status: "offline",
    statusText: "時空旅行中",
    todayStatement: "Welcome to 1980s. 正在循環播放 Synthwave 電子樂中... 暫時不在服務區。📼",
    healthDataId: "health_chill_out",
    comments: [
      { id: "c11", sender: "極客雷歐 💻", text: "你的 Synthwave 歌單寫 code 超配，已經循環播放 8 小時了。", time: "2026-07-20 02:40", healthDataId: "health_coder" },
      { id: "c12", sender: "路人阿強", text: "這張頭像也太帥了吧！有賽博朋克的味道。", time: "2026-07-20 07:15" }
    ]
  }
];
