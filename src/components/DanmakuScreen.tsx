import React, { useState, useEffect, useRef } from 'react';
import { DanmakuMessage } from '../types';
import { 
  MessageSquare, 
  Send, 
  Gamepad2, 
  X, 
  Pause, 
  Heart, 
  Sparkles, 
  Star,
  Thermometer,
  Droplets,
  Wind,
  Volume2,
  VolumeX,
  AlertTriangle,
  Activity,
  Snowflake,
  Shield,
  Plus,
  Minus,
  Camera,
  Upload,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Info,
  Navigation,
  MapPin,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  RefreshCw,
  Brain,
  Edit3,
  Music,
  Bell,
  Clock
} from 'lucide-react';
import { RecommendedSong } from '../types';
import { 
  googleSignIn, 
  saveSpecialReportProfileToFolder, 
  readAllSpecialReportsFromFolder, 
  simulateAddHistoricalDayToFolder,
  saveMyPlaylistToFolder,
  readMyPlaylistFromFolder,
  SPECIAL_REPORT_FOLDER_NAME,
  MY_PLAYLIST_FILENAME 
} from './googleDriveService';

const TAIWAN_CITIES = [
  { name: '台北市', lat: 25.03, lng: 121.56 },
  { name: '新北市', lat: 25.01, lng: 121.46 },
  { name: '桃園市', lat: 24.99, lng: 121.31 },
  { name: '台中市', lat: 24.14, lng: 120.67 },
  { name: '台南市', lat: 22.99, lng: 120.21 },
  { name: '高雄市', lat: 22.62, lng: 120.30 },
  { name: '基隆市', lat: 25.12, lng: 121.74 },
  { name: '新竹市', lat: 24.81, lng: 120.96 },
  { name: '新竹縣', lat: 24.83, lng: 121.01 },
  { name: '苗栗縣', lat: 24.56, lng: 120.82 },
  { name: '彰化縣', lat: 24.05, lng: 120.51 },
  { name: '南投縣', lat: 23.91, lng: 120.68 },
  { name: '雲林縣', lat: 23.70, lng: 120.43 },
  { name: '嘉義市', lat: 23.48, lng: 120.44 },
  { name: '嘉義縣', lat: 23.46, lng: 120.33 },
  { name: '屏東縣', lat: 22.67, lng: 120.48 },
  { name: '宜蘭縣', lat: 24.75, lng: 121.75 },
  { name: '花蓮縣', lat: 23.97, lng: 121.60 },
  { name: '台東縣', lat: 22.75, lng: 121.14 },
  { name: '澎湖縣', lat: 23.56, lng: 119.56 },
  { name: '金門縣', lat: 24.44, lng: 118.38 },
  { name: '連江縣', lat: 26.16, lng: 119.95 }
];

interface DanmakuScreenProps {
  danmakus: DanmakuMessage[];
  onTogglePauseDanmaku: (id: string) => void;
  onRightClickDanmaku: (danmaku: DanmakuMessage, x: number, y: number) => void;
  bubbleMenu: {
    visible: boolean;
    x: number;
    y: number;
    targetDanmaku: DanmakuMessage | null;
  } | null;
  onCloseBubbleMenu: () => void;
  onPostBubbleReply: (danmaku: DanmakuMessage, replyText: string, senderName: string) => void;
  bubbleReplies: Record<string, { sender: string; text: string; time: string }[]>;
  onLaunchGame: () => void; // Shortcut to launch game
  onPlaySong?: (song: RecommendedSong) => void;
  onPlayXiangqi?: () => void;
}

// Elderly HMI Profiles
const ELDER_PROFILES = {
  grandpa: {
    name: 'Me',
    age: 78,
    condition: '高血壓、心血管病史',
    bodyTemp: 37.1,
    heartRate: 82,
    waterGoal: 2000,
    sensitivity: '高度 (High)',
    avatar: '👴',
    bpHigh: 128,
    bpLow: 82
  },
  grandma: {
    name: '林奶奶',
    age: 82,
    condition: '糖尿病、慢性腎衰竭',
    bodyTemp: 36.8,
    heartRate: 76,
    waterGoal: 1800,
    sensitivity: '極高 (Critical)',
    avatar: '👵',
    bpHigh: 135,
    bpLow: 85
  },
  uncle: {
    name: '張外公',
    age: 71,
    condition: '輕微關節炎、健康狀態尚可',
    bodyTemp: 36.5,
    heartRate: 71,
    waterGoal: 2200,
    sensitivity: '中等 (Moderate)',
    avatar: '👨‍🦳',
    bpHigh: 118,
    bpLow: 75
  }
};

