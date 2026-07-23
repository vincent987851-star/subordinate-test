import React, { useState, useEffect } from 'react';
import { HealthData, RecommendedSong } from '../types';
import { Send, Sparkles, Heart, Activity, Database, AlertCircle, Music, Star, Trash2, Youtube, Play, X, FolderHeart, Cloud, RefreshCw, CheckCircle2 } from 'lucide-react';
import { 
  googleSignIn, 
  getAccessToken, 
  saveMyPlaylistToFolder, 
  readMyPlaylistFromFolder, 
  SPECIAL_REPORT_FOLDER_NAME,
  MY_PLAYLIST_FILENAME 
} from './googleDriveService';

interface NewDanmakuFormProps {
  onSendDanmaku: (
    text: string,
    senderName: string,
    avatarSeed: string,
    healthDataId?: string,
    song?: RecommendedSong
  ) => void;
  healthDatabase: HealthData[];
  onPlaySong?: (song: RecommendedSong) => void;
}

export default function NewDanmakuForm({ onSendDanmaku, healthDatabase, onPlaySong }: NewDanmakuFormProps) {
  const [text, setText] = useState('');
  const [senderName, setSenderName] = useState('');
  const [selectedHealthId, setSelectedHealthId] = useState('none');
  const [avatarSeed, setAvatarSeed] = useState(() => {
    return Math.floor(Math.random() * 1000).toString();
  });

  // YouTube recommended song state
  const [songTitle, setSongTitle] = useState('');
  const [songUrl, setSongUrl] = useState('');
  const [showPlaylistPopover, setShowPlaylistPopover] = useState(false);
  const [isPlaylistSyncing, setIsPlaylistSyncing] = useState(false);
  const [playlistSyncStatus, setPlaylistSyncStatus] = useState<string | null>(null);

  const [playlist, setPlaylist] = useState<{ title: string; url: string }[]>(() => {
    try {
      const saved = localStorage.getItem('bilibili_personal_playlist');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    // Pre-populate with beautiful default background music stations
    return [
      { title: '🎧 Lofi Girl 讀書電台', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
      { title: '🌌 Synthwave 霓虹慢搖', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY' },
      { title: '🌊 夏日蔚藍海洋 Lofi', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A' },
      { title: '🌧️ 窗外雨聲與鋼琴協奏', url: 'https://www.youtube.com/watch?v=P7v_A56K2xU' }
    ];
  });

  // Listen for Google Drive sync events to reload playlist
  useEffect(() => {
    const handleDriveSyncEvent = () => {
      try {
        const saved = localStorage.getItem('bilibili_personal_playlist');
        if (saved) {
          setPlaylist(JSON.parse(saved));
        }
      } catch (e) {
        console.error(e);
      }
    };

    window.addEventListener('playlistSyncedFromDrive', handleDriveSyncEvent);
    return () => {
      window.removeEventListener('playlistSyncedFromDrive', handleDriveSyncEvent);
    };
  }, []);

  // Background auto-sync playlist to Google Drive if active token exists
  const autoSyncPlaylistToDrive = async (updatedPlaylist: Array<{ title: string; url: string }>) => {
    try {
      const token = await getAccessToken();
      if (token) {
        setIsPlaylistSyncing(true);
        await saveMyPlaylistToFolder(token, updatedPlaylist);
        setPlaylistSyncStatus(`已自動同步 ${updatedPlaylist.length} 首歌曲至 Google Drive (${MY_PLAYLIST_FILENAME})`);
      }
    } catch (e: any) {
      console.warn('Auto playlist drive sync skipped/failed:', e);
    } finally {
      setIsPlaylistSyncing(false);
    }
  };

  // Manual trigger to sync/restore playlist with Google Drive
  const handleManualDriveSyncPlaylist = async () => {
    setIsPlaylistSyncing(true);
    setPlaylistSyncStatus('正在連結 Google Drive 並同步歌單...');
    try {
      let token = await getAccessToken();
      if (!token) {
        const authResult = await googleSignIn();
        if (!authResult || !authResult.accessToken) {
          setPlaylistSyncStatus('已取消 Google 帳號授權。');
          return;
        }
        token = authResult.accessToken;
      }

      // 1. Read remote playlist from Google Drive
      const remotePlaylist = await readMyPlaylistFromFolder(token);
      let merged = [...playlist];

      if (remotePlaylist && remotePlaylist.length > 0) {
        const existingUrls = new Set(playlist.map(s => s.url));
        const newRemote = remotePlaylist.filter(s => !existingUrls.has(s.url));
        merged = [...playlist, ...newRemote];
      }

      // 2. Save merged playlist back to Google Drive file
      await saveMyPlaylistToFolder(token, merged);

      // 3. Save locally
      setPlaylist(merged);
      localStorage.setItem('bilibili_personal_playlist', JSON.stringify(merged));

      setPlaylistSyncStatus(`已成功於 Google Drive「${SPECIAL_REPORT_FOLDER_NAME}」資料夾同步歌單檔案 (${MY_PLAYLIST_FILENAME})！共 ${merged.length} 首歌曲。`);
    } catch (e: any) {
      console.warn('Playlist drive sync warning:', e);
      setPlaylistSyncStatus(`歌單雲端同步提示: ${e?.message || e}`);
    } finally {
      setIsPlaylistSyncing(false);
    }
  };

  const handleSaveToPlaylist = () => {
    if (!songTitle.trim() || !songUrl.trim()) return;
    const newSong = { title: songTitle.trim(), url: songUrl.trim() };
    let nextList = playlist;
    
    if (playlist.some(s => s.url === newSong.url)) {
      setShowPlaylistPopover(true);
      return;
    }

    nextList = [...playlist, newSong];
    setPlaylist(nextList);
    localStorage.setItem('bilibili_personal_playlist', JSON.stringify(nextList));

    // Try auto-sync to Google Drive if logged in
    autoSyncPlaylistToDrive(nextList);

    // Pop up the bubble personal list page as requested!
    setShowPlaylistPopover(true);
  };

  const handleRemoveFromPlaylist = (indexToRemove: number) => {
    const nextList = playlist.filter((_, idx) => idx !== indexToRemove);
    setPlaylist(nextList);
    localStorage.setItem('bilibili_personal_playlist', JSON.stringify(nextList));

    // Try auto-sync to Google Drive if logged in
    autoSyncPlaylistToDrive(nextList);
  };

  const handleTestPlay = () => {
    if (songTitle.trim() && songUrl.trim() && onPlaySong) {
      onPlaySong({
        title: songTitle.trim(),
        url: songUrl.trim()
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const finalSender = senderName.trim() || '訪客';
    
    // Attach recommended song if both title and URL are populated
    let attachedSong: RecommendedSong | undefined = undefined;
    if (songTitle.trim() && songUrl.trim()) {
      attachedSong = {
        title: songTitle.trim(),
        url: songUrl.trim()
      };
    }

    onSendDanmaku(
      text.trim(),
      finalSender,
      avatarSeed,
      selectedHealthId === 'none' ? undefined : selectedHealthId,
      attachedSong
    );

    setText('');
    setSelectedHealthId('none');
    setSongTitle('');
    setSongUrl('');
    // Generate a new random avatar seed for next time
    setAvatarSeed(Math.floor(Math.random() * 1000).toString());
  };

  const selectedHealth = healthDatabase.find(h => h.id === selectedHealthId);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-xl space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-pink-500 animate-pulse" />
        <h3 className="text-white font-bold text-sm">發射互動彈幕 & 分享狀態</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Sender Name */}
          <div className="space-y-1.5 col-span-1">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              發言者暱稱 (Nickname)
            </label>
            <input
              type="text"
              placeholder="輸入你的大名..."
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              maxLength={12}
              className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 text-xs text-white px-3 py-2.5 rounded-lg outline-none transition-all"
            />
          </div>

          {/* Health Database select */}
          <div className="space-y-1.5 col-span-1 sm:col-span-2">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>調閱健康資料庫 (Dropdown Selection)</span>
            </label>
            <select
              value={selectedHealthId}
              onChange={(e) => setSelectedHealthId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 text-xs text-slate-300 px-3 py-2.5 rounded-lg outline-none transition-all cursor-pointer"
            >
              <option value="none">🩺 不公開/不附加健康狀態 (None)</option>
              {healthDatabase.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Health Preview */}
        {selectedHealth && (
          <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-2.5 flex items-center justify-between text-xs animate-fade-in">
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>已載入資料：{selectedHealth.label.split(' ')[0]}</span>
            </div>
            <div className="flex gap-3 text-[11px] text-slate-400 font-mono">
              <span>💓 心率: {selectedHealth.heartRate} bpm</span>
              <span>😴 睡眠: {selectedHealth.sleepDuration} hrs</span>
              <span>🌡️ 體溫: {selectedHealth.bodyTemperature}°C</span>
            </div>
          </div>
        )}

        {/* Recommended Song Section */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800/50 pb-2">
            <span className="text-[11px] text-pink-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
              <Music className="w-4 h-4 text-pink-500 animate-pulse" />
              <span>附加推薦歌曲 (Optional YouTube Broadcast)</span>
            </span>
            <span className="text-[9px] text-slate-500">輸入 YouTube 網址或影片 ID 即可提供他人點播</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] text-slate-400 font-bold uppercase block">歌曲名稱 (Song Title)</label>
              <input
                type="text"
                placeholder="例如：深夜咖啡館 Lofi"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 text-xs text-white px-2.5 py-2 rounded-lg outline-none transition-all placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-400 font-bold uppercase block">YouTube 連結或影片 ID (Link/ID)</label>
              <div className="flex gap-1.5 font-mono">
                <input
                  type="text"
                  placeholder="watch?v=dQw4w9WgXcQ 或 dQw4w9WgXcQ"
                  value={songUrl}
                  onChange={(e) => setSongUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-pink-500 text-xs text-white px-2.5 py-2 rounded-lg outline-none transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={handleSaveToPlaylist}
                  title="儲存至個人歌單"
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/5 text-amber-400 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </div>
          </div>

                  {/* Personal Playlist display */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold">📂 我的個人歌單 / 預設推薦</span>
                <button
                  type="button"
                  onClick={() => setShowPlaylistPopover(true)}
                  className="bg-pink-500/15 border border-pink-500/30 text-pink-400 hover:bg-pink-500/25 px-2 py-0.5 rounded-md text-[9px] font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                  title="展開個人歌單泡泡選單"
                >
                  <FolderHeart className="w-3 h-3 text-pink-500" />
                  <span>儲存至個人清單頁面 (展開)</span>
                </button>
              </div>
              
              {songTitle.trim() && songUrl.trim() && (
                <button
                  type="button"
                  onClick={handleTestPlay}
                  className="bg-pink-500 text-slate-950 hover:bg-pink-400 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold transition-all active:scale-95 flex items-center gap-1 shadow cursor-pointer animate-pulse"
                  title="立即試聽播放此歌曲"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>🎧 試聽播放 (Preview Play)</span>
                </button>
              )}
            </div>

            {playlist.length === 0 ? (
              <p className="text-[9px] text-slate-600 italic">目前無自訂歌曲，可輸入後點擊 ⭐ 儲存個人歌單</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                {playlist.map((song, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center gap-1 bg-slate-950/80 border border-slate-800/80 hover:border-pink-500/40 rounded-full px-2.5 py-1 text-[10px] text-slate-300 transition-all cursor-pointer select-none hover:bg-slate-900"
                    onClick={() => {
                      setSongTitle(song.title);
                      setSongUrl(song.url);
                    }}
                  >
                    <Youtube className="w-3 h-3 text-red-500" />
                    <span className="truncate max-w-[120px] font-medium">{song.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromPlaylist(idx);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Danmaku Input & Button */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="說點好聽的，發射一條友善的互動彈幕吧..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              maxLength={40}
              className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 text-xs text-white px-3.5 py-3 rounded-lg outline-none pr-10 transition-all placeholder:text-slate-500"
            />
            {/* Realtime visual avatar based on random seed */}
            <img
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${avatarSeed}`}
              alt="avatar-preview"
              className="absolute right-3 top-2.5 w-6 h-6 rounded-full border border-slate-800"
              title="隨機生成的大頭照"
            />
          </div>

          <button
            type="submit"
            className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs py-3 px-5 rounded-lg shadow-lg shadow-pink-500/10 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>發射 (Send)</span>
          </button>
        </div>
      </form>

      {/* PERSONAL PLAYLIST BUBBLE POPOVER */}
      {showPlaylistPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-pink-500/40 rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl relative overflow-hidden">
            {/* Ambient Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-pink-500 animate-pulse" />
                <h4 className="text-white font-extrabold text-sm tracking-wider">⭐ 個人歌單 / 點播清單</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPlaylistPopover(false)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ☁️ Google Drive Playlist Sync Toolbar */}
            <div className="bg-sky-950/60 border border-sky-500/30 rounded-xl p-2.5 mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-[10px] text-sky-200 font-medium truncate">
                  {playlistSyncStatus || `檔案: ${MY_PLAYLIST_FILENAME} (${SPECIAL_REPORT_FOLDER_NAME})`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleManualDriveSyncPlaylist}
                disabled={isPlaylistSyncing}
                className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-extrabold text-[10px] flex items-center gap-1 shrink-0 transition-all cursor-pointer active:scale-95 shadow"
                title="與 Google Drive 雲端資料夾同步個人歌單"
              >
                {isPlaylistSyncing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-slate-950" />
                    <span>同步中...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3 h-3" />
                    <span>雲端同步</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {playlist.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  目前無儲存歌曲，您可在下方輸入後點擊 ⭐ 儲存
                </div>
              ) : (
                playlist.map((song, idx) => (
                  <div
                    key={idx}
                    className="group bg-slate-950/80 border border-slate-800/80 hover:border-pink-500/40 rounded-xl p-3 flex items-center justify-between gap-3 transition-all hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-200 font-bold truncate">{song.title}</p>
                        <p className="text-[9px] text-slate-500 truncate font-mono">{song.url}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Apply button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSongTitle(song.title);
                          setSongUrl(song.url);
                          setShowPlaylistPopover(false);
                        }}
                        className="bg-slate-800 hover:bg-pink-500/20 hover:text-pink-400 text-slate-300 text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                        title="套用至點播欄位"
                      >
                        套用
                      </button>
                      
                      {/* Play button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onPlaySong) {
                            onPlaySong(song);
                          }
                        }}
                        className="bg-pink-500 hover:bg-pink-400 text-slate-950 text-[10px] font-extrabold px-2 py-1 rounded transition-colors flex items-center gap-0.5 cursor-pointer"
                        title="立即收聽"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>播放</span>
                      </button>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromPlaylist(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded bg-slate-950 border border-slate-800 hover:border-rose-900/40 transition-all cursor-pointer"
                        title="刪除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center leading-relaxed">
              點擊 <span className="text-slate-300 font-bold">套用</span> 將歌曲代入下方發射表單；點擊 <span className="text-pink-400 font-bold">播放</span> 可直接在轉播站中啟動播放！
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
