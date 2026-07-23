import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, HealthData } from '../types';

// Initialize Firebase App if not already done
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request explicit Google Drive scopes
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('Google 登入程序進行中，請稍候...');
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('無法從 Google 取得 Access Token');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errCode = error?.code || '';
    const errMessage = error?.message || '';

    if (
      errCode === 'auth/popup-closed-by-user' ||
      errCode === 'auth/popup-blocked' ||
      errCode === 'auth/cancelled-popup-request' ||
      errMessage.includes('popup-closed-by-user') ||
      errMessage.includes('popup-blocked') ||
      errMessage.includes('INTERNAL ASSERTION FAILED')
    ) {
      console.warn('Google 登入視窗已取消、被阻擋或重新觸發:', errCode || errMessage);
      return null;
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Backup model structure
export interface DriveBackupData {
  users: UserProfile[];
  healthDatabase: HealthData[];
  bubbleReplies: Record<string, { sender: string; text: string; time: string }[]>;
  timestamp: string;
}

// Drive Operations
const BACKUP_FILENAME = 'qi_xiang_jiang_che_backup.json';

// Find backup file in Drive
async function findBackupFile(token: string): Promise<string | null> {
  try {
    const url = `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}'+and+trashed=false&fields=files(id,name)`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`搜尋備份失敗: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (err) {
    console.error('findBackupFile error:', err);
    return null;
  }
}

// Save complete application backup to Google Drive
export const saveBackupToDrive = async (
  token: string,
  backupData: Omit<DriveBackupData, 'timestamp'>
): Promise<{ success: boolean; fileId: string; message: string }> => {
  const fullBackup: DriveBackupData = {
    ...backupData,
    timestamp: new Date().toISOString()
  };

  const fileId = await findBackupFile(token);
  const fileContent = JSON.stringify(fullBackup, null, 2);

  if (fileId) {
    // Update existing file
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!res.ok) {
      throw new Error(`更新雲端備份失敗: ${res.statusText}`);
    }

    return {
      success: true,
      fileId,
      message: '已成功更新現有的 Google Drive 雲端備份檔案！'
    };
  } else {
    // Create new file with Multipart Upload
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const metadata = {
      name: BACKUP_FILENAME,
      mimeType: 'application/json',
      description: '氣象將車：高齡防中暑與聲控象棋主控台 - 雲端備份資料'
    };

    const boundary = 'qi_xiang_boundary_3981';
    const body = 
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (!res.ok) {
      throw new Error(`新建雲端備份失敗: ${res.statusText}`);
    }

    const result = await res.json();
    return {
      success: true,
      fileId: result.id,
      message: '已成功在 Google Drive 建立全新的雲端備份檔案！'
    };
  }
};

// Restore application backup from Google Drive
export const restoreBackupFromDrive = async (
  token: string
): Promise<DriveBackupData | null> => {
  const fileId = await findBackupFile(token);
  if (!fileId) {
    return null;
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`讀取雲端備份失敗: ${res.statusText}`);
  }

  return await res.json();
};

// Export readable TXT Health Logs directly to Google Drive
export const exportHealthLogsToDrive = async (
  token: string,
  user: UserProfile,
  health: HealthData | undefined
): Promise<{ success: boolean; fileId: string; filename: string }> => {
  const dateStr = new Date().toLocaleDateString('zh-TW', { hour12: false }).replace(/\//g, '-');
  const filename = `氣象將車_健康日誌_${user.name}_${dateStr}.txt`;
  
  let report = `==================================================\n`;
  report += `   氣象將車 · 高齡者防中暑智能主控台 - 個人健康日誌   \n`;
  report += `==================================================\n\n`;
  report += `匯出時間：${new Date().toLocaleString('zh-TW')}\n`;
  report += `長者姓名：${user.name}\n`;
  report += `目前狀態：${user.statusText} (${user.status})\n`;
  report += `今日分享狀態：「${user.todayStatement}」\n\n`;
  
  report += `---------------- 關鍵生理指標數據 ----------------\n`;
  if (health) {
    report += `◆ 生理指標狀態：${health.label}\n`;
    report += `◆ 心率數據：${health.heartRate} bpm\n`;
    report += `◆ 收縮/舒張血壓：${health.bloodPressure} mmHg\n`;
    report += `◆ 昨晚睡眠時數：${health.sleepDuration} 小時\n`;
    report += `◆ 目前體溫：${health.bodyTemperature} °C\n`;
    report += `◆ 疲勞警示指數：${health.fatigueLevel}\n`;
    report += `◆ 生理抗壓力：${health.stressLevel}\n\n`;
  } else {
    report += `暫無生理感測聯網紀錄\n\n`;
  }

  report += `---------------- 親友溫馨關懷留言 ----------------\n`;
  if (user.comments && user.comments.length > 0) {
    user.comments.forEach((c, idx) => {
      report += `[#${idx + 1}] ${c.sender} (${c.time})：\n   「${c.text}」\n`;
    });
  } else {
    report += `尚無留言板留言\n`;
  }
  report += `\n==================================================\n`;
  report += `* 本日誌由「氣象將車」系統自動產生並同步備份至個人 Google Drive\n`;

  // Create new log file in Google Drive
  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const metadata = {
    name: filename,
    mimeType: 'text/plain',
    description: `氣象將車：高齡者防中暑生理日誌 - ${user.name}`
  };

  const boundary = 'qi_xiang_log_boundary_2812';
  const body = 
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${report}\r\n` +
    `--${boundary}--`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    throw new Error(`匯出日誌失敗: ${res.statusText}`);
  }

  const result = await res.json();
  return {
    success: true,
    fileId: result.id,
    filename
  };
};

// ============================================================================
// 📁 Google Drive Folder: "API Special Report 20260723" Management
// ============================================================================
export const SPECIAL_REPORT_FOLDER_NAME = 'API Special Report 20260723';

// Find or Create the "API Special Report 20260723" Folder
export async function getOrCreateSpecialReportFolder(token: string): Promise<string> {
  try {
    // 1. Search for folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(SPECIAL_REPORT_FOLDER_NAME)}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!searchRes.ok) {
      throw new Error(`搜尋資料夾失敗: ${searchRes.statusText}`);
    }
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // 2. Create folder if not found
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: SPECIAL_REPORT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        description: '氣象將車：高齡防中暑與聲控象棋 API 特殊日誌報告資料夾 (20260723)'
      })
    });

    if (!createRes.ok) {
      throw new Error(`建立 API Special Report 20260723 資料夾失敗: ${createRes.statusText}`);
    }

    const folderData = await createRes.json();
    return folderData.id;
  } catch (err) {
    console.warn('getOrCreateSpecialReportFolder warning:', err);
    throw err;
  }
}

// Find existing file inside specific folder
async function findFileInFolder(token: string, folderId: string, filename: string): Promise<string | null> {
  if (!token || !folderId) return null;
  try {
    const url = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(filename)}'+and+'${folderId}'+in+parents+and+trashed=false&fields=files(id,name)`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (err) {
    console.warn('findFileInFolder warning:', err);
    return null;
  }
}