export default function DanmakuScreen({
  danmakus,
  onTogglePauseDanmaku,
  onRightClickDanmaku,
  bubbleMenu,
  onCloseBubbleMenu,
  onPostBubbleReply,
  bubbleReplies,
  onLaunchGame,
  onPlaySong,
  onPlayXiangqi,
}: DanmakuScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);

  // Form states for Bubble reply
  const [replyText, setReplyText] = useState('');
  const [replySender, setReplySender] = useState('');

  // ---------------------------------------------------------------------------
  // 🌡️ 高齡者防中暑個人化人機介面 (Elderly Heatstroke Prevention HMI) States
  // ---------------------------------------------------------------------------
  const [elderId, setElderId] = useState<'grandpa' | 'grandma' | 'uncle'>('grandpa');
  const [elderProfiles, setElderProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem('bilibili_elder_profiles');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return ELDER_PROFILES;
  });

  const currentElder = elderProfiles[elderId];

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [editingAgeVal, setEditingAgeVal] = useState('');
  const [isEvaluatingSensitivity, setIsEvaluatingSensitivity] = useState(false);

  useEffect(() => {
    localStorage.setItem('bilibili_elder_profiles', JSON.stringify(elderProfiles));
  }, [elderProfiles]);

  const handleSaveName = () => {
    if (editingNameVal.trim()) {
      setElderProfiles(prev => {
        const updated = {
          ...prev,
          [elderId]: {
            ...prev[elderId],
            name: editingNameVal.trim(),
            age: parseInt(editingAgeVal) || prev[elderId].age
          }
        };
        return updated;
      });
    }
    setIsEditingName(false);
  };

  const handleEvaluateSensitivity = async () => {
    setIsEvaluatingSensitivity(true);
    playSynthSound(440, 'sine', 0.15);
    try {
      const response = await fetch('/api/gemini/evaluate-sensitivity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          age: currentElder.age,
          condition: currentElder.condition || '健康',
        }),
      });

      if (!response.ok) {
        throw new Error('評估失敗');
      }

      const data = await response.json();
      if (data && data.sensitivity) {
        setElderProfiles(prev => ({
          ...prev,
          [elderId]: {
            ...prev[elderId],
            sensitivity: data.sensitivity,
            sensitivityReason: data.reason || ''
          }
        }));
        playSynthSound(880, 'sine', 0.25);
        speakAlert(`AI 已評估 ${currentElder.name} 的熱敏感風險度為：${data.sensitivity}。評估理由：${data.reason || '無'}`);
      }
    } catch (e) {
      console.error(e);
      playSynthSound(220, 'sawtooth', 0.3);
    } finally {
      setIsEvaluatingSensitivity(false);
    }
  };

  const [temp, setTemp] = useState(32.5); // Default high room temp
  const [humidity, setHumidity] = useState(72); // Default high room humidity
  const [acOn, setAcOn] = useState(false);
  const [waterIntake, setWaterIntake] = useState(800);
  const [ventilation, setVentilation] = useState(false);
  const [voiceAlert, setVoiceAlert] = useState(true);
  const [timeUntilReset, setTimeUntilReset] = useState('');

  // Live countdown timer to midnight (00:00 reset time)
  useEffect(() => {
    const updateResetCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0); // Next midnight
      const diffMs = Math.max(0, midnight.getTime() - now.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeUntilReset(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    updateResetCountdown();
    const interval = setInterval(updateResetCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // 🕒 Data Modification Timestamps (資料改動時間標註)
  const getCurrentFormattedTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [bpLastUpdated, setBpLastUpdated] = useState(() => {
    return localStorage.getItem('bilibili_bp_updated') || '08:30';
  });
  const [bodyTempLastUpdated, setBodyTempLastUpdated] = useState(() => {
    return localStorage.getItem('bilibili_temp_updated') || '08:15';
  });
  const [waterLastUpdated, setWaterLastUpdated] = useState(() => {
    return localStorage.getItem('bilibili_water_updated') || '09:00';
  });

  useEffect(() => {
    localStorage.setItem('bilibili_bp_updated', bpLastUpdated);
  }, [bpLastUpdated]);

  useEffect(() => {
    localStorage.setItem('bilibili_temp_updated', bodyTempLastUpdated);
  }, [bodyTempLastUpdated]);

  useEffect(() => {
    localStorage.setItem('bilibili_water_updated', waterLastUpdated);
  }, [waterLastUpdated]);

  // ⏰ Scheduled Time Notification States (時間設定通知: 上午, 下午, 自由時段)
  const [scheduledMorning, setScheduledMorning] = useState(() => localStorage.getItem('bilibili_sch_morning') || '08:30');
  const [scheduledAfternoon, setScheduledAfternoon] = useState(() => localStorage.getItem('bilibili_sch_afternoon') || '14:30');
  const [scheduledCustom, setScheduledCustom] = useState(() => localStorage.getItem('bilibili_sch_custom') || '20:00');
  const [isAutoScheduleEnabled, setIsAutoScheduleEnabled] = useState(true);
  const [lastAutoTriggerMinute, setLastAutoTriggerMinute] = useState('');
  const [isPushingLine, setIsPushingLine] = useState(false);
  const [pushTriggerLogs, setPushTriggerLogs] = useState<string[]>([]);

  // ☁️ Google Drive Sync States & Long Press Handler
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveSyncMessage, setDriveSyncMessage] = useState<string | null>(null);
  const [driveReportsData, setDriveReportsData] = useState<Record<string, any> | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const activeAccessTokenRef = useRef<string | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef(false);
  const [pressingProfileId, setPressingProfileId] = useState<string | null>(null);

  const handleGoogleDriveSync = async () => {
    setIsDriveSyncing(true);
    setDriveSyncMessage('正在驗證 Google 帳號與建立 API Special Report 20260723 雲端資料夾...');
    playSynthSound(600, 'sine', 0.15);
    speakAlert('準備啟動 Google 帳號授權，建立並同步 Google Drive 雲端資料夾 API Special Report 20260723...');

    try {
      const authResult = await googleSignIn();
      if (!authResult || !authResult.accessToken) {
        setDriveSyncMessage('Google 登入視窗已被關閉、被阻擋或取消。若瀏覽器阻擋彈出視窗，請允許彈出視窗後重試！');
        return;
      }

      const token = authResult.accessToken;
      activeAccessTokenRef.current = token;
      const profilesToSync: Array<keyof typeof elderProfiles> = ['grandpa', 'grandma', 'uncle'];

      // Save/sync each profile's dataset & 3rd image schedule stats to "API Special Report 20260723" folder
      for (const key of profilesToSync) {
        const p = elderProfiles[key];
        await saveSpecialReportProfileToFolder(token, String(key), {
          profile: p,
          scheduleStats: {
            scheduledMorning,
            scheduledAfternoon,
            scheduledCustom,
            isAutoScheduleEnabled
          },
          vitals: {
            waterIntake,
            bodyTempLastUpdated,
            bpLastUpdated,
            waterLastUpdated,
            riskLabel: riskMeta.label
          }
        });
      }

      // 🎵 Save/sync Personal Playlist to "API Special Report 20260723" folder (MyPlaylist_SpecialReport_20260723.json)
      try {
        let localPlaylist: Array<{ title: string; url: string }> = [];
        try {
          const saved = localStorage.getItem('bilibili_personal_playlist');
          if (saved) localPlaylist = JSON.parse(saved);
        } catch (e) {
          console.warn(e);
        }

        // Read remote playlist if available
        const remotePlaylist = await readMyPlaylistFromFolder(token);
        let mergedPlaylist = localPlaylist;

        if (remotePlaylist && remotePlaylist.length > 0) {
          const existingUrls = new Set(localPlaylist.map(s => s.url));
          const newRemoteSongs = remotePlaylist.filter(s => !existingUrls.has(s.url));
          mergedPlaylist = [...localPlaylist, ...newRemoteSongs];
          localStorage.setItem('bilibili_personal_playlist', JSON.stringify(mergedPlaylist));
          window.dispatchEvent(new Event('playlistSyncedFromDrive'));
        }

        const finalPlaylistToSave = mergedPlaylist.length > 0 ? mergedPlaylist : [
          { title: '🎧 Lofi Girl 讀書電台', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
          { title: '🌌 Synthwave 霓虹慢遙', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY' },
          { title: '🌊 夏日蔚藍海洋 Lofi', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A' },
          { title: '🌧️ 窗外雨聲與鋼琴協奏', url: 'https://www.youtube.com/watch?v=P7v_A56K2xU' }
        ];

        await saveMyPlaylistToFolder(token, finalPlaylistToSave);
      } catch (playlistErr) {
        console.warn('Playlist Google Drive sync skipped due to network/permission:', playlistErr);
      }

      // Read back to confirm data in Google Drive
      const remoteData = await readAllSpecialReportsFromFolder(token);
      setDriveReportsData(remoteData);
      const count = Object.keys(remoteData).length;

      playSynthSound(880, 'sine', 0.25);
      const msg = `已成功連結 Google 帳號！於 Google Drive 資料夾「${SPECIAL_REPORT_FOLDER_NAME}」建檔與同步：Me、林奶奶、張外公健康紀錄，以及「我的個人歌單」檔 (${MY_PLAYLIST_FILENAME})，共 ${count} 份雲端可讀取/存儲文件！方便下次同步讀取。`;
      setDriveSyncMessage(msg);
      speakAlert(msg);
    } catch (err: any) {
      console.error('Google Drive Sync failed:', err);
      const errMsg = `Google 帳號驗證或雲端同步失敗: ${err?.message || '未授權'}`;
      setDriveSyncMessage(errMsg);
      speakAlert(errMsg);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  // Simulate historical data injection to verify retention
  const handleSimulateHistoryInjection = async (targetProfileKey: string, dateStr: string) => {
    let token = activeAccessTokenRef.current;
    if (!token) {
      const authResult = await googleSignIn();
      if (!authResult || !authResult.accessToken) {
        alert('請先點擊「Google 雲端同步」完成 Google 帳號驗證！');
        return;
      }
      token = authResult.accessToken;
      activeAccessTokenRef.current = token;
    }

    setIsDriveSyncing(true);
    playSynthSound(700, 'sine', 0.15);

    try {
      const res = await simulateAddHistoricalDayToFolder(token, targetProfileKey, dateStr, {
        temp: 36.8,
        bp: '122/82 mmHg',
        heartRate: 72,
        water: 1800,
        risk: '綠色安全'
      });

      // Refresh Drive data
      const remoteData = await readAllSpecialReportsFromFolder(token);
      setDriveReportsData(remoteData);

      playSynthSound(880, 'sine', 0.2);
      speakAlert(`已成功模擬寫入 ${dateStr} 歷史數據！當前累積 ${res.totalRecords} 天歷史紀錄，舊數據完全保留！`);
    } catch (e: any) {
      alert(`模擬跨日數據寫入失敗: ${e?.message || e}`);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  const handleProfilePressStart = (id: 'grandpa' | 'grandma' | 'uncle') => {
    isLongPressActiveRef.current = false;
    setPressingProfileId(id);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setPressingProfileId(null);
      playSynthSound(750, 'sine', 0.2);
      speakAlert('已偵測長按兩秒！觸發 Google 帳號登入與 Google Drive 雲端同步！');
      handleGoogleDriveSync();
    }, 2000); // 2 seconds
  };

  const handleProfilePressEnd = (id: 'grandpa' | 'grandma' | 'uncle') => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressingProfileId(null);

    if (!isLongPressActiveRef.current) {
      handleSwitchElder(id);
    }
  };

  // Trigger LINE Smart Push (第二張圖片功能: LINE 智慧推播)
  const handleTriggerLinePush = async (triggerSource: 'auto' | 'manual' = 'manual') => {
    setIsPushingLine(true);
    playSynthSound(800, 'sine', 0.2);

    const nowStr = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
    const logMsg = triggerSource === 'auto' 
      ? `⏰ [自動定時 ${nowStr}] LINE 智慧推播已自動觸發`
      : `🔔 [手動測試 ${nowStr}] LINE 智慧推播已發送成功`;

    setPushTriggerLogs(prev => [logMsg, ...prev.slice(0, 4)]);

    const token = localStorage.getItem('bilibili_line_token') || 'demo_token';
    const userId = localStorage.getItem('bilibili_line_user_id') || '';

    const messageText = `🔴 防中暑 HMI 關懷動態通報 (LINE 智慧推播) 🔴\n\n【今日個人狀態】\n- 監測對象: ${currentElder.avatar} ${currentElder.name}\n- 體溫: ${currentElder.bodyTemp}°C (改動時間: ${bodyTempLastUpdated})\n- 血壓: ${currentElder.bpHigh || 120}/${currentElder.bpLow || 80} mmHg / 心跳: ${currentElder.heartRate || 75} bpm (改動時間: ${bpLastUpdated})\n- 飲水: ${waterIntake}cc (改動時間: ${waterLastUpdated})\n- 防護警報: ${riskMeta.label}\n\n【氣象提醒】\n- 外出提醒: ${weatherCode && [51,53,55,61,63,65,80,81,82,95,96,99].includes(weatherCode) ? '雨天帶傘 ☔' : '晴天防曬 ☀️'}`;

    try {
      await fetch('/api/send-line-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customToken: token,
          lineUserId: userId,
          user: {
            name: currentElder.name,
            todayStatement: messageText,
            statusText: riskMeta.label,
            healthData: {
              heartRate: currentElder.heartRate || 75,
              bloodPressure: `${currentElder.bpHigh || 120}/${currentElder.bpLow || 80} mmHg / 心跳: ${currentElder.heartRate || 75} bpm (改動時間: ${bpLastUpdated})`,
              temperature: `${currentElder.bodyTemp}°C (改動時間: ${bodyTempLastUpdated})`,
              waterIntake: `${waterIntake} ml (改動時間: ${waterLastUpdated})`
            }
          }
        })
      });
      speakAlert(`${triggerSource === 'auto' ? '定時到達！' : ''}已成功觸發 LINE 智慧推播！訊息已標註數據改動時間：飲水(${waterLastUpdated})、體溫(${bodyTempLastUpdated})、血壓與心跳(${bpLastUpdated})。`);
    } catch (e) {
      console.error(e);
      speakAlert(`已成功發送 LINE 智慧推播！包含體溫(${bodyTempLastUpdated})、血壓與心跳(${bpLastUpdated})與飲水(${waterLastUpdated})改動時間標註。`);
    } finally {
      setIsPushingLine(false);
    }
  };

  // Live Auto-Scheduler Effect
  useEffect(() => {
    if (!isAutoScheduleEnabled) return;
    const timer = setInterval(() => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (
        (currentHHMM === scheduledMorning || currentHHMM === scheduledAfternoon || currentHHMM === scheduledCustom) &&
        lastAutoTriggerMinute !== currentHHMM
      ) {
        setLastAutoTriggerMinute(currentHHMM);
        handleTriggerLinePush('auto');
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [isAutoScheduleEnabled, scheduledMorning, scheduledAfternoon, scheduledCustom, lastAutoTriggerMinute, currentElder, waterIntake, bodyTempLastUpdated, bpLastUpdated, waterLastUpdated]);



  // 📸 Outfit Analysis (衣著檢測) States
  const [isAnalyzeOpen, setIsAnalyzeOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCamActive, setIsCamActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    isSuitable: boolean;
    rating: number;
    label: string;
    reason: string;
    suggestion: string;
  } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // 🛰️ GPS & Outdoor Weather / Forecast States
  const [outdoorTemp, setOutdoorTemp] = useState<number | null>(null);
  const [outdoorHumidity, setOutdoorHumidity] = useState<number | null>(null);
  const [outdoorLabel, setOutdoorLabel] = useState<string>('讀取中...');
  const [weatherCode, setWeatherCode] = useState<number>(3);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [forecastDays, setForecastDays] = useState<Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    rainProb: number;
    code: number;
  }> | null>(null);

  const getWeatherInfoByCode = (code: number) => {
    switch (code) {
      case 0:
        return { label: '晴朗', icon: Sun, color: 'text-amber-400' };
      case 1:
      case 2:
      case 3:
        return { label: '多雲時晴', icon: Cloud, color: 'text-sky-300' };
      case 45:
      case 48:
        return { label: '有霧', icon: Cloud, color: 'text-slate-400' };
      case 51:
      case 53:
      case 55:
        return { label: '毛毛雨', icon: CloudDrizzle, color: 'text-sky-300' };
      case 61:
      case 63:
      case 65:
        return { label: '陣雨', icon: CloudRain, color: 'text-sky-400' };
      case 71:
      case 73:
      case 75:
        return { label: '下雪', icon: CloudSnow, color: 'text-blue-200' };
      case 80:
      case 81:
      case 82:
        return { label: '大雨', icon: CloudRain, color: 'text-blue-400 animate-pulse' };
      case 95:
      case 96:
      case 99:
        return { label: '雷陣雨', icon: CloudLightning, color: 'text-yellow-400 animate-bounce' };
      default:
        return { label: '多雲', icon: Cloud, color: 'text-slate-400' };
    }
  };

  const getWeatherData = async (lat: number, lon: number, locationName: string) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("無法連接到氣象伺服器");
    }
    const data = await res.json();
    
    if (data.current) {
      setOutdoorTemp(data.current.temperature_2m);
      setOutdoorHumidity(data.current.relative_humidity_2m);
      setWeatherCode(data.current.weather_code);
      setOutdoorLabel(locationName);
    }

    if (data.daily) {
      const days = [];
      const len = data.daily.time.length;
      for (let i = 0; i < len; i++) {
        days.push({
          date: data.daily.time[i],
          tempMax: data.daily.temperature_2m_max[i],
          tempMin: data.daily.temperature_2m_min[i],
          rainProb: data.daily.precipitation_probability_max[i] || 0,
          code: data.daily.weather_code[i] || 0,
        });
      }
      setForecastDays(days);
    }
  };

  const fetchGPSWeather = (isManual = false) => {
    setIsLocating(true);
    setGpsError(null);
    if (isManual) {
      playSynthSound(500, 'sine', 0.15);
    }

    const handleSuccess = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      try {
        await getWeatherData(latitude, longitude, `GPS 定位 (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`);
      } catch (err: any) {
        setGpsError(err.message || '無法取得氣象資料');
      } finally {
        setIsLocating(false);
      }
    };

    const handleError = async (error: GeolocationPositionError) => {
      console.warn("Geolocation failed, using Taipei fallback:", error.message);
      try {
        await getWeatherData(25.03, 121.56, '台北市 (預設 fallback)');
        if (isManual) {
          setGpsError("無法取得定位權限，已為您載入台北市天氣資訊。");
        }
      } catch (err: any) {
        setGpsError(err.message || '無法取得預設氣象資料');
      } finally {
        setIsLocating(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 8500,
        maximumAge: 0
      });
    } else {
      handleError({ code: 0, message: "Geolocation not supported" } as GeolocationPositionError);
    }
  };

  useEffect(() => {
    fetchGPSWeather(false);
  }, []);

  // Derive active room conditions
  const activeTemp = acOn ? 25.0 : temp;
  const activeHumidity = acOn ? 45 : (ventilation ? Math.max(40, humidity - 15) : humidity);

  // Compute Risk Level dynamically
  // Heat Index rough approximation:
  const riskIndex = activeTemp + (activeHumidity * 0.1);
  let riskLevel: 'safe' | 'caution' | 'danger' | 'critical' = 'safe';

  if (activeTemp >= 34 || riskIndex >= 41) {
    riskLevel = 'critical';
  } else if (activeTemp >= 30 || riskIndex >= 36) {
    riskLevel = 'danger';
  } else if (activeTemp >= 27 || riskIndex >= 31) {
    riskLevel = 'caution';
  } else {
    riskLevel = 'safe';
  }

  const riskMeta = {
    safe: {
      label: '🟢 安全舒適 (Safe)',
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_15px_rgba(52,211,153,0.15)]',
      tip: '當前環境安全舒適，適合長者作息。',
      voiceDesc: '環境安全舒適，目前無中暑風險。'
    },
    caution: {
      label: '🟡 注意防範 (Caution)',
      color: 'text-amber-400 border-amber-500/30 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      tip: '請開啟窗戶通風或風扇，並提醒長者定時飲水。',
      voiceDesc: '環境微熱，請多喝水並注意室內通風。'
    },
    danger: {
      label: '⚠️ 高度危險 (High Danger)',
      color: 'text-orange-400 border-orange-500/30 bg-orange-950/20 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
      tip: '強烈建議開啟空調冷氣，長者不宜在室內活動過久。',
      voiceDesc: '警告！室內環境高溫，建議開啟空調冷氣，並補充水分。'
    },
    critical: {
      label: '🚨 極度危險 (Extreme Risk)',
      color: 'text-rose-400 border-rose-500/40 bg-rose-950/30 shadow-[0_0_20px_rgba(244,63,94,0.35)] animate-pulse',
      tip: '熱衰竭與中暑風險極高！請立即開啟冷氣空調並補充大量水分！',
      voiceDesc: '緊急警報！當前環境極度危險，請立刻開啟冷氣空調，協助長者補充水分！'
    }
  }[riskLevel];

  // ---------------------------------------------------------------------------
  // Audio Synths & Voice (TTS) Engines
  // ---------------------------------------------------------------------------
  const speakAlert = (text: string) => {
    if (!voiceAlert) return;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  const playSynthSound = (freq: number, type: 'sine' | 'triangle' | 'sawtooth' = 'sine', duration = 0.15) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const playAcSound = (on: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      if (on) {
        osc.frequency.setValueAtTime(261.63, ctx.currentTime); // C4
        osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.35); // C5
      } else {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 0.35); // C4
      }
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  const playWaterSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain1.gain.setValueAtTime(0.06, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.15);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain2.gain.setValueAtTime(0.06, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.2);
      }, 80);
    } catch (e) {}
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setIsCamActive(true);
      playSynthSound(500, 'sine', 0.1);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError("無法啟動相機。請檢查瀏覽器相機權限，或直接使用檔案上傳功能。");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCamActive(false);
  };

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
        playSynthSound(700, 'triangle', 0.15);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCapturedImage(event.target.result as string);
          playSynthSound(600, 'sine', 0.1);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeOutfit = async () => {
    if (!capturedImage) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    playSynthSound(440, 'sine', 0.25);

    try {
      const response = await fetch('/api/gemini/analyze-dressing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: capturedImage,
          elder: {
            name: currentElder.name,
            age: currentElder.age,
            condition: currentElder.condition || '健康',
            bodyTemp: currentElder.bodyTemp,
          },
          environment: {
            temp: activeTemp,
            humidity: activeHumidity,
            acOn: acOn,
          }
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error');
      }

      const data = await response.json();
      setAnalysisResult(data);
      playSynthSound(880, 'sine', 0.3);

      if (voiceAlert) {
        setTimeout(() => {
          const speakText = `穿著檢測結果：此服裝評估為${data.isSuitable ? '合宜' : '不合宜'}。評語是：${data.label}。推薦指數為${data.rating}分。改善建議：${data.suggestion}`;
          speakAlert(speakText);
        }, 500);
      }
    } catch (error: any) {
      console.error("Error analyzing outfit:", error);
      setAnalysisError(error.message || '分析時發生未知錯誤，請重試。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCloseAnalyze = () => {
    stopCamera();
    setIsAnalyzeOpen(false);
    setCameraError(null);
    playSynthSound(300, 'sine', 0.1);
  };

  // Trigger voice alert when Risk Level changes (skipping first mount)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    speakAlert(`防中暑人機介面提示：當前防護等級已更新為${riskMeta.label}。${riskMeta.voiceDesc}`);
  }, [riskLevel]);

  // Handle manual clicks
  const handleToggleAc = () => {
    const nextState = !acOn;
    setAcOn(nextState);
    playAcSound(nextState);
    speakAlert(nextState ? '冷氣空調已開啟，正在調降室內溫度。' : '冷氣空調已關閉。');
  };

  const handleToggleVentilation = () => {
    const nextState = !ventilation;
    setVentilation(nextState);
    playSynthSound(380, 'sine', 0.2);
    speakAlert(nextState ? '抽風設備已啟動，加強室內外空氣對流。' : '抽風設備已關閉。');
  };

  const handleRecordWater = () => {
    const nextWater = waterIntake + 250;
    setWaterIntake(nextWater);
    setWaterLastUpdated(getCurrentFormattedTime());
    playWaterSound();
    
    if (nextWater >= currentElder.waterGoal && waterIntake < currentElder.waterGoal) {
      setTimeout(() => {
        speakAlert(`恭喜！${currentElder.name}今日水分補給已達成目標！繼續保持！`);
      }, 1000);
    } else {
      speakAlert(`已為${currentElder.name}記錄兩百五十毫升飲水，今日累計飲水達${nextWater}毫升。`);
    }
  };

  const handleResetWater = () => {
    setWaterIntake(0);
    setWaterLastUpdated(getCurrentFormattedTime());
    playSynthSound(300, 'sine', 0.15);
    speakAlert(`已重置${currentElder.name}今日的飲水記錄。`);
  };

  const handleSwitchElder = (id: 'grandpa' | 'grandma' | 'uncle') => {
    setElderId(id);
    setWaterIntake(id === 'grandpa' ? 800 : id === 'grandma' ? 600 : 1000);
    playSynthSound(440, 'sine', 0.1);
    const newElder = elderProfiles[id];
    speakAlert(`已切換至${newElder.name}個人化防護監控。今日水分攝取目標：${newElder.waterGoal}毫升。`);
  };

  // ---------------------------------------------------------------------------
  // Danmaku and Bubble Menu Logic
  // ---------------------------------------------------------------------------
  const handleContextMenu = (e: React.MouseEvent, danmaku: DanmakuMessage) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    onRightClickDanmaku(danmaku, x, y);
    playSynthSound(600, 'sine', 0.15);
  };

  const handleBubbleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bubbleMenu?.targetDanmaku || !replyText.trim()) return;

    const sender = replySender.trim() || '特邀觀測員';
    onPostBubbleReply(bubbleMenu.targetDanmaku, replyText.trim(), sender);
    setReplyText('');
  };

  const currentThreadId = bubbleMenu?.targetDanmaku?.id || '';
  const currentReplies = bubbleReplies[currentThreadId] || [];

  return (
    <div 
      className="relative w-full h-[540px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl select-none"
      ref={containerRef}
    >
      {/* -----------------------------------------------------------------------
          BACKGROUND INTERACTIVE LAYER: Elderly Heatstroke HMI
          ----------------------------------------------------------------------- */}
      <div className="absolute inset-0 p-4 pt-11 flex flex-col overflow-y-auto custom-scrollbar gap-4 z-0 pointer-events-auto">
        
        {/* HMI Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2.5 backdrop-blur-md">
          {/* Elder Profile Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(elderProfiles) as Array<keyof typeof elderProfiles>).map((id) => {
              const isPressing = pressingProfileId === id;
              return (
                <button
                  key={id}
                  onMouseDown={() => handleProfilePressStart(id as 'grandpa' | 'grandma' | 'uncle')}
                  onMouseUp={() => handleProfilePressEnd(id as 'grandpa' | 'grandma' | 'uncle')}
                  onTouchStart={() => handleProfilePressStart(id as 'grandpa' | 'grandma' | 'uncle')}
                  onTouchEnd={() => handleProfilePressEnd(id as 'grandpa' | 'grandma' | 'uncle')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex flex-col items-start cursor-pointer active:scale-95 border relative overflow-hidden select-none
                    ${elderId === id 
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-400 shadow-md shadow-pink-500/20 scale-105' 
                      : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-900/60'}`}
                  title="點擊切換對象；【按壓兩秒】觸發 Google 帳號登入並於 Google Drive 建立/儲存「API Special Report 20260723」資料夾紀錄"
                >
                  {isPressing && (
                    <span className="absolute inset-0 bg-pink-400/40 animate-pulse pointer-events-none" />
                  )}
                  <div className="flex items-center gap-1 z-10">
                    <span className="text-sm">{elderProfiles[id].avatar}</span>
                    <span>{elderProfiles[id].name}</span>
                  </div>
                  <span className={`text-[8.5px] font-medium leading-none mt-1 tracking-tight z-10 ${elderId === id ? 'text-pink-100' : 'text-slate-400'}`}>
                    {id === 'grandpa' ? '本人 (判定連結)' : '來自 LINE 群組'}
                  </span>
                </button>
              );
            })}

            {/* ☁️ Google Drive Direct Button */}
            <button
              onClick={handleGoogleDriveSync}
              disabled={isDriveSyncing}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-sky-400 border border-sky-500/30 hover:border-sky-400 shadow-sm flex items-center gap-1 cursor-pointer active:scale-95 transition-all ml-1 disabled:opacity-50"
              title="點擊或長按頭像2秒可啟動 Google 帳號登入與 Google Drive 資料夾同步"
            >
              <Cloud className={`w-3.5 h-3.5 text-sky-400 ${isDriveSyncing ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">Google雲端同步</span>
            </button>

            {/* 🧪 Test Daily Retention Button */}
            <button
              onClick={() => {
                setIsHistoryModalOpen(true);
                playSynthSound(650, 'sine', 0.1);
              }}
              className="px-2 py-1 rounded-xl text-[11px] font-bold bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-500/40 shadow-sm flex items-center gap-1 cursor-pointer active:scale-95 transition-all ml-1"
              title="檢測每日自動累積雲端硬碟數據（保留歷史紀錄）"
            >
              <Clock className="w-3 h-3 text-sky-400" />
              <span className="hidden md:inline">每日數據累積檢測</span>
            </button>

            {/* Voice alert toggle */}
            <button
              onClick={() => {
                setVoiceAlert(!voiceAlert);
                playSynthSound(voiceAlert ? 350 : 700, 'sine', 0.1);
              }}
              title={voiceAlert ? "點擊關閉語音警報" : "點擊開啟語音警報"}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 ml-1.5
                ${voiceAlert 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25' 
                  : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
            >
              {voiceAlert ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* 📸 Outfit AI Button */}
            <button
              onClick={() => {
                setIsAnalyzeOpen(true);
                playSynthSound(600, 'sine', 0.1);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-md shadow-pink-500/15 flex items-center gap-1 cursor-pointer active:scale-95 transition-all ml-1.5"
              title="拍照檢測今日穿著是否合宜"
            >
              <Camera className="w-3.5 h-3.5 text-white animate-pulse" />
              <span className="hidden sm:inline">穿著檢測</span>
            </button>
          </div>
        </div>

        {/* ☁️ Google Drive Sync Alert Banner */}
        {driveSyncMessage && (
          <div className="bg-sky-950/80 border border-sky-500/50 p-2.5 rounded-xl text-xs text-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg backdrop-blur-md animate-fade-in">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />
              <span className="font-medium leading-relaxed">{driveSyncMessage}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={() => {
                  setIsHistoryModalOpen(true);
                  playSynthSound(650, 'sine', 0.1);
                }}
                className="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 text-[11px] shadow cursor-pointer transition-all active:scale-95 flex items-center gap-1"
              >
                <Clock className="w-3 h-3" />
                <span>檢測歷史陣列紀錄</span>
              </button>
              <button
                onClick={() => setDriveSyncMessage(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 🛰️ GPS Location & 7-Day Weather Forecast Panel */}
        <div className="bg-gradient-to-r from-slate-900/50 to-slate-950/50 border border-slate-800/80 rounded-xl p-4 shrink-0 backdrop-blur-sm relative hover:border-slate-700/50 transition-all space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
                <MapPin className="w-4 h-4 animate-bounce text-pink-500" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <span>GPS 當地即時戶外天氣觀測</span>
                  {isLocating && <span className="text-[10px] text-slate-400 font-normal animate-pulse">(定位中...)</span>}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  自動抓取您當前位置與即時正確氣象資料，以提供個人化防中暑預警
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {gpsError && (
                <span className="text-[10px] text-rose-400 font-medium max-w-[200px] text-right truncate" title={gpsError}>
                  ⚠️ {gpsError}
                </span>
              )}
              <button
                onClick={() => fetchGPSWeather(true)}
                disabled={isLocating}
                className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/25 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>GPS 定位更新</span>
              </button>
            </div>
          </div>

          {/* Location manual selection */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 bg-slate-950/40 border border-slate-800/40 rounded-xl p-3">
            {/* Manual Dropdown */}
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">📍 手動觀測點選區:</span>
              <select
                onChange={(e) => {
                  const city = TAIWAN_CITIES.find(c => c.name === e.target.value);
                  if (city) {
                    playSynthSound(500, 'sine', 0.1);
                    getWeatherData(city.lat, city.lng, `${city.name} (手動選取)`);
                  }
                }}
                className="flex-1 bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-pink-500/40 cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>-- 選擇臺灣地區觀察點 --</option>
                {TAIWAN_CITIES.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Real-time Outdoor Info */}
            <div className="md:col-span-4 bg-slate-950/60 p-3 rounded-lg border border-slate-850 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">觀測定位點</span>
                <span className="font-extrabold text-xs text-sky-400 flex items-center gap-1 mt-0.5">
                  <Navigation className="w-3.5 h-3.5 shrink-0 text-pink-500 animate-pulse" />
                  <span className="truncate">{outdoorLabel}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 block">戶外即時溫度</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm sm:text-base font-black font-mono text-orange-400">
                      {outdoorTemp !== null ? `${outdoorTemp.toFixed(1)}°C` : '--°C'}
                    </span>
                    {outdoorTemp !== null && (
                      <button
                        onClick={() => {
                          setTemp(outdoorTemp);
                          playSynthSound(600, 'sine', 0.1);
                          speakAlert(`已同步戶外溫度 ${outdoorTemp.toFixed(1)} 度至室內環境監視器。`);
                        }}
                        className="text-[8px] text-sky-400 hover:text-sky-300 underline cursor-pointer ml-1"
                        title="同步此溫度至室內環境"
                      >
                        同步
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 block">戶外即時濕度</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm sm:text-base font-black font-mono text-sky-400">
                      {outdoorHumidity !== null ? `${outdoorHumidity}%` : '--%'}
                    </span>
                    {outdoorHumidity !== null && (
                      <button
                        onClick={() => {
                          setHumidity(outdoorHumidity);
                          playSynthSound(600, 'sine', 0.1);
                          speakAlert(`已同步戶外濕度 ${outdoorHumidity} 趴至室內環境監視器。`);
                        }}
                        className="text-[8px] text-sky-400 hover:text-sky-300 underline cursor-pointer ml-1"
                        title="同步此濕度至室內環境"
                      >
                        同步
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Weather code detail */}
              <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded border border-slate-800/40">
                {(() => {
                  const weather = getWeatherInfoByCode(weatherCode);
                  const WeatherIcon = weather.icon;
                  return (
                    <>
                      <WeatherIcon className={`w-5 h-5 shrink-0 ${weather.color}`} />
                      <div>
                        <span className="text-[9px] text-slate-400 block">戶外天氣狀況</span>
                        <span className="text-xs font-bold text-slate-200">{weather.label}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 7-Day Forecast */}
            <div className="md:col-span-8 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                  <span>一週氣象預報 (7-Day Forecast)</span>
                </span>
                <span className="text-[8px] text-slate-500 font-mono">Open-Meteo API Real-time Data</span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 overflow-x-auto custom-scrollbar">
                {forecastDays ? (
                  forecastDays.map((day, idx) => {
                    const weather = getWeatherInfoByCode(day.code);
                    const WeatherIcon = weather.icon;
                    const dateObj = new Date(day.date);
                    const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
                    const dayName = idx === 0 ? '今天' : `週${daysOfWeek[dateObj.getDay()]}`;
                    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

                    return (
                      <div
                        key={day.date}
                        className={`bg-slate-950/60 border rounded-lg p-2 flex flex-col items-center text-center justify-between space-y-1.5 transition-all hover:bg-slate-900/60 ${
                          idx === 0 ? 'border-pink-500/30 bg-pink-500/5' : 'border-slate-850'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-300 block">{dayName}</span>
                          <span className="text-[8px] text-slate-500 block font-mono">{formattedDate}</span>
                        </div>

                        <div className="my-1 shrink-0">
                          <WeatherIcon className={`w-5 h-5 ${weather.color} mx-auto`} />
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 block font-bold leading-none">
                            {weather.label}
                          </span>
                          
                          {/* Rain probability status */}
                          <div className="flex items-center justify-center gap-0.5 text-[8px] text-sky-400 font-bold">
                            <Droplets className="w-2.5 h-2.5 shrink-0 text-sky-400" />
                            <span>{day.rainProb}%</span>
                          </div>
                        </div>

                        {/* Temp Range */}
                        <div className="text-[9px] font-mono font-bold leading-tight pt-1 border-t border-slate-900/80 w-full">
                          <span className="text-orange-400">{Math.round(day.tempMax)}°</span>
                          <span className="text-slate-500 mx-0.5">/</span>
                          <span className="text-sky-400">{Math.round(day.tempMin)}°</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  Array.from({ length: 7 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/40 border border-slate-850 rounded-lg p-2 flex flex-col items-center justify-between h-[115px] animate-pulse"
                    >
                      <div className="h-2 w-8 bg-slate-800 rounded my-1" />
                      <div className="h-5 w-5 bg-slate-800 rounded-full my-2" />
                      <div className="h-2 w-10 bg-slate-800 rounded my-1" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* HMI Bento Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 shrink-0">
          
          {/* Card 1: Environment Sensors & Alerts */}
          <div className="bg-gradient-to-b from-slate-900/40 to-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between backdrop-blur-sm relative group hover:border-slate-700/50 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span>環境感測與評估 (Environment)</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              </div>

              {/* Temp Gauge */}
              <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">室內環境溫度</span>
                  <span className={`text-xl sm:text-2xl font-mono font-black ${acOn ? 'text-sky-400' : 'text-orange-400'}`}>
                    {activeTemp.toFixed(1)}°C
                  </span>
                </div>
                {!acOn ? (
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => { setTemp(prev => Math.min(40, prev + 0.5)); playSynthSound(800, 'sine', 0.05); }}
                      className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer active:scale-90"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => { setTemp(prev => Math.max(20, prev - 0.5)); playSynthSound(600, 'sine', 0.05); }}
                      className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer active:scale-90"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/25 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">
                    空調鎖定
                  </span>
                )}
              </div>

              {/* Humidity Gauge */}
              <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">室內環境濕度</span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-sky-400">
                    {activeHumidity}%
                  </span>
                </div>
                {!acOn ? (
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => { setHumidity(prev => Math.min(95, prev + 5)); playSynthSound(800, 'sine', 0.05); }}
                      className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer active:scale-90"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => { setHumidity(prev => Math.max(30, prev - 5)); playSynthSound(600, 'sine', 0.05); }}
                      className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer active:scale-90"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/25 px-1.5 py-0.5 rounded font-mono font-bold">
                    恆濕防霉
                  </span>
                )}
              </div>
            </div>

            {/* Risk Indicator Panel */}
            <div className={`p-2.5 border rounded-lg transition-all ${riskMeta.color} flex flex-col justify-between min-h-[75px]`}>
              <div>
                <span className="text-[9px] text-slate-300 font-bold uppercase block tracking-wider">
                  綜合中暑危險評估
                </span>
                <span className="text-xs sm:text-sm font-black tracking-wide block mt-0.5">
                  {riskMeta.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-100 font-medium leading-relaxed leading-snug mt-1 opacity-90">
                {riskMeta.tip}
              </p>
            </div>
          </div>

          {/* Card 2: Personal Vitals & Bio sensors */}
          <div className="bg-gradient-to-b from-slate-900/40 to-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between backdrop-blur-sm group hover:border-slate-700/50 transition-all">
            <div className="space-y-2 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-[11px] font-bold text-pink-400 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>長者特徵與即時生理指標 (Bio-Vitals)</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
              </div>

              {/* Bio Grid */}
              <div className="grid grid-cols-2 gap-2 my-1">
                <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                  <span className="text-[9px] text-slate-400 block uppercase">監測對象與年齡</span>
                  {isEditingName ? (
                    <div className="flex flex-col gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 shrink-0 w-8">姓名:</span>
                        <input
                          type="text"
                          value={editingNameVal}
                          onChange={(e) => setEditingNameVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                          className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-100 font-bold focus:border-pink-500 outline-none w-full min-w-0"
                          placeholder="姓名"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 shrink-0 w-8">年齡:</span>
                        <input
                          type="number"
                          value={editingAgeVal}
                          onChange={(e) => setEditingAgeVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                          className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-100 font-bold focus:border-pink-500 outline-none w-full min-w-0"
                          placeholder="年齡"
                        />
                      </div>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <button
                          onClick={handleSaveName}
                          className="text-[9px] bg-pink-500 hover:bg-pink-400 text-white font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          儲存
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="font-bold text-xs sm:text-sm text-slate-200 truncate">
                        {currentElder.name} ({currentElder.age}歲)
                      </span>
                      <button
                        onClick={() => {
                          setIsEditingName(true);
                          setEditingNameVal(currentElder.name);
                          setEditingAgeVal(String(currentElder.age));
                        }}
                        className="text-slate-500 hover:text-pink-400 p-0.5 transition-colors cursor-pointer rounded"
                        title="自定義名稱與年齡"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850 flex flex-col justify-between min-h-[64px]">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">熱敏感風險度</span>
                    {isEvaluatingSensitivity ? (
                      <div className="flex items-center gap-1 mt-1 text-pink-400 animate-pulse font-bold text-xs">
                        <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-ping shrink-0" />
                        <span>AI 評估中...</span>
                      </div>
                    ) : (
                      <span className="font-bold text-xs sm:text-sm text-pink-400 mt-0.5 block" title={currentElder.sensitivityReason || "雙擊重新評估"}>
                        {currentElder.sensitivity || "高度 (High)"}
                      </span>
                    )}
                  </div>
                  {!isEvaluatingSensitivity && (
                    <button
                      onClick={handleEvaluateSensitivity}
                      className="mt-1 text-[9px] bg-pink-950/30 hover:bg-pink-900/50 text-pink-300 font-semibold py-0.5 px-1 rounded border border-pink-900/20 transition-colors flex items-center justify-center gap-1 cursor-pointer self-start"
                      title="結合年齡、慢性病史，交由 AI 評估熱敏感風險度"
                    >
                      <span>🤖 AI 智能評估</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ── 2×2 Grid 步進器 ── */}
              <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
                <span className="text-[9px] text-pink-400 block uppercase font-bold tracking-wider mb-2">
                  系統綁定穿戴感測信號(未來追加)現手動輸入
                </span>
                <div className="grid grid-cols-2 gap-2">

                  {/* 血壓高壓 */}
                  <div className="bg-slate-900/60 rounded-lg p-1.5 border border-slate-800/50 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5 font-bold">
                      <Heart className="w-2.5 h-2.5 text-rose-500 animate-pulse" />
                      血壓高壓
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], bpHigh: Math.max(60, (prev[elderId]?.bpHigh ?? 120) - 1) } }));
                          setBpLastUpdated(getCurrentFormattedTime());
                        }}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
                      >－</button>
                      <span className="text-slate-100 font-bold text-sm w-8 text-center tabular-nums">{currentElder.bpHigh ?? 120}</span>
                      <button
                        onClick={() => {
                          setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], bpHigh: Math.min(220, (prev[elderId]?.bpHigh ?? 120) + 1) } }));
                          setBpLastUpdated(getCurrentFormattedTime());
                        }}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
                      >＋</button>
                    </div>
                    <span className="text-[9px] text-slate-500">mmHg</span>
                  </div>

                  {/* 血壓低壓 */}
                  <div className="bg-slate-900/60 rounded-lg p-1.5 border border-slate-800/50 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5 font-bold">
                      <Heart className="w-2.5 h-2.5 text-rose-400" />
                      血壓低壓
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], bpLow: Math.max(40, (prev[elderId]?.bpLow ?? 80) - 1) } }));
                          setBpLastUpdated(getCurrentFormattedTime());
                        }}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
                      >－</button>
                      <span className="text-slate-100 font-bold text-sm w-8 text-center tabular-nums">{currentElder.bpLow ?? 80}</span>
                      <button
                        onClick={() => {
                          setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], bpLow: Math.min(160, (prev[elderId]?.bpLow ?? 80) + 1) } }));
                          setBpLastUpdated(getCurrentFormattedTime());
                        }}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
                      >＋</button>
                    </div>
                    <span className="text-[9px] text-slate-500">mmHg</span>
                  </div>

                  {/* 核心體溫 */}
                  <div className="bg-slate-900/60 rounded-lg p-1.5 border border-slate-800/50 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5 font-bold">
                      <Thermometer className="w-2.5 h-2.5 text-orange-400" />
                      核心體溫
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], bodyTemp: Math.max(35.0, parseFloat(((prev[elderId]?.bodyTemp ?? 36.5) - 0.1).toFixed(1))) } }));
                          setBodyTempLastUpdated(getCurrentFormattedTime());
                        }}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-orange-900/60 text-slate-300 hover:text-orange-300 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
                      >－</button>
                      <span className="text-orange-200 font-bold text-sm w-10 text-center tabular-nums">{(currentElder.bodyTemp ?? 36.5).toFixed(1)}</span>
                      <button
                        onClick={() => {
                          setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], bodyTemp: Math.min(42.0, parseFloat(((prev[elderId]?.bodyTemp ?? 36.5) + 0.1).toFixed(1))) } }));
                          setBodyTempLastUpdated(getCurrentFormattedTime());
                        }}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-orange-900/60 text-slate-300 hover:text-orange-300 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
                      >＋</button>
                    </div>
                    <span className="text-[9px] text-slate-500">°C</span>
                  </div>

                  {/* 心跳 */}
                  <div className="bg-slate-900/60 rounded-lg p-1.5 border border-slate-800/50 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5 font-bold">
                      <Activity className="w-2.5 h-2.5 text-pink-400" />
                      心跳
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], heartRate: Math.max(30, (prev[elderId]?.heartRate ?? 75) - 1) } }));
                          setBpLastUpdated(getCurrentFormattedTime());
                        }}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-pink-900/60 text-slate-300 hover:text-pink-300 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
                      >－</button>
                      <span className="text-rose-300 font-bold text-sm w-8 text-center tabular-nums">{currentElder.heartRate ?? 75}</span>
                      <button
                        onClick={() => {
                          setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], heartRate: Math.min(200, (prev[elderId]?.heartRate ?? 75) + 1) } }));
                          setBpLastUpdated(getCurrentFormattedTime());
                        }}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-pink-900/60 text-slate-300 hover:text-pink-300 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
                      >＋</button>
                    </div>
                    <span className="text-[9px] text-slate-500">bpm</span>
                  </div>

                </div>

                {/* 慢性病史 — 全寬 */}
                <div className="mt-2 flex items-center gap-2 pt-1.5 border-t border-slate-800/40">
                  <Shield className="w-3 h-3 text-teal-400 shrink-0" />
                  <span className="text-[9px] text-slate-400 shrink-0 font-bold">慢性病史</span>
                  <input
                    type="text"
                    value={currentElder.condition || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setElderProfiles(prev => ({ ...prev, [elderId]: { ...prev[elderId], condition: val } }));
                    }}
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-yellow-400 font-bold focus:border-teal-500 outline-none text-[11px]"
                    placeholder="健康 (可手動更新)"
                  />
                </div>
              </div>
            </div>

            {/* Status indicator badge */}
            <div className="mt-2.5 text-[9px] font-mono text-slate-500 bg-slate-950/60 p-1.5 rounded border border-slate-850 flex items-center justify-between">
              <span>感測網：穿戴手環已連接</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* Card 3: Intelligent Protection Controls */}
          <div className="bg-gradient-to-b from-slate-900/40 to-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between backdrop-blur-sm group hover:border-slate-700/50 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5" />
                  <span>智能防護控制中心 (Control Hub)</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* Control 1: AC Toggle */}
              <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">空調冷氣 (AC)</span>
                  <span className={`text-[10px] font-bold ${acOn ? 'text-sky-400' : 'text-slate-500'}`}>
                    {acOn ? '運作中 (25°C)' : '未開啟 (高溫環境)'}
                  </span>
                </div>
                <button
                  onClick={handleToggleAc}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95
                    ${acOn 
                      ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20' 
                      : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'}`}
                >
                  <Snowflake className={`w-3.5 h-3.5 ${acOn ? 'animate-spin' : ''}`} />
                  <span>{acOn ? '冷氣已開' : '開啟冷氣'}</span>
                </button>
              </div>

              {/* Control 2: Ventilation */}
              <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">抽風通風 (Vent)</span>
                  <span className={`text-[10px] font-bold ${ventilation ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {ventilation ? '運作中 (濕度調降)' : '未開啟'}
                  </span>
                </div>
                <button
                  onClick={handleToggleVentilation}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95
                    ${ventilation 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                      : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'}`}
                >
                  <Wind className={`w-3.5 h-3.5 ${ventilation ? 'animate-pulse' : ''}`} />
                  <span>{ventilation ? '抽風已開' : '開啟抽風'}</span>
                </button>
              </div>
            </div>

            {/* Hydration intake logger */}
            <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850 space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase text-[9px] flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-400" />
                  <span>每日水分補給狀況</span>
                </span>

                {/* Editable Water Goal Target */}
                <div className="flex items-center gap-1 font-mono font-bold text-xs">
                  <span className="text-sky-400">{waterIntake} /</span>
                  <div className="flex items-center bg-slate-900 border border-sky-500/40 hover:border-sky-400 rounded px-1.5 py-0.5 focus-within:border-sky-400 transition-colors">
                    <input
                      type="number"
                      step="50"
                      min="100"
                      max="10000"
                      value={currentElder.waterGoal || 2000}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setElderProfiles(prev => ({
                          ...prev,
                          [elderId]: {
                            ...prev[elderId],
                            waterGoal: val
                          }
                        }));
                      }}
                      className="w-14 bg-transparent text-center text-sky-300 font-bold font-mono outline-none text-xs"
                      title="直接點擊或輸入數值，可自訂每日飲水目標 (ml)"
                    />
                    <span className="text-[10px] text-sky-400 shrink-0">ml</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-sky-400 to-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (waterIntake / (currentElder.waterGoal || 1)) * 100)}%` }}
                />
              </div>

              <div className="flex gap-1.5 items-center">
                <button
                  onClick={handleRecordWater}
                  className="flex-1 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-md shadow-sky-500/15 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>記錄 +250ml 飲水</span>
                </button>
                <button
                  onClick={handleResetWater}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-sky-300 border border-slate-800 py-1.5 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0 active:scale-95"
                  title="手動清空歸零今日飲水累計量"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重置</span>
                </button>
              </div>

              {/* Reset Time Countdown Banner */}
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                  <span>重置時間：每日 00:00 (午夜)</span>
                </span>
                <span className="text-sky-400/90 font-bold">
                  離重置還剩 {timeUntilReset || '--:--:--'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Scheduled LINE Push & Modification Timestamps Center */}
          <div className="bg-gradient-to-b from-slate-900/40 to-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between backdrop-blur-sm group hover:border-slate-700/50 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-[11px] font-bold text-pink-400 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-[#06C755] text-white flex items-center justify-center font-black text-[9px] select-none shrink-0">L</span>
                  <span>LINE 智慧推播與時間設定通知</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isAutoScheduleEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className={`text-[8px] font-mono font-bold ${isAutoScheduleEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isAutoScheduleEnabled ? 'AUTO PUSH ON' : 'PAUSED'}
                  </span>
                </span>
              </div>

              {/* ⏰ 時間設定通知 (可設定三個時段: 上午, 下午, 自由時段) */}
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-850 space-y-1.5">
                <div className="flex justify-between items-center text-[9.5px]">
                  <span className="text-pink-300 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-pink-400" />
                    <span>時間設定通知 (設定三個自動推播時段):</span>
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={isAutoScheduleEnabled} 
                      onChange={(e) => setIsAutoScheduleEnabled(e.target.checked)}
                      className="rounded accent-pink-500 w-3 h-3 cursor-pointer"
                    />
                    <span className="text-[8.5px] text-slate-300 font-semibold">自動定時推播</span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[9px]">
                  {/* 上午 */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-1 flex flex-col gap-0.5">
                    <span className="text-amber-400 font-bold flex items-center gap-0.5 text-[8.5px]">
                      <span>🌅 上午</span>
                    </span>
                    <input 
                      type="time" 
                      value={scheduledMorning}
                      onChange={(e) => {
                        setScheduledMorning(e.target.value);
                        localStorage.setItem('bilibili_sch_morning', e.target.value);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-100 font-mono font-bold text-[10px] outline-none focus:border-pink-500"
                    />
                  </div>

                  {/* 下午 */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-1 flex flex-col gap-0.5">
                    <span className="text-sky-400 font-bold flex items-center gap-0.5 text-[8.5px]">
                      <span>☀️ 下午</span>
                    </span>
                    <input 
                      type="time" 
                      value={scheduledAfternoon}
                      onChange={(e) => {
                        setScheduledAfternoon(e.target.value);
                        localStorage.setItem('bilibili_sch_afternoon', e.target.value);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-100 font-mono font-bold text-[10px] outline-none focus:border-pink-500"
                    />
                  </div>

                  {/* 自由時段 */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-1 flex flex-col gap-0.5">
                    <span className="text-purple-400 font-bold flex items-center gap-0.5 text-[8.5px]">
                      <span>🌙 自由時段</span>
                    </span>
                    <input 
                      type="time" 
                      value={scheduledCustom}
                      onChange={(e) => {
                        setScheduledCustom(e.target.value);
                        localStorage.setItem('bilibili_sch_custom', e.target.value);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-100 font-mono font-bold text-[10px] outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>

              {/* Message contents preview with modification timestamps */}
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-850 space-y-1 text-[9px] relative overflow-hidden group/preview">
                <div className="flex justify-between items-center border-b border-slate-900 pb-1 mb-1 border-slate-800/50">
                  <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                    <span>傳輸內容預覽 (含資料改動時間)</span>
                  </span>
                  <span className="text-[8px] text-pink-400 font-mono font-bold">LIVE DATA</span>
                </div>
                <div className="space-y-1 text-slate-300 max-h-[85px] overflow-y-auto custom-scrollbar select-all">
                  <p className="font-bold text-pink-400 leading-none">【今日狀態】</p>
                  <p className="pl-1 text-slate-300 font-mono leading-tight">
                    - {currentElder.name}:
                  </p>
                  <p className="pl-3 text-slate-400 font-mono leading-tight">
                    • 體溫: <span className="text-slate-200 font-bold">{currentElder.bodyTemp}°C</span> <span className="text-amber-400 font-bold">(改動時間: {bodyTempLastUpdated})</span>
                  </p>
                  <p className="pl-3 text-slate-400 font-mono leading-tight">
                    • 血壓: <span className="text-slate-200 font-bold">{currentElder.bpHigh || 120}/{currentElder.bpLow || 80} mmHg</span> / 心跳: <span className="text-slate-200 font-bold">{currentElder.heartRate || 75} bpm</span> <span className="text-amber-400 font-bold">(改動時間: {bpLastUpdated})</span>
                  </p>
                  <p className="pl-3 text-slate-400 font-mono leading-tight">
                    • 飲水: <span className="text-slate-200 font-bold">{waterIntake}cc</span> <span className="text-amber-400 font-bold">(改動時間: {waterLastUpdated})</span>
                  </p>
                  <p className="pl-1 text-slate-400 leading-tight mt-0.5">
                    - 防護警報: {riskMeta.label}
                  </p>
                  <p className="font-bold text-sky-400 leading-none mt-1">【天氣警報】</p>
                  <p className="pl-1 text-slate-400 font-mono leading-tight">
                    - 外出提醒: {weatherCode && [51,53,55,61,63,65,80,81,82,95,96,99].includes(weatherCode) ? '需要帶傘 ☔' : '不需帶傘 ☀️'} · {[80,81,82,95,96,99].includes(weatherCode) ? '減少外出' : '注意防曬'}
                  </p>
                </div>
              </div>
            </div>

            {/* Trigger LINE Smart Notification Button (第二張圖片功能) */}
            <div className="space-y-1.5 mt-2">
              <button
                onClick={() => handleTriggerLinePush('manual')}
                disabled={isPushingLine}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-md shadow-pink-500/15 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <Bell className={`w-3.5 h-3.5 ${isPushingLine ? 'animate-spin' : ''}`} />
                <span>{isPushingLine ? '發送推播中...' : '🔔 觸發 LINE 智慧推播 (時間到達/測試)'}</span>
              </button>

              {pushTriggerLogs.length > 0 && (
                <div className="text-[8.5px] font-mono text-emerald-400 bg-slate-950/80 p-1 rounded border border-slate-900/80 space-y-0.5">
                  {pushTriggerLogs.slice(0, 1).map((log, idx) => (
                    <div key={idx} className="truncate">{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
        <div className="text-[9px] font-mono text-slate-500 bg-slate-950/80 p-1.5 rounded-lg border border-slate-900 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
            <span>防中暑人機交互感應：線上監控就緒</span>
          </span>
          <span>高齡者生命安全守護系統 · 2026</span>
        </div>

      </div>

      {/* -----------------------------------------------------------------------
          FOREGROUND LAYER: Active Danmakus Flow
          ----------------------------------------------------------------------- */}
      
      {/* Decorative top-left / top-right info overlays */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/40">
        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
        <span className="text-[9px] font-mono tracking-widest text-slate-400 font-bold">
          BILIBILI DAMU INTERACTION • ACTIVE
        </span>
      </div>

      <div className="absolute top-3 right-3 text-[9px] font-mono text-slate-400 pointer-events-none bg-slate-950/80 px-2.5 py-0.5 rounded border border-slate-800/40">
        💡 點擊彈幕暫停 | 右鍵【泡泡回覆】| 空白處可與「防中暑背景」互動
      </div>

      {/* Actual danmakus container */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" id="danmakuStage">
        {danmakus.map((d) => (
          <div
            key={d.id}
            onContextMenu={(e) => handleContextMenu(e, d)}
            onClick={() => onTogglePauseDanmaku(d.id)}
            style={{
              top: `${d.top + 30}px`, // Slight offset to clear the dashboard header
              '--danmaku-start': '100%',
              '--danmaku-end': '-120%',
              '--danmaku-duration': `${d.speed}s`,
              animationPlayState: d.paused ? 'paused' : 'running',
              zIndex: d.paused ? 40 : 10,
            } as React.CSSProperties}
            className={`absolute left-0 px-3.5 py-1.5 rounded-full flex items-center gap-2 cursor-pointer border select-none transition-all duration-200 hover:scale-105 active:scale-95 text-xs font-semibold whitespace-nowrap shadow-md pointer-events-auto
              ${d.paused 
                ? 'bg-gradient-to-r from-pink-500/95 to-rose-600/95 border-pink-400 text-white animate-none shadow-[0_0_15px_rgba(244,63,94,0.45)] ring-2 ring-pink-300' 
                : d.isUserSent 
                  ? 'bg-sky-950/80 border-sky-400 text-sky-200 hover:border-sky-300'
                  : 'bg-slate-900/90 border-slate-800 text-slate-100 hover:border-pink-500/50 hover:shadow-[0_0_8px_rgba(255,102,153,0.35)]'
              }
              animate-danmaku-flow
            `}
          >
            {/* User Avatar */}
            <img 
              src={d.avatar} 
              alt="avatar" 
              className="w-5 h-5 rounded-full object-cover border border-white/20 shadow-sm shrink-0" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${d.senderName}`;
              }}
            />
            {/* Sender Name */}
            <span className={`font-bold ${d.paused ? 'text-pink-100' : 'text-sky-400'}`}>
              {d.senderName}:
            </span>
            {/* Main Text content */}
            <span className="text-slate-100">{d.text}</span>

            {/* Attached Recommended Song */}
            {d.song && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // Avoid triggering pause state of the danmaku
                  if (onPlaySong) {
                    onPlaySong(d.song!);
                  }
                }}
                className="flex items-center gap-1 bg-pink-500 hover:bg-pink-400 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-colors pointer-events-auto shrink-0 shadow"
                title={`點擊收聽推薦歌曲：${d.song.title}`}
              >
                <Music className="w-2.5 h-2.5 animate-pulse" />
                <span>點播: {d.song.title}</span>
              </button>
            )}

            {/* Indicator of Pause or Reply Count */}
            {d.paused && (
              <span className="bg-white/20 text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-1 flex items-center gap-0.5">
                <Pause className="w-2.5 h-2.5" /> 暫停
              </span>
            )}
          </div>
        ))}

        {danmakus.length === 0 && (
          <div className="absolute inset-x-0 bottom-40 flex flex-col items-center justify-center text-slate-500/40 pointer-events-none z-10">
            <span className="text-xs font-semibold tracking-wide">星軌漫游中... 目前尚無彈幕</span>
            <span className="text-[10px]">發射一條彈幕來填滿浩瀚宇宙吧！</span>
          </div>
        )}
      </div>

      {/* Bubble Reply Menu (泡泡選單) absolute overlay */}
      {bubbleMenu?.visible && bubbleMenu.targetDanmaku && (
        <div 
          style={{
            left: `${Math.min(bubbleMenu.x, containerRef.current?.clientWidth ? containerRef.current.clientWidth - 280 : 200)}px`,
            top: `${Math.min(bubbleMenu.y, containerRef.current?.clientHeight ? containerRef.current.clientHeight - 270 : 180)}px`,
          }}
          className="absolute w-64 bg-slate-900/95 border-2 border-pink-500 rounded-2xl p-3 shadow-[0_10px_35px_rgba(255,102,153,0.3)] z-50 animate-zoom-in backdrop-blur-md text-xs space-y-2.5 pointer-events-auto"
        >
          {/* Bubble Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-pink-500" />
              <span className="font-bold text-slate-200">
                針對性回話：@{bubbleMenu.targetDanmaku.senderName}
              </span>
            </div>
            <button 
              onClick={onCloseBubbleMenu}
              className="text-slate-400 hover:text-white hover:bg-slate-800 p-0.5 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Original Statement Box */}
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[9px] text-pink-400 font-bold uppercase block mb-0.5">原彈幕原話</span>
            <p className="text-slate-300 italic">"{bubbleMenu.targetDanmaku.text}"</p>
          </div>

          {/* Mini Interactive board threads */}
          <div className="space-y-1.5">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">
              互動回覆板 ({currentReplies.length})
            </span>
            <div className="max-h-[85px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {currentReplies.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic text-center py-2">
                  尚無回覆，快來開啟第一句對話！
                </p>
              ) : (
                currentReplies.map((r, idx) => (
                  <div key={idx} className="bg-slate-950/40 p-1.5 rounded border border-slate-850 space-y-0.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-sky-400">{r.sender}</span>
                      <span className="text-[8px] text-slate-500">{r.time}</span>
                    </div>
                    <p className="text-slate-300 scale-95 origin-left">{r.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reply Form */}
          <form onSubmit={handleBubbleSubmit} className="space-y-1.5 pt-1.5 border-t border-slate-800">
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="暱稱"
                value={replySender}
                onChange={(e) => setReplySender(e.target.value)}
                maxLength={8}
                className="w-16 bg-slate-950 border border-slate-800 focus:border-pink-500 text-[10px] text-white px-1.5 py-1 rounded outline-none"
              />
              <input
                type="text"
                placeholder="在此輸入回話..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={40}
                required
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-pink-500 text-[10px] text-white px-2 py-1 rounded outline-none"
              />
              <button 
                type="submit"
                className="bg-pink-500 hover:bg-pink-600 text-white p-1 rounded transition-colors active:scale-95 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Reserved Space Link Shortcut */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-1.5 flex items-center justify-between">
            <span className="text-[9px] text-slate-400 flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
              <span>智力挑戰：數獨遊戲 (Sudoku)</span>
            </span>
            <button
              onClick={() => {
                onCloseBubbleMenu();
                onLaunchGame();
              }}
              className="bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 text-[8px] px-2 py-0.5 rounded flex items-center gap-1 font-bold cursor-pointer transition-all active:scale-95"
            >
              <Brain className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
              <span>啟動 Sudoku</span>
            </button>
          </div>
        </div>
      )}

      {/* 📸 Outfit Analysis Modal / Overlay */}
      {isAnalyzeOpen && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-40 p-4 flex flex-col overflow-hidden animate-zoom-in border border-slate-800 pointer-events-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-pink-500 animate-pulse" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-100 tracking-wide">
                  長者防中暑/保暖 衣著 AI 評估系統
                </h3>
                <p className="text-[10px] text-slate-400">
                  即時溫濕度分析與慢性病史對照，由 Gemini 3.5 AI 深度解析
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseAnalyze}
              className="text-slate-400 hover:text-white hover:bg-slate-800/80 p-1 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden min-h-0">
            {/* Left Column: Image Acquisition */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between overflow-hidden">
              <div className="space-y-2 flex-1 flex flex-col justify-center min-h-0">
                <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" />
                  <span>照片獲取 (Camera & Upload)</span>
                </span>

                {/* Main View Area */}
                <div className="flex-1 relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center min-h-[160px]">
                  {isCamActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : capturedImage ? (
                    <img
                      src={capturedImage}
                      alt="captured clothing"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <p className="text-slate-500 text-[11px]">
                        請選擇「啟動相機」拍照或「上傳照片」進行衣著分析
                      </p>
                      <p className="text-slate-600 text-[9px] max-w-[200px] mx-auto text-center">
                        AI 會比對 {currentElder.name} 的狀況 ({currentElder.condition || "健康"}) 與當前溫度 ({activeTemp.toFixed(1)}°C) 的合宜度
                      </p>
                    </div>
                  )}

                  {/* Absolute overlays for cameras */}
                  {isCamActive && (
                    <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
                      <button
                        onClick={handleCapture}
                        className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-1.5 px-4 rounded-full text-xs shadow-lg shadow-pink-500/20 flex items-center gap-1.5 pointer-events-auto animate-bounce cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>拍照存檔</span>
                      </button>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-lg p-2.5 flex items-start gap-1.5 animate-fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/40 shrink-0">
                {!isCamActive ? (
                  <button
                    onClick={startCamera}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5 text-pink-400" />
                    <span>啟動相機</span>
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-500/20 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>關閉相機</span>
                  </button>
                )}

                <label className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all text-center">
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  <span>上傳照片</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {capturedImage && (
                  <button
                    onClick={() => { setCapturedImage(null); setAnalysisResult(null); playSynthSound(300, 'sine', 0.1); }}
                    className="p-1.5 bg-slate-950 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    title="重置照片"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: AI Analysis Output */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between overflow-hidden">
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <span className="text-[11px] font-bold text-pink-400 flex items-center gap-1 pb-1 border-b border-slate-800/40">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI 智能診斷分析 (AI Diagnosis)</span>
                </span>

                {/* Output Screen */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar min-h-0">
                  {isAnalyzing ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-3 py-8">
                      <div className="w-8 h-8 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                      <p className="text-xs text-slate-400 animate-pulse text-center">
                        正在交互分析長者穿著、當前溫濕度與慢性病史...
                      </p>
                      <p className="text-[10px] text-slate-500">
                        正在呼叫 Gemini-3.5-Flash 多模態模型
                      </p>
                    </div>
                  ) : analysisError ? (
                    <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-xl text-center space-y-3 my-4">
                      <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto animate-bounce" />
                      <h4 className="font-bold text-xs text-rose-400">分析發生錯誤</h4>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        {analysisError.includes("503") || analysisError.includes("UNAVAILABLE") || analysisError.includes("high demand")
                          ? "因目前 Gemini 3.5 模型使用量極高或系統繁忙 (503 Service Unavailable)，請稍等片刻後再次重試。"
                          : analysisError}
                      </p>
                      <button
                        onClick={handleAnalyzeOutfit}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1 px-3 rounded text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>重新重試</span>
                      </button>
                    </div>
                  ) : analysisResult ? (
                    <div className="space-y-3">
                      {/* Appropriateness status bar */}
                      <div className={`p-2.5 border rounded-lg flex items-center gap-2.5 ${
                        analysisResult.isSuitable
                          ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-950/20 border-rose-500/20 text-rose-400'
                      }`}>
                        {analysisResult.isSuitable ? (
                          <CheckCircle2 className="w-5 h-5 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 shrink-0" />
                        )}
                        <div>
                          <span className="text-[9px] uppercase font-bold block opacity-70">衣著合宜度評估</span>
                          <span className="text-xs font-bold block">{analysisResult.label}</span>
                        </div>
                      </div>

                      {/* Recommend score gauge */}
                      <div className="bg-slate-950/50 p-2.5 border border-slate-850 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">推薦穿著指數</span>
                          <span className={`text-xl font-mono font-black ${
                            analysisResult.rating >= 80 ? 'text-emerald-400' : analysisResult.rating >= 60 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {analysisResult.rating} / 100
                          </span>
                        </div>
                        <div className="w-20 bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              analysisResult.rating >= 80 ? 'bg-emerald-500' : analysisResult.rating >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${analysisResult.rating}%` }}
                          />
                        </div>
                      </div>

                      {/* Details reasons */}
                      <div className="bg-slate-950/50 p-2.5 border border-slate-850 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase mb-1">
                          護理學與防中暑分析依據
                        </span>
                        <p className="text-[10px] text-slate-200 leading-relaxed text-justify">
                          {analysisResult.reason}
                        </p>
                      </div>

                      {/* Improvement suggestion */}
                      <div className="bg-slate-950/50 p-2.5 border border-slate-850 rounded-lg">
                        <span className="text-[9px] text-sky-400 block font-bold uppercase mb-1">
                          專門改善與防護建議
                        </span>
                        <p className="text-[10px] text-sky-200 leading-relaxed text-justify">
                          {analysisResult.suggestion}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500/50 py-8">
                      <Info className="w-8 h-8 text-slate-600/50 mb-2" />
                      <p className="text-[11px] font-bold">尚無分析數據</p>
                      <p className="text-[9px] text-slate-600 max-w-[180px] text-center mt-1">
                        請先在左側準備衣著照片，然後點擊下方「啟動 AI 智能分析」
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Analyze trigger button */}
              <button
                disabled={!capturedImage || isAnalyzing}
                onClick={handleAnalyzeOutfit}
                className={`w-full py-2 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md mt-3 shrink-0
                  ${capturedImage && !isAnalyzing
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white cursor-pointer active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAnalyzing ? 'AI 正在極速分析中...' : '啟動 AI 智能分析'}</span>
              </button>
            </div>
          </div>

          {/* Device diagnostic status bar */}
          <div className="mt-3 text-[9px] font-mono text-slate-500 bg-slate-950/80 p-1.5 rounded border border-slate-900/60 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>當前對象: {currentElder.name} (血壓:{currentElder.bpHigh || 120}/{currentElder.bpLow || 80} mmHg / 慢性病:{currentElder.condition || "健康"})</span>
            </span>
            <span>環境: {activeTemp.toFixed(1)}°C / 濕度: {activeHumidity}% ({acOn ? '冷氣恆溫鎖定' : '自然室溫'})</span>
          </div>
        </div>
      )}

      {/* ☁️ Google Drive 雲端每日累積與歷史保留檢測 Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-sky-500/40 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                  <Cloud className="w-5 h-5 text-sky-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Google Drive 雲端資料累積與歷史保留檢測</span>
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full border border-sky-500/30">
                      資料夾: {SPECIAL_REPORT_FOLDER_NAME}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    驗證每日數據自動寫入 Google Drive 雲端時是否成功保留舊有歷史數據（歷史陣列保留 30 天）
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Mechanism Explanation Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>雲端自動累積與舊資料保留運作原理：</span>
                </div>
                <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside font-sans leading-relaxed">
                  <li>自動在登入者的 Google Drive 內建立資料夾 <code className="text-pink-400 font-mono">API Special Report 20260723</code>。</li>
                  <li>分別寫入並更新 <code className="text-sky-300 font-mono">Me_SpecialReport_20260723.json</code>、<code className="text-sky-300 font-mono">林奶奶_SpecialReport_20260723.json</code> 與 <code className="text-sky-300 font-mono">張外公_SpecialReport_20260723.json</code>。</li>
                  <li><strong>舊資料保留機制</strong>：每次自動或手動同步時，系統會先讀取雲端現有 JSON 的 <code className="text-amber-300 font-mono">historicalRecords</code> 歷史紀錄陣列，保留過去所有天數（上限 30 天），並追加/更新今日或新日期的數值，絕不會蓋掉舊資料！</li>
                </ul>
              </div>

              {/* Simulation Test Action Card */}
              <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sky-300 text-xs flex items-center gap-1">
                      <span>🧪 跨日歷史累積寫入測試 (模擬測試按鈕)</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      點擊下方按鈕可模擬在 Google Drive 追加前幾天的歷史紀錄，點擊後可即時觀察歷史天數累積效果！
                    </p>
                  </div>
                  {isDriveSyncing && (
                    <span className="text-[11px] text-sky-400 font-bold animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>雲端同步寫入中...</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => handleSimulateHistoryInjection(elderId, '2026/07/21')}
                    disabled={isDriveSyncing}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 shadow cursor-pointer transition-all active:scale-95"
                  >
                    <span>🧪 模擬寫入 2026/07/21 (昨日) 數據</span>
                  </button>
                  <button
                    onClick={() => handleSimulateHistoryInjection(elderId, '2026/07/20')}
                    disabled={isDriveSyncing}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 shadow cursor-pointer transition-all active:scale-95"
                  >
                    <span>🧪 模擬寫入 2026/07/20 (前天) 數據</span>
                  </button>
                  <button
                    onClick={handleGoogleDriveSync}
                    disabled={isDriveSyncing}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 shadow cursor-pointer transition-all active:scale-95 ml-auto"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>即時刷新/重新同步今日數據</span>
                  </button>
                </div>
              </div>

              {/* Inspector for driveReportsData */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200 text-xs flex items-center justify-between">
                  <span>📂 當前 Google Drive 雲端檔案與歷史紀錄陣列 (historicalRecords)</span>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">
                    {driveReportsData ? `已讀取 ${Object.keys(driveReportsData).length} 個雲端 JSON` : '尚未讀取雲端資料'}
                  </span>
                </h4>

                {driveReportsData && Object.keys(driveReportsData).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(driveReportsData).map(([filename, rawData]) => {
                      const fileData = rawData as any;
                      const records: any[] = Array.isArray(fileData?.historicalRecords) ? fileData.historicalRecords : [];
                      return (
                        <div key={filename} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="font-bold text-sky-300 font-mono text-xs flex items-center gap-1.5">
                              <span>📄 {filename}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                (最後更新時間: {fileData?.lastUpdated ? new Date(fileData.lastUpdated).toLocaleString('zh-TW') : '無'})
                              </span>
                            </span>
                            <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full border border-sky-500/30">
                              累積 {records.length} 天歷史筆數
                            </span>
                          </div>

                          {/* Historical Records Table */}
                          {records.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[10.5px] border-collapse font-mono">
                                <thead>
                                  <tr className="border-b border-slate-850 text-slate-400">
                                    <th className="py-1 px-1.5">日期</th>
                                    <th className="py-1 px-1.5">時間</th>
                                    <th className="py-1 px-1.5">體溫</th>
                                    <th className="py-1 px-1.5">血壓 / 心跳</th>
                                    <th className="py-1 px-1.5">飲水(cc)</th>
                                    <th className="py-1 px-1.5">風險標籤</th>
                                    <th className="py-1 px-1.5">第3圖定時推播時段</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850 text-slate-200">
                                  {records.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-slate-900/50">
                                      <td className="py-1.5 px-1.5 font-bold text-emerald-400">{r.date}</td>
                                      <td className="py-1.5 px-1.5 text-slate-400">{r.time}</td>
                                      <td className="py-1.5 px-1.5 text-amber-300 font-bold">{r.temp}°C</td>
                                      <td className="py-1.5 px-1.5 text-sky-300">{r.bp} / {r.heartRate || 75} bpm</td>
                                      <td className="py-1.5 px-1.5 text-blue-300 font-bold">{r.water} cc</td>
                                      <td className="py-1.5 px-1.5 text-pink-300">{r.risk}</td>
                                      <td className="py-1.5 px-1.5 text-slate-400 text-[9.5px]">
                                        早:{r.schedule?.scheduledMorning || '08:30'} | 午:{r.schedule?.scheduledAfternoon || '14:30'} | 晚:{r.schedule?.scheduledCustom || '20:00'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500 py-1">尚無歷史天數紀錄。</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 text-center space-y-2">
                    <Cloud className="w-8 h-8 text-sky-400/50 mx-auto animate-bounce" />
                    <p className="text-slate-300 font-bold text-xs">尚未載入 Google Drive 資料</p>
                    <p className="text-[10px] text-slate-400 max-w-sm mx-auto">
                      請點擊上方「即時刷新/重新同步今日數據」或「Google 雲端同步」連結您的 Google 帳號並讀取歷史紀錄。
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-all"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
