import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { UserProfile, HealthData, Comment, RecommendedSong } from '../types';
import { HEALTH_DATABASE } from '../data/mockData';
import { 
  X, 
  Heart, 
  Activity, 
  ShieldAlert, 
  Thermometer, 
  Moon, 
  Smile, 
  Calendar, 
  Plus, 
  MessageSquare, 
  Gamepad2, 
  Database, 
  Mic, 
  Brain,
  Send,
  Bell,
  ShieldCheck,
  AlertCircle,
  Key,
  RefreshCw,
  Music,
  Cloud,
  CloudUpload,
  CloudDownload,
  FileText,
  LogOut,
  Check,
  Info,
  BarChart3,
  TrendingUp,
  Award,
  Users as UsersIcon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import SudokuGame from './SudokuGame';
import XiangqiVoiceGame from './XiangqiVoiceGame';
import {
  initAuth,
  googleSignIn,
  logout,
  saveBackupToDrive,
  restoreBackupFromDrive,
  exportHealthLogsToDrive,
  DriveBackupData
} from './googleDriveService';
import { User } from 'firebase/auth';

interface PersonalPanelProps {
  user: UserProfile;
  users?: UserProfile[];
  bubbleReplies?: Record<string, { sender: string; text: string; time: string }[]>;
  onClose: () => void;
  onAddComment: (userId: string, sender: string, text: string, healthDataId?: string, googleAvatar?: string, isGoogleAuth?: boolean) => void;
  healthDatabase: HealthData[];
  onPlaySong?: (song: RecommendedSong) => void;
  initialTab?: 'board' | 'game' | 'xiangqi' | 'line' | 'metrics';
  onRestoreComplete?: (restoredData: DriveBackupData) => void;
  onUpdateUserProfile?: (userId: string, updates: Partial<UserProfile>) => void;
}

export default function PersonalPanel({ 
  user, 
  users = [], 
  bubbleReplies = {}, 
  onClose, 
  onAddComment, 
  healthDatabase, 
  onPlaySong, 
  initialTab,
  onRestoreComplete,
  onUpdateUserProfile
}: PersonalPanelProps) {
  const [commenter, setCommenter] = useState('');
  const [commentText, setCommentText] = useState('');
  const [selectedHealthId, setSelectedHealthId] = useState('none');
  const [activeTab, setActiveTab] = useState<'board' | 'game' | 'xiangqi' | 'line' | 'metrics'>(initialTab || 'board');
  const [isXiangqiFullscreen, setIsXiangqiFullscreen] = useState(false);
  
  // States for editing "Today's Status"
  const [isEditingStatement, setIsEditingStatement] = useState(false);
  const [tempStatement, setTempStatement] = useState(user.todayStatement);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Google Drive state variables
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveMessage, setDriveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const getInitialProfile = (id: string) => {
    const defaults: Record<string, { name: string; avatar: string }> = {
      user_sugar: { name: "夢乃糖糖 🎀", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=sugar&hair=long&hairColor=ff85ad&mouth=smile&eyes=happy" },
      user_leo: { name: "極客雷歐 💻", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=leo&colors=blue&texture=radar" },
      user_cat: { name: "喵喵宇航員 🐱", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=cat&colors=orange" },
      user_sunny: { name: "陽光晴晴 ☀️", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sunny&top=shortCurly&accessories=round&hairColor=auburn" },
      user_retro: { name: "復古霓虹 🌇", avatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=retro&glasses=sunglasses" }
    };
    return defaults[id] || { name: "未知訪客 👤", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=unknown" };
  };

  const playSoundEffect = (freq: number, type: 'sine' | 'triangle' | 'sawtooth' = 'sine', duration = 0.15) => {
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
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  React.useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setDriveUser(u);
        setDriveToken(token);
      },
      () => {
        setDriveUser(null);
        setDriveToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync Google user account info (Name, Avatar) to active test user profile on success login
  React.useEffect(() => {
    if (driveUser) {
      const targetName = driveUser.displayName || user.name;
      const targetAvatar = driveUser.photoURL || user.avatar;
      if (user.name !== targetName || user.avatar !== targetAvatar) {
        onUpdateUserProfile?.(user.id, {
          name: targetName,
          avatar: targetAvatar
        });
      }
    } else {
      const original = getInitialProfile(user.id);
      if (user.name !== original.name || user.avatar !== original.avatar) {
        onUpdateUserProfile?.(user.id, {
          name: original.name,
          avatar: original.avatar
        });
      }
    }
  }, [driveUser, user.id, user.name, user.avatar, onUpdateUserProfile]);

  const handleDriveSignIn = async () => {
    setIsDriveLoading(true);
    setDriveMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setDriveUser(result.user);
        setDriveToken(result.accessToken);
        setDriveMessage({ text: `歡迎！${result.user.displayName || '使用者'} 登入成功。已啟用 Google Drive 權限。`, type: 'success' });
      }
    } catch (err: any) {
      console.error('Drive sign-in error:', err);
      setDriveMessage({ text: `登入失敗：${err.message || '未知錯誤'}`, type: 'error' });
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDriveSignOut = async () => {
    setIsDriveLoading(true);
    try {
      await logout();
      setDriveUser(null);
      setDriveToken(null);
      setDriveMessage({ text: '已成功登出 Google 帳號。', type: 'success' });
    } catch (err: any) {
      console.error('Drive sign-out error:', err);
      setDriveMessage({ text: `登出失敗：${err.message}`, type: 'error' });
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleBackup = async () => {
    if (!driveToken) {
      setDriveMessage({ text: '請先登入 Google 帳號！', type: 'error' });
      return;
    }
    
    const confirmBackup = window.confirm(
      '【確定要進行雲端備份嗎？】\n\n此操作將把當前本機所有的長者健康紀錄、留言板對話、以及數獨/象棋的本機歷史狀態，安全打包並儲存至您個人 Google Drive 的雲端檔案中。'
    );
    if (!confirmBackup) return;

    setIsDriveLoading(true);
    setDriveMessage(null);
    try {
      const result = await saveBackupToDrive(driveToken, {
        users: users.length > 0 ? users : [user],
        healthDatabase,
        bubbleReplies
      });
      if (result.success) {
        setDriveMessage({ text: result.message, type: 'success' });
      }
    } catch (err: any) {
      console.error('Backup error:', err);
      setDriveMessage({ text: `備份失敗：${err.message || '網路異常，請確認 API 金鑰或網路連線'}`, type: 'error' });
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!driveToken) {
      setDriveMessage({ text: '請先登入 Google 帳號！', type: 'error' });
      return;
    }

    const confirmRestore = window.confirm(
      '⚠️【警告：您確定要從雲端還原嗎？】\n\n此操作將完全「覆蓋與重設」當前瀏覽器的所有長者生理數據、留言紀錄及數獨/象棋記錄。此動作無法還原，請務必確認您已在雲端擁有正確的備份。'
    );
    if (!confirmRestore) return;

    setIsDriveLoading(true);
    setDriveMessage(null);
    try {
      const restored = await restoreBackupFromDrive(driveToken);
      if (restored) {
        if (onRestoreComplete) {
          onRestoreComplete(restored);
          setDriveMessage({ 
            text: `🎉 還原成功！已成功同步 ${restored.users.length} 位長者之雲端歷史備份資料！(備份時間: ${new Date(restored.timestamp).toLocaleString()})`, 
            type: 'success' 
          });
        } else {
          setDriveMessage({ text: '還原成功，但父組件尚未綁定更新機制。', type: 'success' });
        }
      } else {
        setDriveMessage({ text: '在您的 Google Drive 找不到備份檔案 (qi_xiang_jiang_che_backup.json)。請先進行「雲端備份」！', type: 'error' });
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      setDriveMessage({ text: `還原失敗：${err.message || '讀取雲端備份時發生錯誤'}`, type: 'error' });
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleExportSingleLog = async () => {
    if (!driveToken) {
      setDriveMessage({ text: '請先登入 Google 帳號！', type: 'error' });
      return;
    }

    setIsDriveLoading(true);
    setDriveMessage(null);
    try {
      const result = await exportHealthLogsToDrive(driveToken, user, linkedHealth);
      if (result.success) {
        setDriveMessage({ 
          text: `📄 匯出成功！已為長者「${user.name}」建立健康日誌，儲存為雲端文字檔：\n👉 「${result.filename}」`, 
          type: 'success' 
        });
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setDriveMessage({ text: `匯出失敗：${err.message || '寫入 Google Drive 失敗'}`, type: 'error' });
    } finally {
      setIsDriveLoading(false);
    }
  };

  // LINE Smart Notification Subsystem States
  const [lineToken, setLineToken] = useState(() => localStorage.getItem('bilibili_line_token') || '');
  const [lineUserId, setLineUserId] = useState(() => localStorage.getItem('bilibili_line_user_id') || '');
  
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [simulatedLineMessage, setSimulatedLineMessage] = useState<string | null>(null);

  // Sync LINE configuration to localStorage
  React.useEffect(() => {
    localStorage.setItem('bilibili_line_token', lineToken);
  }, [lineToken]);

  React.useEffect(() => {
    localStorage.setItem('bilibili_line_user_id', lineUserId);
  }, [lineUserId]);

  const linkedHealth = healthDatabase.find(h => h.id === user.healthDataId);


  // Sync Google display name to nickname field when logged in
  React.useEffect(() => {
    if (driveUser && driveUser.displayName && !commenter) {
      setCommenter(driveUser.displayName);
    }
  }, [driveUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commenter.trim() || !commentText.trim()) return;

    onAddComment(
      user.id,
      commenter.trim(),
      commentText.trim(),
      selectedHealthId === 'none' ? undefined : selectedHealthId,
      driveUser?.photoURL || undefined,
      !!driveUser
    );

    setCommentText('');
    setSelectedHealthId('none');
  };

  const handleSendTestLine = async () => {
    if (!lineToken.trim()) {
      setTestResult({ text: "請先輸入您的 LINE 權杖金鑰", type: "error" });
      return;
    }
    
    setIsSendingTest(true);
    setTestResult(null);
    setSimulatedLineMessage(null);
    try {
      const response = await fetch("/api/send-line-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customToken: lineToken,
          lineUserId: lineUserId,
          user: {
            name: user.name,
            todayStatement: user.todayStatement,
            statusText: user.statusText,
            healthData: linkedHealth
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "發送測試訊息失敗");

      if (data.isSimulated) {
        // Show simulated card from Sandbox Shield
        setSimulatedLineMessage(data.debugPayload || null);
        setTestResult({ text: data.message, type: "success" });
      } else if (data.success) {
        setSimulatedLineMessage(data.debugPayload || "【發送成功】您的實體 LINE 裝置已成功收到推播！");
        setTestResult({ text: "測試 LINE 訊息已成功發送至真實帳號！", type: "success" });
      } else {
        throw new Error(data.error || "發送失敗");
      }
    } catch (err: any) {
      setTestResult({ text: err.message, type: "error" });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Status dot style helper
  const getStatusColor = (status: UserProfile['status']) => {
    switch (status) {
      case 'online': return 'bg-emerald-400 shadow-emerald-400/40';
      case 'busy': return 'bg-rose-500 shadow-rose-500/40';
      case 'away': return 'bg-amber-400 shadow-amber-400/40';
      case 'offline': return 'bg-slate-500 shadow-slate-500/40';
    }
  };

  const getFatigueColor = (level: string) => {
    if (level === 'Low') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (level === 'Medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:max-w-md bg-slate-950/98 border-l border-slate-800 shadow-2xl flex flex-col z-50 animate-slide-in backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-12 h-12 rounded-full border-2 border-pink-500/40 object-cover" 
            />
            <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${getStatusColor(user.status)} shadow-sm`} />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-1.5">
              {user.name}
            </h3>
            <p className="text-xs text-pink-400 font-medium">{user.statusText}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/20 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('board')}
          className={`flex-1 min-w-[110px] py-3 text-center text-[11px] font-bold tracking-wider uppercase border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0
            ${activeTab === 'board' 
              ? 'border-pink-500 text-pink-400 bg-pink-500/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'}`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>狀態 & 留言</span>
        </button>
        <button
          onClick={() => setActiveTab('game')}
          className={`flex-1 min-w-[110px] py-3 text-center text-[11px] font-bold tracking-wider uppercase border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0
            ${activeTab === 'game' 
              ? 'border-pink-500 text-pink-400 bg-pink-500/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'}`}
        >
          <Brain className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
          <span>智力數獨</span>
        </button>
        <button
          onClick={() => setActiveTab('xiangqi')}
          className={`flex-1 min-w-[110px] py-3 text-center text-[11px] font-bold tracking-wider uppercase border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0
            ${activeTab === 'xiangqi' 
              ? 'border-pink-500 text-pink-400 bg-pink-500/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'}`}
        >
          <Mic className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
          <span>聲控象棋</span>
        </button>
        <button
          onClick={() => setActiveTab('line')}
          className={`flex-1 min-w-[110px] py-3 text-center text-[11px] font-bold tracking-wider uppercase border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0
            ${activeTab === 'line' 
              ? 'border-pink-500 text-pink-400 bg-pink-500/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'}`}
        >
          <Bell className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
          <span>LINE 智慧推播</span>
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex-1 min-w-[110px] py-3 text-center text-[11px] font-bold tracking-wider uppercase border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0
            ${activeTab === 'metrics' 
              ? 'border-pink-500 text-pink-400 bg-pink-500/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'}`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
          <span>活動數據</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {activeTab === 'board' ? (
          <>
            {/* Daily Statement */}
            <div className="bg-gradient-to-br from-pink-500/10 to-transparent border-l-4 border-pink-500 p-3.5 rounded-r-xl space-y-2 relative group">
              <div className="flex items-center justify-between">
                <span className="block text-[10px] uppercase font-bold text-pink-500 tracking-wider">
                  今日分享狀態 (Today's Status)
                </span>
                {!isEditingStatement && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingStatement(true);
                      setTempStatement(user.todayStatement);
                      playSoundEffect(600, 'sine', 0.1);
                    }}
                    className="text-[10px] text-pink-400 hover:text-pink-300 transition-all flex items-center gap-1 opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20"
                  >
                    <span>編輯狀態</span>
                  </button>
                )}
              </div>
              
              {isEditingStatement ? (
                <div className="space-y-2 mt-1">
                  <textarea
                    value={tempStatement}
                    onChange={(e) => setTempStatement(e.target.value)}
                    maxLength={150}
                    className="w-full bg-slate-950/80 border border-pink-500/40 focus:border-pink-500 text-xs text-slate-100 p-2 rounded-lg outline-none resize-none h-16 font-sans leading-relaxed"
                  />
                  <div className="flex justify-end gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingStatement(false);
                        playSoundEffect(400, 'sine', 0.1);
                      }}
                      className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateUserProfile?.(user.id, { todayStatement: tempStatement });
                        setIsEditingStatement(false);
                        playSoundEffect(800, 'sine', 0.15);
                      }}
                      className="bg-pink-500 text-slate-950 font-bold px-2.5 py-1 rounded-lg hover:bg-pink-400 transition-colors cursor-pointer"
                    >
                      儲存
                    </button>
                  </div>
                </div>
              ) : (
                <p 
                  onClick={() => {
                    setIsEditingStatement(true);
                    setTempStatement(user.todayStatement);
                    playSoundEffect(600, 'sine', 0.1);
                  }}
                  className="text-sm text-slate-100 italic leading-relaxed cursor-pointer hover:bg-white/5 p-1 rounded transition-colors"
                  title="點擊編輯狀態"
                >
                  「{user.todayStatement}」
                </p>
              )}
            </div>

            {/* Guestbook Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-pink-500" />
                <span>留言板內容 ({user.comments.length})</span>
              </h4>

              {/* Guestbook Lists */}
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1.5 custom-scrollbar">
                {user.comments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    目前尚無任何悄悄話。快來留下第一句溫馨問候吧！
                  </p>
                ) : (
                  [...user.comments].reverse().map((comment) => {
                    // Match a health record linked to this comment
                    const commentHealth = healthDatabase.find(h => h.id === comment.healthDataId);
                    return (
                      <div key={comment.id} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1.5 hover:border-slate-750 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {comment.isGoogleAuth && (
                              <div className="relative shrink-0 flex items-center justify-center">
                                {comment.googleAvatar ? (
                                  <img 
                                    src={comment.googleAvatar} 
                                    alt="Google User" 
                                    className="w-4 h-4 rounded-full border border-pink-500/30 object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-[8px] flex items-center justify-center font-black text-white">G</span>
                                )}
                              </div>
                            )}
                            <span className="font-bold text-sky-400 flex items-center gap-1">
                              {comment.sender}
                              {comment.isGoogleAuth && (
                                <span className="bg-pink-500/10 text-pink-400 text-[8px] px-1 py-0.2 rounded border border-pink-500/20 font-medium">Google 驗證</span>
                              )}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">{comment.time}</span>
                        </div>
                        <p className="text-slate-250 leading-relaxed break-words">{comment.text}</p>
                        
                        {comment.song && (
                          <div className="mt-2 flex items-center justify-between bg-slate-950/60 border border-slate-800/50 rounded-lg p-2">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-300 min-w-0">
                              <Music className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                              <span className="font-bold shrink-0 text-pink-400">點播:</span>
                              <span className="text-slate-200 truncate font-mono text-[10px]">{comment.song.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (onPlaySong) {
                                  onPlaySong(comment.song!);
                                }
                              }}
                              className="bg-pink-500 hover:bg-pink-400 text-slate-950 text-[9px] font-extrabold px-2 py-0.5 rounded cursor-pointer transition-colors active:scale-95 flex items-center gap-0.5 shrink-0"
                            >
                              <span>播放點播</span>
                            </button>
                          </div>
                        )}

                        {commentHealth && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-800/50 flex items-center gap-1.5 text-[10px] text-slate-400">
                            <Database className="w-3.5 h-3.5 text-pink-500" />
                            <span>發文時狀態：{commentHealth.label.split(' ')[0]} (心率: {commentHealth.heartRate})</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Google Quick Auth Status on Guestbook tab */}
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between gap-3 text-xs mt-2">
              <div className="flex items-center gap-2">
                {driveUser ? (
                  <>
                    <img 
                      src={driveUser.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${driveUser.uid}`}
                      alt={driveUser.displayName || 'Google User'}
                      className="w-8 h-8 rounded-full border-2 border-pink-500 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-1">
                        <span>{driveUser.displayName || 'Google 使用者'}</span>
                        <span className="bg-emerald-500/15 text-emerald-400 text-[8px] px-1.5 py-0.2 rounded border border-emerald-500/20">已登入</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">{driveUser.email}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 font-bold">G</div>
                    <div>
                      <span className="font-semibold text-slate-300 block text-[11px]">使用 Google 帳戶安全留言</span>
                      <span className="text-[10px] text-slate-500 block">登入後能顯示您的驗證頭像與暱稱</span>
                    </div>
                  </>
                )}
              </div>
              <div>
                {driveUser ? (
                  <button
                    type="button"
                    onClick={handleDriveSignOut}
                    disabled={isDriveLoading}
                    className="bg-slate-900 hover:bg-rose-950/30 hover:border-rose-900/50 hover:text-rose-400 border border-slate-800 text-[10px] font-bold text-slate-400 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    登出
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDriveSignIn}
                    disabled={isDriveLoading}
                    className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-slate-950 text-[10px] font-extrabold px-3 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95 shadow-lg shadow-pink-500/10 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isDriveLoading ? '讀取中' : '帳戶登入'}
                  </button>
                )}
              </div>
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handleSubmit} className="border-t border-slate-800 pt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <input 
                  type="text" 
                  placeholder="暱稱" 
                  value={commenter}
                  onChange={(e) => setCommenter(e.target.value)}
                  maxLength={12}
                  required
                  disabled={!!driveUser}
                  className="bg-slate-900 border border-slate-800 focus:border-pink-500 text-slate-100 text-xs rounded-lg px-2.5 py-2 outline-none col-span-1 transition-all disabled:opacity-75 disabled:bg-slate-950/40 disabled:border-slate-800/50 disabled:text-slate-400"
                />
                
                {/* Health database retrieval dropdown */}
                <select
                  value={selectedHealthId}
                  onChange={(e) => setSelectedHealthId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 focus:border-pink-500 text-slate-300 text-xs rounded-lg px-2 py-2 outline-none col-span-2 transition-all cursor-pointer"
                >
                  <option value="none">🩺 不附加健康資料 (None)</option>
                  {healthDatabase.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <textarea 
                  placeholder={driveUser ? "已驗證 Google 帳號！在此留下溫馨祝福或悄悄話..." : "在此留下給他的祝福或互動悄悄話... (推薦點擊上方 Google 快速登入)"}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  required
                  maxLength={80}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-pink-500 text-slate-100 text-xs rounded-lg p-2.5 outline-none resize-none h-[64px] transition-all"
                />
                <button 
                  type="submit"
                  className="bg-pink-500 hover:bg-pink-600 text-white px-3.5 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/10 active:scale-95 transition-all cursor-pointer text-xs font-semibold"
                >
                  <Plus className="w-4 h-4 mr-0.5" />
                  <span>留言</span>
                </button>
              </div>
            </form>
          </>
        ) : activeTab === 'game' ? (
          /* Embed Sudoku Game */
          <div className="py-2 space-y-4 animate-fade-in">
            <div className="text-center space-y-1">
              <h4 className="text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <Brain className="w-5 h-5 text-pink-500 animate-pulse" />
                <span>經典智力數獨 (Sudoku)</span>
              </h4>
              <p className="text-[11px] text-slate-400 max-w-[280px] mx-auto">
                這是為 {user.name} 量身打造的經典數學益智遊戲，結合邏輯推理與健康活腦！
              </p>
            </div>
            <SudokuGame />
          </div>
        ) : activeTab === 'xiangqi' ? (
          /* Embed Xiangqi Voice Game */
          <div className="py-2 space-y-4 animate-fade-in">
            <div className="text-center space-y-1">
              <h4 className="text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <Mic className="w-5 h-5 text-pink-500 animate-pulse" />
                <span>聲控象棋：動口不動手</span>
              </h4>
              <p className="text-[11px] text-slate-400 max-w-[280px] mx-auto">
                不分紅黑！支持用語音口令直接搬移棋子。向 {user.name} 的空間發起聲控挑戰！
              </p>
            </div>

            {/* 放大按鈕 */}
            <button
              onClick={() => setIsXiangqiFullscreen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-pink-600/20 to-rose-600/20 border border-pink-500/40 hover:border-pink-400/70 text-pink-300 font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>全螢幕放大棋盤（長輩模式）</span>
            </button>

            {/* 預覽縮圖 */}
            <div className="opacity-60 pointer-events-none">
              <XiangqiVoiceGame />
            </div>

            {/* ── 全螢幕 Modal ── */}
            {isXiangqiFullscreen && ReactDOM.createPortal(
              <div
                className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-sm flex flex-col"
                style={{ WebkitBackdropFilter: 'blur(8px)' }}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 shrink-0">
                  <div className="flex items-center gap-2">
                    <Mic className="w-5 h-5 text-pink-500 animate-pulse" />
                    <span className="text-white font-bold text-base">聲控象棋：動口不動手</span>
                    <span className="text-[10px] text-pink-400 bg-pink-500/10 border border-pink-500/30 px-2 py-0.5 rounded-full font-bold">長輩全螢幕模式</span>
                  </div>
                  <button
                    onClick={() => setIsXiangqiFullscreen(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer border border-slate-700 hover:border-slate-500"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>關閉全螢幕</span>
                  </button>
                </div>

                {/* Modal Body — 棋盤居中放大 */}
                <div className="flex-1 overflow-y-auto flex items-start justify-center p-4">
                  <div className="w-full max-w-2xl">
                    <XiangqiVoiceGame />
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        ) : activeTab === 'line' ? (
          /* LINE Scheduler tab content */
          <div className="py-2 space-y-5 animate-fade-in text-xs">
            <div className="text-center space-y-1">
              <h4 className="text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <Bell className="w-5 h-5 text-pink-500 animate-pulse" />
                <span>LINE 智慧自動推播子系統</span>
              </h4>
              <p className="text-[11px] text-slate-400 max-w-[320px] mx-auto leading-relaxed">
                整合 <b>Gemini 3.5-Flash</b>，自動彙整 <b>{user.name}</b> 的生理數據、今日狀態，產出溫暖生動的健康小卡，並推送至實體 LINE 頻道群組。
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold flex items-center gap-1.5 text-[11px]">
                  <Key className="w-3.5 h-3.5 text-pink-500" />
                  <span>Channel Access Token (Messaging API)</span>
                </label>
                <input
                  type="password"
                  placeholder="請貼上 Channel Access Token"
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 text-slate-100 rounded-lg p-2.5 outline-none font-mono"
                />
                <p className="text-[9px] text-slate-500">
                  ⚡ 推薦：最新 Messaging API 協定，支持個人 Push / 廣播 Broadcast 功能。
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold flex items-center gap-1.5 text-[11px]">
                  <Smile className="w-3.5 h-3.5 text-pink-500" />
                  <span>特定推送 User ID (選填)</span>
                </label>
                <input
                  type="text"
                  placeholder="請輸入 User ID (留空則會以群發 Broadcast 傳送)"
                  value={lineUserId}
                  onChange={(e) => setLineUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 text-slate-100 rounded-lg p-2.5 outline-none font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTestLine}
                disabled={isSendingTest}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-600/10 cursor-pointer text-sm"
              >
                {isSendingTest ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{isSendingTest ? "Gemini 編撰中 & 發送中..." : "🧪 測試發送一次"}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 leading-relaxed animate-fade-in ${
                testResult.type === 'success'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                {testResult.type === 'success' ? (
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                )}
                <div className="space-y-1 flex-1">
                  <span className="font-extrabold text-[11px] block">
                    {testResult.type === 'success' ? '發送結果 / 提示訊息' : '傳送失敗'}
                  </span>
                  <p className="text-[10px] text-slate-300 whitespace-pre-wrap">{testResult.text}</p>
                </div>
              </div>
            )}

            {simulatedLineMessage && (
              <div className="mt-4 border border-emerald-500/20 rounded-2xl overflow-hidden bg-slate-950 shadow-lg animate-fade-in" id="line_simulation_preview">
                {/* 模擬 LINE 頂部綠色狀態欄 */}
                <div className="bg-emerald-600 px-4 py-2.5 flex items-center justify-between text-xs font-black text-white">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-250"></span>
                    </span>
                    📱 LINE Messaging API 模擬預覽
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-700 px-2 py-0.5 rounded text-emerald-100">格式符合官方規範</span>
                </div>
                
                <div className="p-4 space-y-3 bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    {/* LINE 頭貼 */}
                    <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-xs shrink-0 select-none shadow uppercase">
                      助理
                    </div>
                    <div className="space-y-1 max-w-[85%] flex-1">
                      <span className="text-[10px] text-slate-400 font-extrabold block ml-1">
                        {user.name} 健康守護助理
                      </span>
                      {/* 綠色聊天氣泡 */}
                      <div className="bg-slate-950 text-slate-100 rounded-2xl rounded-tl-none px-4 py-3.5 text-xs leading-relaxed border border-slate-800 whitespace-pre-wrap font-sans shadow-inner select-all">
                        {simulatedLineMessage}
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500 text-right pr-2">
                    * 提示：長按或點選氣泡內文字即可快速複製。本機部署或上線後，將能真正推播此格式至手機。
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Metrics/Analytics Tab using Recharts */
          <div className="py-2 space-y-5 animate-fade-in text-xs">
            {/* Header */}
            <div className="text-center space-y-1">
              <h4 className="text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-pink-500 animate-pulse" />
                <span>數據分析與流量看版</span>
              </h4>
              <p className="text-[11px] text-slate-400 max-w-[320px] mx-auto leading-relaxed">
                統計您個人及與 {user.name} 互動的流量、熱度及活動趨勢數據。
              </p>
            </div>

            {/* KPI Summary Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex items-center gap-2.5">
                <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg border border-pink-500/20 shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block font-medium uppercase">互動留言數</span>
                  <span className="text-sm font-bold font-mono text-slate-200">{user.comments.length} 則</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block font-medium uppercase">本週彈幕量</span>
                  <span className="text-sm font-bold font-mono text-slate-200">
                    {45 + 58 + 62 + 85 + 92 + 110 + 135} 次
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex items-center gap-2.5 col-span-2">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-slate-500 block font-medium uppercase">最活躍親友</span>
                  <span className="text-xs font-bold text-slate-200 truncate block">
                    {(() => {
                      if (user.comments.length === 0) return '尚無資料';
                      const counts: Record<string, number> = {};
                      user.comments.forEach(c => {
                        counts[c.sender] = (counts[c.sender] || 0) + 1;
                      });
                      let maxSender = '尚無資料';
                      let maxCount = 0;
                      Object.entries(counts).forEach(([sender, count]) => {
                        if (count > maxCount) {
                          maxCount = count;
                          maxSender = sender;
                        }
                      });
                      return `${maxSender} (互動 ${maxCount} 次)`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Chart: Danmaku & Comments Traffic over last week */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-pink-400" />
                  <span>近七日彈幕與留言流量趨勢</span>
                </span>
                <span className="text-[8px] bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded border border-pink-500/20">
                  即時更新
                </span>
              </div>

              <div className="h-[180px] w-full text-[10px]">
                {(() => {
                  // Generate stable past week data with current comments factored in
                  const chartData = [
                    { day: '07/15', '彈幕': 45, '留言': 2 },
                    { day: '07/16', '彈幕': 58, '留言': 1 },
                    { day: '07/17', '彈幕': 62, '留言': 3 },
                    { day: '07/18', '彈幕': 85, '留言': 4 },
                    { day: '07/19', '彈幕': 92, '留言': 5 },
                    { day: '07/20', '彈幕': 110, '留言': user.comments.filter(c => c.time.startsWith('2026-07-20')).length + 3 },
                    { day: '07/21', '彈幕': 135, '留言': user.comments.filter(c => c.time.startsWith('2026-07-21')).length + user.comments.length },
                  ];

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="day" stroke="#64748b" fontSize={9} />
                        <YAxis stroke="#64748b" fontSize={9} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                          itemStyle={{ fontSize: '10px' }}
                        />
                        <Legend verticalAlign="top" height={24} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
                        <Line type="monotone" dataKey="彈幕" stroke="#ec4899" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3 }} name="彈幕發射" />
                        <Line type="monotone" dataKey="留言" stroke="#38bdf8" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3 }} name="關懷留言" />
                      </LineChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>

            {/* Bar Chart: Hourly Activity Heatmap */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <span>24小時制留言互動時段熱度</span>
                </span>
                <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20">
                  依 2 小時分組
                </span>
              </div>

              <div className="h-[180px] w-full text-[10px]">
                {(() => {
                  // Slots: 00-02, 02-04, 04-06, 06-08, 08-10, 10-12, 12-14, 14-16, 16-18, 18-20, 20-22, 22-24
                  const slots = [
                    { range: '00-02', '熱度': 1 },
                    { range: '02-04', '熱度': 0 },
                    { range: '04-06', '熱度': 1 },
                    { range: '06-08', '熱度': 3 },
                    { range: '08-10', '熱度': 8 },
                    { range: '10-12', '熱度': 12 },
                    { range: '12-14', '熱度': 7 },
                    { range: '14-16', '熱度': 9 },
                    { range: '16-18', '熱度': 11 },
                    { range: '18-20', '熱度': 15 },
                    { range: '20-22', '熱度': 18 },
                    { range: '22-24', '熱度': 6 },
                  ];

                  // Parse actual comment hours and add to slots
                  user.comments.forEach(comment => {
                    try {
                      const timeStr = comment.time.split(' ')[1];
                      if (timeStr) {
                        const hour = parseInt(timeStr.split(':')[0], 10);
                        if (!isNaN(hour)) {
                          const slotIndex = Math.floor(hour / 2);
                          if (slotIndex >= 0 && slotIndex < 12) {
                            slots[slotIndex]['熱度'] += 4;
                          }
                        }
                      }
                    } catch (e) {
                      console.error('Error parsing time for chart:', e);
                    }
                  });

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={slots} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="range" stroke="#64748b" fontSize={8} />
                        <YAxis stroke="#64748b" fontSize={9} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                          itemStyle={{ fontSize: '10px', color: '#38bdf8' }}
                          cursor={{ fill: 'rgba(236, 72, 153, 0.05)' }}
                        />
                        <Bar dataKey="熱度" fill="url(#colorHeat)" radius={[4, 4, 0, 0]} name="熱度值" />
                        <defs>
                          <linearGradient id="colorHeat" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