// Save individual profile data & daily schedule stats to "API Special Report 20260723" folder
export const saveSpecialReportProfileToFolder = async (
  token: string,
  profileKey: string,
  profilePayload: {
    profile: UserProfile & { heartRate?: number; bpHigh?: number; bpLow?: number; bodyTemp?: number };
    scheduleStats: {
      scheduledMorning: string;
      scheduledAfternoon: string;
      scheduledCustom: string;
      isAutoScheduleEnabled: boolean;
    };
    vitals: {
      waterIntake: number;
      bodyTempLastUpdated: string;
      bpLastUpdated: string;
      waterLastUpdated: string;
      riskLabel: string;
    };
    historyStats?: Array<{ date: string; time: string; temp: number; bp: string; heartRate: number; water: number }>;
  }
): Promise<{ success: boolean; fileId: string; filename: string }> => {
  const folderId = await getOrCreateSpecialReportFolder(token);
  const profileName = profilePayload.profile.name || profileKey;
  const filename = `${profileName}_SpecialReport_20260723.json`;

  const todayStr = new Date().toLocaleDateString('zh-TW', { hour12: false });
  const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });

  // Read existing history if available, then append today's log entry
  const existingFileId = await findFileInFolder(token, folderId, filename);
  let historicalRecords: any[] = profilePayload.historyStats || [];

  if (existingFileId) {
    try {
      const readUrl = `https://www.googleapis.com/drive/v3/files/${existingFileId}?alt=media`;
      const readRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (readRes.ok) {
        const existingData = await readRes.json();
        if (Array.isArray(existingData.historicalRecords)) {
          historicalRecords = existingData.historicalRecords;
        }
      }
    } catch (e) {
      console.warn('Could not read existing file for historical records:', e);
    }
  }

  // Create or append current snapshot to historical records
  const newSnapshot = {
    date: todayStr,
    time: timeStr,
    temp: profilePayload.profile.bodyTemp || 36.5,
    bp: `${profilePayload.profile.bpHigh || 120}/${profilePayload.profile.bpLow || 80} mmHg`,
    heartRate: profilePayload.profile.heartRate || 75,
    water: profilePayload.vitals.waterIntake,
    risk: profilePayload.vitals.riskLabel,
    schedule: profilePayload.scheduleStats,
    timestamps: {
      tempUpdated: profilePayload.vitals.bodyTempLastUpdated,
      bpUpdated: profilePayload.vitals.bpLastUpdated,
      waterUpdated: profilePayload.vitals.waterLastUpdated
    }
  };

  // Keep last 30 daily statistics records for analytics
  historicalRecords = [newSnapshot, ...historicalRecords.filter(r => r.date !== todayStr)].slice(0, 30);

  const fullReportData = {
    folder: SPECIAL_REPORT_FOLDER_NAME,
    profileKey,
    profileName,
    lastUpdated: new Date().toISOString(),
    profileInfo: profilePayload.profile,
    dailyVitals: profilePayload.vitals,
    scheduledNoticeTimes: profilePayload.scheduleStats,
    historicalRecords
  };

  const fileContent = JSON.stringify(fullReportData, null, 2);

  if (existingFileId) {
    // Update existing file in folder
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!res.ok) {
      throw new Error(`更新 ${filename} 失敗: ${res.statusText}`);
    }

    return { success: true, fileId: existingFileId, filename };
  } else {
    // Create new file inside "API Special Report 20260723" folder
    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [folderId],
      description: `氣象將車：${profileName} 個人健康數據與定時設定日誌 (API Special Report 20260723)`
    };

    const boundary = 'report_boundary_20260723';
    const body = 
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (!res.ok) {
      throw new Error(`新增 ${filename} 失敗: ${res.statusText}`);
    }

    const result = await res.json();
    return { success: true, fileId: result.id, filename };
  }
};

// Read all special report profiles from "API Special Report 20260723" folder
export const readAllSpecialReportsFromFolder = async (
  token: string
): Promise<Record<string, any>> => {
  const folderId = await getOrCreateSpecialReportFolder(token);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name)`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  
  if (!listRes.ok) {
    throw new Error(`無法讀取資料夾檔案列表: ${listRes.statusText}`);
  }

  const listData = await listRes.json();
  const results: Record<string, any> = {};

  if (listData.files && listData.files.length > 0) {
    for (const file of listData.files) {
      try {
        const fileUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const contentRes = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (contentRes.ok) {
          const content = await contentRes.json();
          results[file.name] = content;
        }
      } catch (e) {
        console.error(`Error reading ${file.name}:`, e);
      }
    }
  }

  return results;
};

// Simulate adding a historical date log entry to test retention mechanism
export const simulateAddHistoricalDayToFolder = async (
  token: string,
  profileKey: string,
  simulatedDate: string, // e.g. "2026/07/21"
  simulatedVitals: { temp: number; bp: string; heartRate: number; water: number; risk: string }
): Promise<{ success: boolean; totalRecords: number; historicalRecords: any[] }> => {
  const folderId = await getOrCreateSpecialReportFolder(token);
  const profileName = profileKey === 'grandpa' ? 'Me' : profileKey === 'grandma' ? '林奶奶' : '張外公';
  const filename = `${profileName}_SpecialReport_20260723.json`;

  const existingFileId = await findFileInFolder(token, folderId, filename);
  let existingData: any = {};
  let historicalRecords: any[] = [];

  if (existingFileId) {
    try {
      const readUrl = `https://www.googleapis.com/drive/v3/files/${existingFileId}?alt=media`;
      const readRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (readRes.ok) {
        existingData = await readRes.json();
        if (Array.isArray(existingData.historicalRecords)) {
          historicalRecords = existingData.historicalRecords;
        }
      }
    } catch (e) {
      console.warn('Could not read file for simulated history:', e);
    }
  }

  const simulatedEntry = {
    date: simulatedDate,
    time: '12:00:00',
    temp: simulatedVitals.temp,
    bp: simulatedVitals.bp,
    heartRate: simulatedVitals.heartRate,
    water: simulatedVitals.water,
    risk: simulatedVitals.risk,
    schedule: existingData.scheduledNoticeTimes || {
      scheduledMorning: '08:30',
      scheduledAfternoon: '14:30',
      scheduledCustom: '20:00',
      isAutoScheduleEnabled: true
    },
    timestamps: {
      tempUpdated: '12:00',
      bpUpdated: '12:00',
      waterUpdated: '12:00'
    }
  };

  // Add or update simulated date entry without destroying existing entries
  historicalRecords = [simulatedEntry, ...historicalRecords.filter(r => r.date !== simulatedDate)].slice(0, 30);

  const updatedContent = {
    ...existingData,
    folder: SPECIAL_REPORT_FOLDER_NAME,
    profileKey,
    profileName,
    lastUpdated: new Date().toISOString(),
    historicalRecords
  };

  const fileContent = JSON.stringify(updatedContent, null, 2);

  if (existingFileId) {
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });
    if (!res.ok) throw new Error(`更新失敗: ${res.statusText}`);
  } else {
    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [folderId]
    };
    const boundary = 'report_boundary_sim';
    const body = 
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });
    if (!res.ok) throw new Error(`新增失敗: ${res.statusText}`);
  }

  return { success: true, totalRecords: historicalRecords.length, historicalRecords };
};

// ============================================================================
// 🎵 Personal Playlist Google Drive Sync Management
// ============================================================================
export const MY_PLAYLIST_FILENAME = 'MyPlaylist_SpecialReport_20260723.json';

// Save Personal Playlist to "API Special Report 20260723" folder
export const saveMyPlaylistToFolder = async (
  token: string,
  playlist: Array<{ title: string; url: string }>
): Promise<{ success: boolean; fileId: string; filename: string }> => {
  const folderId = await getOrCreateSpecialReportFolder(token);
  const filename = MY_PLAYLIST_FILENAME;

  const existingFileId = await findFileInFolder(token, folderId, filename);

  const playlistPayload = {
    folder: SPECIAL_REPORT_FOLDER_NAME,
    fileType: 'PersonalPlaylist',
    title: '我的個人歌單 / 預設推薦',
    lastUpdated: new Date().toISOString(),
    songCount: playlist.length,
    playlist
  };

  const fileContent = JSON.stringify(playlistPayload, null, 2);

  if (existingFileId) {
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });
    if (!res.ok) {
      throw new Error(`更新 ${filename} 失敗: ${res.statusText}`);
    }
    return { success: true, fileId: existingFileId, filename };
  } else {
    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [folderId],
      description: '氣象將車：我的個人歌單儲存與同步檔案 (API Special Report 20260723)'
    };

    const boundary = 'playlist_boundary_20260723';
    const body = 
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (!res.ok) {
      throw new Error(`建立 ${filename} 失敗: ${res.statusText}`);
    }

    const result = await res.json();
    return { success: true, fileId: result.id, filename };
  }
};

// Read Personal Playlist from "API Special Report 20260723" folder
export const readMyPlaylistFromFolder = async (
  token: string
): Promise<Array<{ title: string; url: string }> | null> => {
  if (!token) return null;
  try {
    const folderId = await getOrCreateSpecialReportFolder(token);
    if (!folderId) return null;
    const existingFileId = await findFileInFolder(token, folderId, MY_PLAYLIST_FILENAME);
    if (!existingFileId) return null;

    const fileUrl = `https://www.googleapis.com/drive/v3/files/${existingFileId}?alt=media`;
    const res = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.playlist)) {
        return data.playlist;
      }
    }
    return null;
  } catch (e) {
    console.warn('readMyPlaylistFromFolder warning:', e);
    return null;
  }
};
