import React, { useState, useEffect } from 'react';
import { HEALTH_DATABASE, INITIAL_USERS, AVATARS } from './data/mockData';
import { UserProfile, HealthData, Comment, DanmakuMessage, RecommendedSong } from './types';
import DanmakuScreen from './components/DanmakuScreen';
import NewDanmakuForm from './components/NewDanmakuForm';
import PersonalPanel from './components/PersonalPanel';
import { 
  Tv, 
  MessageCircle, 
  Heart, 
  Users, 
  Activity, 
  Gauge, 
  Eye, 
  Settings, 
  Volume2, 
  ChevronRight, 
  CheckCircle,
  Sparkles,
  Gamepad2,
  Calendar,
  Database,
  Play,
  Pause,
  Trash2,
  Music,
  Youtube,
  X,
  Star,
  AlertCircle,
  Repeat,
  RotateCw,
  FolderHeart,
  ChevronDown,
  ListMusic,
  Bot
} from 'lucide-react';

export default function App() {
  // Main States
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('bilibili_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });
  
  const [healthDatabase, setHealthDatabase] = useState<HealthData[]>(() => {
    const saved = localStorage.getItem('bilibili_health_db');
    return saved ? JSON.parse(saved) : HEALTH_DATABASE;
  });

  const [danmakus, setDanmakus] = useState<DanmakuMessage[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [personalPanelTab, setPersonalPanelTab] = useState<'board' | 'game' | 'xiangqi' | 'line'>('board');
  
  // YouTube background music broadcaster states
  const [currentSong, setCurrentSong] = useState<RecommendedSong | null>(null);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  
  // Music Loop & Playlist Source states
  const [isLooping, setIsLooping] = useState(true);
  const [playbackSource, setPlaybackSource] = useState<'my_playlist' | 'ai_playlist' | 'single'>('my_playlist');
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  const [aiPreferenceSummary, setAiPreferenceSummary] = useState<string | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiRecommendedSongs, setAiRecommendedSongs] = useState<RecommendedSong[]>([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);

  // Read personal playlist from localStorage or fallback
  const getPersonalPlaylist = (): RecommendedSong[] => {
    try {
      const saved = localStorage.getItem('bilibili_personal_playlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      { title: '🎧 Lofi Girl 讀書電台', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
      { title: '🌌 Synthwave 霓虹慢遙', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY' },
      { title: '蔡琴 - 被遺忘的時光', url: 'https://www.youtube.com/watch?v=022pP3pWJm4' },
      { title: 'POISON - 毒藥廣播樂章', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A' }
    ];
  };

  // Play from My Personal Playlist
  const handlePlayMyPlaylist = (index = 0) => {
    const list = getPersonalPlaylist();
    if (list.length === 0) return;
    const targetIdx = index % list.length;
    setCurrentPlaylistIndex(targetIdx);
    setPlaybackSource('my_playlist');
    handlePlaySong(list[targetIdx]);
  };

  // Play using Gemini AI Analysis of Personal Playlist
  const handleAiAnalyzeAndPlay = async () => {
    setAiAnalyzing(true);
    setPlaybackSource('ai_playlist');
    try {
      const playlist = getPersonalPlaylist();
      const res = await fetch('/api/gemini/analyze-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist })
      });
      if (!res.ok) throw new Error('AI 分析失敗');
      const data = await res.json();
      setAiPreferenceSummary(data.preferenceSummary || 'AI 分析顯示您偏好懷舊經典與放鬆輕音樂');
      if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        setAiRecommendedSongs(data.recommendations);
      }
      if (data.selectedSong) {
        handlePlaySong({ title: data.selectedSong.title, url: data.selectedSong.url });
      } else if (data.recommendations?.[0]) {
        handlePlaySong(data.recommendations[0]);
      }
    } catch (err) {
      console.error(err);
      setAiPreferenceSummary('AI 判斷您熱愛懷舊經典國語與復古 Synthwave 電音');
      const fallback = { title: '🤖 AI點歌: 蔡琴 - 被遺忘的時光', url: 'https://www.youtube.com/watch?v=022pP3pWJm4' };
      handlePlaySong(fallback);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Play next song in active playlist
  const handleNextSong = () => {
    if (playbackSource === 'my_playlist') {
      const list = getPersonalPlaylist();
      const nextIdx = (currentPlaylistIndex + 1) % list.length;
      setCurrentPlaylistIndex(nextIdx);
      handlePlaySong(list[nextIdx]);
    } else if (playbackSource === 'ai_playlist' && aiRecommendedSongs.length > 0) {
      const nextIdx = (currentPlaylistIndex + 1) % aiRecommendedSongs.length;
      setCurrentPlaylistIndex(nextIdx);
      handlePlaySong(aiRecommendedSongs[nextIdx]);
    } else {
      const list = getPersonalPlaylist();
      handlePlaySong(list[0]);
    }
  };
  
  // Controls States
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedScale, setSpeedScale] = useState(1.0); // Multiplier: 0.5x to 2.0x
  const [opacity, setOpacity] = useState(90); // 10% to 100%
  const [showDanmaku, setShowDanmaku] = useState(true);
  
  // Right Click Bubble Reply Menu State
  const [bubbleMenu, setBubbleMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetDanmaku: DanmakuMessage | null;
  } | null>(null);

  // Nested Bubble thread replies
  const [bubbleReplies, setBubbleReplies] = useState<Record<string, { sender: string; text: string; time: string }[]>>(() => {
    const saved = localStorage.getItem('bilibili_bubble_replies');
    return saved ? JSON.parse(saved) : {};
  });

  // Track lanes for danmaku collision prevention
  const [trackLocks, setTrackLocks] = useState<number[]>(Array(8).fill(0));

  // Track seen danmaku IDs to avoid duplicate local animations
  const knownDanmakuIdsRef = React.useRef<Set<string>>(new Set());

  // Multi-user Real-time Sync Polling
  useEffect(() => {
    const fetchSyncData = async () => {
      try {
        const res = await fetch('/api/sync/all');
        if (!res.ok) return;
        const data = await res.json();

        // 1. Sync User Profiles & Guestbook Comments across all visitors
        if (Array.isArray(data.users) && data.users.length > 0) {
          setUsers(data.users);
        }

        // 2. Sync Shared YouTube Playlist
        if (Array.isArray(data.playlist) && data.playlist.length > 0) {
          try {
            const saved = localStorage.getItem('bilibili_personal_playlist');
            if (!saved) {
              localStorage.setItem('bilibili_personal_playlist', JSON.stringify(data.playlist));
            }
          } catch (e) {}
        }

        // 3. Sync Live Flying Danmakus from other users/devices
        if (Array.isArray(data.danmakus)) {
          data.danmakus.forEach((d: DanmakuMessage) => {
            if (!knownDanmakuIdsRef.current.has(d.id)) {
              knownDanmakuIdsRef.current.add(d.id);
              // Spawn remote danmaku on screen!
              spawnDanmaku(d.text, d.senderName, d.avatar, d.isUserSent, d.targetUserId, d.song);
            }
          });
        }
      } catch (e) {
        // Quiet fallback if server API is unavailable
      }
    };

    fetchSyncData();
    const syncInterval = setInterval(fetchSyncData, 3000);
    return () => clearInterval(syncInterval);
  }, [speedScale, showDanmaku, trackLocks]);

  // Backend Sync API Helper Methods
  const postDanmakuToBackend = async (text: string, senderName: string, avatar: string, targetUserId?: string, song?: RecommendedSong) => {
    try {
      const res = await fetch('/api/sync/danmaku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, senderName, avatar, targetUserId, song })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.danmaku?.id) {
          knownDanmakuIdsRef.current.add(data.danmaku.id);
        }
      }
    } catch (e) {}
  };

  const postCommentToBackend = async (userId: string, comment: Partial<Comment>) => {
    try {
      await fetch('/api/sync/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, comment })
      });
    } catch (e) {}
  };

  const postSongToBackend = async (song: RecommendedSong) => {
    try {
      await fetch('/api/sync/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song })
      });
    } catch (e) {}
  };

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('bilibili_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('bilibili_bubble_replies', JSON.stringify(bubbleReplies));
  }, [bubbleReplies]);

  useEffect(() => {
    localStorage.setItem('bilibili_health_db', JSON.stringify(healthDatabase));
  }, [healthDatabase]);

  // Audio synthethizer for interactive feedbaks
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

  // Helper to spawn a new danmaku
  const spawnDanmaku = (
    text: string, 
    senderName: string, 
    avatarUrl: string, 
    isUserSent = false,
    targetUserId?: string,
    song?: RecommendedSong
  ) => {
    if (!showDanmaku) return;

    // Pick track algorithm
    const now = Date.now();
    let chosenTrack = 0;
    let earliestFreeTrackTime = Infinity;
    let earliestTrackIdx = 0;

    for (let i = 0; i < 8; i++) {
      if (now > trackLocks[i]) {
        chosenTrack = i;
        break;
      }
      if (trackLocks[i] < earliestFreeTrackTime) {
        earliestFreeTrackTime = trackLocks[i];
        earliestTrackIdx = i;
      }
      if (i === 7) {
        chosenTrack = earliestTrackIdx;
      }
    }

    // Lock track (safety distance time based on text length)
    const baseDuration = (14 / speedScale) + (Math.random() * 2); // 14s base duration
    const trackLockDuration = (text.length * 150) + 2000; // lock track for matching characters
    
    setTrackLocks(prev => {
      const next = [...prev];
      next[chosenTrack] = now + trackLockDuration;
      return next;
    });

    const newDanmaku: DanmakuMessage = {
      id: `dan_${now}_${Math.random().toString(36).substr(2, 4)}`,
      text,
      senderName,
      avatar: avatarUrl,
      isUserSent,
      targetUserId,
      speed: baseDuration,
      track: chosenTrack,
      top: 25 + chosenTrack * 50,
      paused: false,
      createdAt: now,
      song
    };

    setDanmakus(prev => [...prev, newDanmaku]);
  };

  // Organic Traffic: auto spawn danmakus from existing users periodically
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // Pick random user
      const randomUser = users[Math.floor(Math.random() * users.length)];
      if (!randomUser) return;

      const randomType = Math.random();
      let text = '';
      if (randomType < 0.4) {
        text = randomUser.todayStatement;
      } else if (randomUser.comments.length > 0) {
        const randomComment = randomUser.comments[Math.floor(Math.random() * randomUser.comments.length)];
        text = randomComment.text;
      } else {
        text = `來看我分享的今日狀態吧！❤️`;
      }

      // Truncate if too long
      if (text.length > 38) text = text.substring(0, 35) + '...';

      spawnDanmaku(text, randomUser.name, randomUser.avatar, false, randomUser.id);
    }, 4500); // every 4.5 seconds

    return () => clearInterval(interval);
  }, [isPlaying, users, speedScale, showDanmaku, trackLocks]);

  // Clean up expired danmakus from state to keep render extremely lightweight
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setDanmakus(prev => prev.filter(d => {
        // If paused, keep it forever until user resumes or dismisses
        if (d.paused) return true;
        // Expired based on speed duration + 1s buffer
        return now - d.createdAt < (d.speed * 1000) + 1000;
      }));
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);

  // Trigger a few friendly initial danmakus at boot
  useEffect(() => {
    setTimeout(() => {
      spawnDanmaku("早安！歡迎來到我的 嗶哩嗶哩 留言板頻道～ 🎀", "夢乃糖糖 🎀", AVATARS.sugar, false, "user_sugar");
    }, 500);
    setTimeout(() => {
      spawnDanmaku("這個彈幕點擊可以鎖定！右鍵還能有泡泡選單喔！💻", "極客雷歐 💻", AVATARS.leo, false, "user_leo");
    }, 1500);
    setTimeout(() => {
      spawnDanmaku("太空極速巡航中，聽霓虹慢搖寫代碼超配！🚀", "喵喵宇航員 🐱", AVATARS.cat, false, "user_cat");
    }, 2500);
  }, []);

  // Handler: Click danmaku to pause/play
  const handleTogglePauseDanmaku = (id: string) => {
    setDanmakus(prev => prev.map(d => {
      if (d.id === id) {
        const nextPaused = !d.paused;
        playSoundEffect(nextPaused ? 300 : 500, nextPaused ? 'sawtooth' : 'sine', 0.1);
        return { ...d, paused: nextPaused };
      }
      return d;
    }));
  };

  // Handler: Right click danmaku to open Bubble Reply Menu
  const handleRightClickDanmaku = (danmaku: DanmakuMessage, x: number, y: number) => {
    // Also pause this specific danmaku so it doesn't fly away during reply
    setDanmakus(prev => prev.map(d => {
      if (d.id === danmaku.id) {
        return { ...d, paused: true };
      }
      return d;
    }));

    setBubbleMenu({
      visible: true,
      x,
      y,
      targetDanmaku: danmaku
    });
  };

  // Handler: Submit targeted bubble reply
  const handlePostBubbleReply = (target: DanmakuMessage, replyText: string, senderName: string) => {
    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    // Create reply
    const newReply = {
      sender: senderName,
      text: replyText,
      time: formattedTime
    };

    setBubbleReplies(prev => ({
      ...prev,
      [target.id]: [...(prev[target.id] || []), newReply]
    }));

    // Trigger sweet sound
    playSoundEffect(880, 'sine', 0.2);

    // Spawn interactive response danmaku with a customized reply indicator
    const replyDanmakuText = `💬 回覆 @${target.senderName}: ${replyText}`;
    const visitorAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(senderName)}`;
    spawnDanmaku(replyDanmakuText, senderName, visitorAvatar, true);
  };

  // Handler: Submit a new main board comment / update health database
  const handleSendMainDanmaku = (
    text: string, 
    senderName: string, 
    avatarSeed: string, 
    healthDataId?: string,
    song?: RecommendedSong
  ) => {
    const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${avatarSeed}`;
    
    // Trigger sound
    playSoundEffect(600, 'sine', 0.15);

    // 1. Spawn a flying danmaku
    let displayDanmakuText = text;
    if (healthDataId) {
      const hData = healthDatabase.find(h => h.id === healthDataId);
      if (hData) {
        displayDanmakuText = `🩺 [${hData.label.split(' ')[0]}] ${text}`;
      }
    }
    if (song) {
      displayDanmakuText = `🎵 [點播: ${song.title}] ${displayDanmakuText}`;
    }
    spawnDanmaku(displayDanmakuText, senderName, avatarUrl, true, undefined, song);
    postDanmakuToBackend(displayDanmakuText, senderName, avatarUrl, undefined, song);

    // Auto-stream the song immediately for the sender
    if (song) {
      setCurrentSong(song);
      postSongToBackend(song);
    }

    // 2. Also register it as an active comment in the database!
    const targetUserId = selectedUserId || "user_sugar";
    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      sender: senderName,
      text,
      time: formattedTime,
      healthDataId,
      song
    };

    setUsers(prev => prev.map(u => {
      if (u.id === targetUserId) {
        return {
          ...u,
          comments: [...u.comments, newComment]
        };
      }
      return u;
    }));
    postCommentToBackend(targetUserId, newComment);
  };

  // Add Comment on selected user's profile guestbook
  const handleAddGuestbookComment = (
    userId: string, 
    sender: string, 
    text: string, 
    healthDataId?: string,
    googleAvatar?: string,
    isGoogleAuth?: boolean
  ) => {
    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    const newComment: Comment = {
      id: `c_${Date.now()}`,
      sender,
      text,
      time: formattedTime,
      healthDataId,
      googleAvatar,
      isGoogleAuth
    };
 
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          comments: [...u.comments, newComment]
        };
      }
      return u;
    }));
    postCommentToBackend(userId, newComment);
 
    // Trigger sweet sound
    playSoundEffect(750, 'sine', 0.15);
 
    // Also spawn a corresponding highlighted reply danmaku on Bilibili screen!
    let displayDanmakuText = `留言給 ${users.find(u => u.id === userId)?.name.split(' ')[0]}: ${text}`;
    if (healthDataId) {
      const hData = healthDatabase.find(h => h.id === healthDataId);
      if (hData) {
        displayDanmakuText = `🩺 [${hData.label.split(' ')[0]}] ${displayDanmakuText}`;
      }
    }
    const commenterAvatar = isGoogleAuth && googleAvatar 
      ? googleAvatar 
      : `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(sender)}`;
    spawnDanmaku(displayDanmakuText, sender, commenterAvatar, true, userId);
    postDanmakuToBackend(displayDanmakuText, sender, commenterAvatar, userId);
  };

  const handleUpdateUserProfile = (userId: string, updates: Partial<UserProfile>) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
  };

  const getYouTubeId = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    try {
      const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = trimmed.match(reg);
      if (match && match[1]) {
        return match[1];
      }
    } catch (e) {}
    return trimmed;
  };

  const handlePlaySong = (song: RecommendedSong) => {
    playSoundEffect(523, 'sine', 0.25); // Musical ding sound
    setCurrentSong(song);
    setShowMiniPlayer(true); // Automatically show video player so they see the feed!
    setIsMusicPlaying(true);
    postSongToBackend(song);
  };

  const handlePlayXiangqi = () => {
    playSoundEffect(600, 'sine', 0.15);
    setPersonalPanelTab('xiangqi');
    if (!selectedUserId) {
      setSelectedUserId("user_sugar");
    }
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-pink-500/30 selection:text-pink-300">
      
      {/* TOP HEADER BAR */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 shadow-lg shadow-pink-500/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-2">
          {/* LEFT: Image 1 Banner Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayXiangqi}
              className="group relative flex items-center transition-all active:scale-95 cursor-pointer rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-pink-500/80 bg-slate-900/60 border border-slate-800 hover:border-pink-500/60 shadow-lg shadow-pink-500/10 shrink-0"
              title="點擊開啟聲控象棋"
            >
              <img
                src="/api/images/xiangqi-banner"
                onError={(e) => {
                  // Fallback to public asset if API is loading
                  (e.target as HTMLImageElement).src = "/assets/xiangqi_banner.jpg";
                }}
                alt="氣象將車 聲控象棋"
                className="h-[53px] w-[173px] object-cover transition-all group-hover:scale-105 group-hover:brightness-110"
                style={{ width: '172.8333px', height: '53px' }}
                referrerPolicy="no-referrer"
              />
            </button>
          </div>

          {/* RIGHT SIDE CONTROLS: Image 2 Pink Music Button, Loop Switch, Playlist / AI Selection */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 🎵 通用 播放 / 暫停 音樂控制按鈕 (大家看得懂的 ▶ / ⏸ 標準圖樣) */}
            <button
              onClick={() => {
                if (!currentSong) {
                  handlePlayMyPlaylist(0);
                  setIsMusicPlaying(true);
                } else {
                  const nextState = !isMusicPlaying;
                  setIsMusicPlaying(nextState);
                  playSoundEffect(nextState ? 600 : 350, 'sine', 0.15);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm ${
                isMusicPlaying && currentSong
                  ? 'bg-pink-950/80 text-pink-300 border-pink-500/60 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              }`}
              title={
                !currentSong
                  ? '點擊啟動播放音樂 (▶ 播放個人歌單)'
                  : isMusicPlaying
                  ? '點擊暫停音樂 (⏸ 暫停)'
                  : '點擊繼續播放音樂 (▶ 播放)'
              }
            >
              {isMusicPlaying && currentSong ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-pink-400 fill-pink-400 shrink-0" />
                  <span className="hidden sm:inline">暫停</span>
                  <span className="sm:hidden">暫停</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 ml-0.5 shrink-0" />
                  <span className="hidden sm:inline">{currentSong ? '繼續播放' : '播放音樂'}</span>
                  <span className="sm:hidden">播放</span>
                </>
              )}
            </button>

            {/* Playback Source Selector Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMusicMenu(prev => !prev)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-pink-500/30 hover:border-pink-400 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                title="選擇播放來源：播放個人歌單 或 AI分析喜好點歌"
              >
                {playbackSource === 'ai_playlist' ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse shrink-0" />
                    <span className="hidden md:inline">AI 喜好點歌</span>
                    <span className="md:hidden">AI點歌</span>
                  </>
                ) : (
                  <>
                    <FolderHeart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span className="hidden md:inline">我的個人歌單</span>
                    <span className="md:hidden">個人歌單</span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {/* Dropdown Menu */}
              {showMusicMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-xl animate-fade-in space-y-1">
                  <div className="px-2 py-1 text-[10px] text-slate-400 font-bold border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span>🎵 選擇音樂播放模式</span>
                    <button onClick={() => setShowMusicMenu(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Option A: Play My Personal Playlist (Image 3 Source) */}
                  <button
                    onClick={() => {
                      setShowMusicMenu(false);
                      handlePlayMyPlaylist(0);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      playbackSource === 'my_playlist'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <FolderHeart className="w-4 h-4 text-pink-400 shrink-0" />
                    <div className="flex flex-col">
                      <span>播放我的個人歌單</span>
                      <span className="text-[9px] text-slate-400 font-normal">順序/循環播放您儲存的自訂樂曲</span>
                    </div>
                  </button>

                  {/* Option B: AI Analyze & Smart Pick */}
                  <button
                    onClick={() => {
                      setShowMusicMenu(false);
                      handleAiAnalyzeAndPlay();
                    }}
                    disabled={aiAnalyzing}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      playbackSource === 'ai_playlist'
                        ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {aiAnalyzing ? (
                      <RotateCw className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />
                    )}
                    <div className="flex flex-col">
                      <span>AI 分析歌單喜好點歌</span>
                      <span className="text-[9px] text-slate-400 font-normal">Gemini 分析曲風喜好自動選歌</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 「無限循環播放」 Toggle Switch */}
            <button
              onClick={() => {
                const nextState = !isLooping;
                setIsLooping(nextState);
                playSoundEffect(nextState ? 700 : 400, 'sine', 0.15);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm ${
                isLooping
                  ? 'bg-pink-950/80 text-pink-300 border-pink-500/60 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title={isLooping ? '無限循環播放開啟中（粉紅音樂圖示持續旋轉）' : '點擊開啟無限循環播放'}
            >
              <Repeat className={`w-3.5 h-3.5 ${isLooping ? 'text-pink-400 animate-spin' : ''}`} style={isLooping ? { animationDuration: '3s' } : undefined} />
              <span className="hidden sm:inline">{isLooping ? '無限循環: 開' : '無限循環: 關'}</span>
              <span className="sm:hidden">{isLooping ? '循環中' : '單次'}</span>
            </button>

            {/* (第二張圖) 粉紅圓形音樂音符 🎵 按鈕 - 當無限循環開啟時，按鈕會持續旋轉 */}
            <button
              onClick={() => {
                if (!currentSong) {
                  handlePlayMyPlaylist(0);
                } else {
                  setShowMiniPlayer(prev => !prev);
                }
                playSoundEffect(800, 'sine', 0.1);
              }}
              className={`relative w-10 h-10 rounded-full bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold shadow-[0_0_20px_rgba(236,72,153,0.6)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0 ${
                isLooping ? 'animate-spin' : ''
              }`}
              style={isLooping ? { animationDuration: '4s' } : undefined}
              title={
                isLooping
                  ? '🎵 無限循環播放開啟中（粉紅按鈕持續旋轉）- 點擊展開廣播播放器'
                  : '🎵 點擊開啟音樂播放器'
              }
            >
              <Music className="w-5 h-5 text-slate-950" />
              {currentSong && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-slate-950 rounded-full animate-ping" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Player + Controls + Input */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Main Video/Danmaku Screen Wrap */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
            <DanmakuScreen 
              danmakus={danmakus}
              onTogglePauseDanmaku={handleTogglePauseDanmaku}
              onRightClickDanmaku={handleRightClickDanmaku}
              bubbleMenu={bubbleMenu}
              onCloseBubbleMenu={() => setBubbleMenu(null)}
              onPostBubbleReply={handlePostBubbleReply}
              bubbleReplies={bubbleReplies}
              onPlaySong={handlePlaySong}
              onLaunchGame={() => {
                setPersonalPanelTab('game');
                if (!selectedUserId) {
                  setSelectedUserId("user_sugar");
                }
              }}
              onPlayXiangqi={handlePlayXiangqi}
            />

            {/* PLAYER CONTROLS HUB */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-3.5">
                {/* Play/Pause Button */}
                <button
                  onClick={() => {
                    setIsPlaying(!isPlaying);
                    playSoundEffect(isPlaying ? 220 : 440, 'sine', 0.1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-95
                    ${isPlaying 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    }
                  `}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>暫停發送 (Pause Auto)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>啟動發送 (Play Auto)</span>
                    </>
                  )}
                </button>

                {/* Speed Slider */}
                <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1 rounded-lg border border-slate-800">
                  <Gauge className="w-3.5 h-3.5 text-pink-500" />
                  <span className="text-slate-400">速度:</span>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1"
                    value={speedScale}
                    onChange={(e) => setSpeedScale(Number(e.target.value))}
                    className="w-16 accent-pink-500 cursor-pointer h-1" 
                  />
                  <span className="font-mono text-pink-400 w-8 text-right font-bold">{speedScale.toFixed(1)}x</span>
                </div>

                {/* Opacity Slider */}
                <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1 rounded-lg border border-slate-800">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-slate-400">透明:</span>
                  <input 
                    type="range" 
                    min="20" 
                    max="100" 
                    step="10"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-16 accent-sky-400 cursor-pointer h-1" 
                  />
                  <span className="font-mono text-sky-400 w-8 text-right font-bold">{opacity}%</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDanmaku(!showDanmaku);
                    playSoundEffect(500, 'sine', 0.05);
                  }}
                  className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-colors active:scale-95 select-none
                    ${showDanmaku 
                      ? 'bg-pink-500/10 text-pink-400 border-pink-500/25 hover:bg-pink-500/20' 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }
                  `}
                >
                  {showDanmaku ? "顯示彈幕 (ON)" : "隱藏彈幕 (OFF)"}
                </button>

                <button
                  onClick={() => {
                    setDanmakus([]);
                    playSoundEffect(150, 'sawtooth', 0.2);
                  }}
                  className="bg-slate-900 hover:bg-red-950/30 hover:border-red-900/50 hover:text-red-400 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清除</span>
                </button>
              </div>
            </div>
          </div>

          {/* New Danmaku Sender Form with physical database selector */}
          <NewDanmakuForm 
            onSendDanmaku={handleSendMainDanmaku}
            healthDatabase={healthDatabase}
            onPlaySong={handlePlaySong}
          />

        </section>

        {/* RIGHT COLUMN: User Cards Wall */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-pink-500 animate-pulse" />
              <span>本站使用者留言牆 ({users.length})</span>
            </h2>
            <span className="text-[10px] text-slate-500">點擊卡片開啟個人面板</span>
          </div>

          {/* User list grid */}
          <div className="space-y-3">
            {users.map((user) => {
              // Retrieve physical database status for display
              const linkedHealth = healthDatabase.find(h => h.id === user.healthDataId);

              return (
                <div
                  key={user.id}
                  onClick={() => {
                    setSelectedUserId(user.id);
                    setPersonalPanelTab('board');
                    playSoundEffect(450, 'sine', 0.1);
                  }}
                  className={`bg-slate-900/60 border hover:border-pink-500/40 rounded-xl p-3.5 flex items-center gap-3.5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-pink-500/5 relative group overflow-hidden backdrop-blur-md
                    ${selectedUserId === user.id ? 'border-pink-500 bg-gradient-to-r from-pink-500/10 to-slate-900/60 shadow-lg shadow-pink-500/10' : 'border-slate-800'}
                  `}
                >
                  {/* Neon slide animation bg indicator */}
                  <div className="absolute inset-y-0 left-0 w-1 bg-pink-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-bottom" />

                  {/* Avatar wrapper */}
                  <div className="relative shrink-0">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-12 h-12 rounded-full border border-slate-700/60 group-hover:border-pink-500/50 object-cover transition-colors"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${user.id}`;
                      }}
                    />
                    <span 
                      className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-slate-950
                        ${user.status === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 
                          user.status === 'busy' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 
                          user.status === 'away' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-slate-500'}
                      `}
                    />
                  </div>

                  {/* Meta details */}
                  <div className="flex-1 min-width-0">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="font-bold text-slate-100 text-xs sm:text-sm group-hover:text-pink-400 transition-colors">
                        {user.name}
                      </span>
                      <span className="text-[9px] bg-slate-950/70 text-slate-400 border border-slate-800 px-2 py-0.5 rounded">
                        {user.statusText}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1 italic group-hover:text-slate-200 transition-colors">
                      「{user.todayStatement}」
                    </p>

                    {/* Integrated physical state info */}
                    {linkedHealth && (
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>心率: {linkedHealth.heartRate}</span>
                        </span>
                        <span>😴 睡眠: {linkedHealth.sleepDuration}h</span>
                        <span className="bg-sky-500/5 text-sky-400 border border-sky-500/20 px-1.5 py-0.2 rounded font-bold scale-95 origin-left">
                          {linkedHealth.label.split(' ')[0]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Chevron action hint */}
                  <div className="text-slate-600 group-hover:text-pink-500 transition-all transform group-hover:translate-x-0.5">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* QUICK TRIVIA / BANNER */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">星空小站秘籍</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              點擊彈幕可以隨時暫停與解鎖。對著任何飄過來的彈幕點擊【滑鼠右鍵】可以呼叫【泡泡選單】，進行特定對話的深度互動、或是啟動隱藏版星際鏈結小遊戲！
            </p>
          </div>
        </section>

      </main>

      {/* DETAILED PERSONAL PANEL DRAWER (次頁呼叫個人面板) */}
      {selectedUser && (
        <PersonalPanel 
          user={selectedUser}
          users={users}
          bubbleReplies={bubbleReplies}
          onClose={() => setSelectedUserId(null)}
          onAddComment={handleAddGuestbookComment}
          healthDatabase={healthDatabase}
          onPlaySong={handlePlaySong}
          initialTab={personalPanelTab}
          onRestoreComplete={(restored) => {
            setUsers(restored.users);
            setHealthDatabase(restored.healthDatabase);
            setBubbleReplies(restored.bubbleReplies);
          }}
          onUpdateUserProfile={handleUpdateUserProfile}
        />
      )}

      {/* FLOATING YOUTUBE BACKGROUND MUSIC BROADCASTER PLAYER (PERSISTENT IN DOM) */}
      {currentSong && (
        <div
          className={`fixed bottom-4 right-4 z-50 bg-slate-900/95 border-2 border-pink-500 rounded-2xl w-84 shadow-[0_0_25px_rgba(236,72,153,0.4)] overflow-hidden backdrop-blur-md transition-all duration-300 ${
            showMiniPlayer
              ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
              : 'opacity-0 scale-90 pointer-events-none translate-y-12'
          }`}
        >
          {/* Player Header */}
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-2.5 flex items-center justify-between text-slate-950 font-extrabold text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Music className={`w-4 h-4 text-slate-950 shrink-0 ${isLooping ? 'animate-spin' : ''}`} style={isLooping ? { animationDuration: '4s' } : undefined} />
              <span className="truncate">BGM: {currentSong.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNextSong}
                className="hover:bg-black/10 px-1.5 py-0.5 rounded transition-colors text-slate-950 cursor-pointer text-[10px] font-extrabold flex items-center gap-0.5 shrink-0"
                title="切換下一首"
              >
                <span>下一首 ▶</span>
              </button>
              <button
                onClick={() => setShowMiniPlayer(false)}
                className="hover:bg-black/10 px-1.5 py-0.5 rounded transition-colors text-slate-950 cursor-pointer text-[10px] font-bold shrink-0"
                title="縮小播放器（保持背景音樂持續播放）"
              >
                最小化
              </button>
            </div>
          </div>

          {/* AI Preference Summary Banner (if AI mode active) */}
          {playbackSource === 'ai_playlist' && aiPreferenceSummary && (
            <div className="bg-purple-950/80 border-b border-purple-500/40 p-2 text-[10px] text-purple-200 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5 leading-tight">
                <span className="font-extrabold text-purple-300">🤖 AI 歌單喜好分析：</span>
                <span className="text-slate-200">{aiPreferenceSummary}</span>
              </div>
            </div>
          )}

          {/* Actual Youtube Video Player Embed (Visible API Display) */}
          <div className="aspect-video bg-black relative">
            {getYouTubeId(currentSong.url) ? (
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${getYouTubeId(currentSong.url)}?autoplay=${isMusicPlaying ? 1 : 0}&mute=0&enablejsapi=1&controls=1&loop=${isLooping ? 1 : 0}&playlist=${getYouTubeId(currentSong.url)}&origin=${encodeURIComponent(window.location.origin)}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-400 gap-2">
                <AlertCircle className="w-8 h-8 text-rose-500" />
                <span>連結無效或格式不正確，無法載入轉播。</span>
              </div>
            )}
          </div>

          {/* Equalizer and info */}
          <div className="p-3 bg-slate-950/90 text-xs space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span>狀態: {isMusicPlaying ? (isLooping ? '🔁 無限循環中' : '廣播中 📡') : '⏸ 已暫停'}</span>
              </span>
              <span className="font-mono text-pink-400">
                {playbackSource === 'ai_playlist' ? '✨ Gemini AI' : '📂 個人歌單'}
              </span>
            </div>
            
            {/* Visual Equalizer Bars */}
            <div className="flex items-center justify-center gap-0.5 h-6 bg-slate-900 rounded-lg border border-slate-800 px-2 overflow-hidden">
              {Array.from({ length: 15 }).map((_, i) => {
                const delay = (i * 0.1).toFixed(1);
                return (
                  <div
                    key={i}
                    className="w-1 bg-gradient-to-t from-pink-500 to-sky-400 rounded-full"
                    style={{
                      animation: 'equalizer 1.2s ease-in-out infinite',
                      animationDelay: `${delay}s`,
                      animationPlayState: isMusicPlaying ? 'running' : 'paused'
                    }}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-900">
              <button
                onClick={() => setIsLooping(prev => !prev)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                  isLooping ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Repeat className={`w-3 h-3 ${isLooping ? 'animate-spin' : ''}`} style={isLooping ? { animationDuration: '3s' } : undefined} />
                <span>{isLooping ? '無限循環: 開' : '無限循環: 關'}</span>
              </button>

              <button
                onClick={handleNextSong}
                className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-pink-500 hover:bg-pink-400 text-slate-950 transition-colors cursor-pointer flex items-center gap-1 shadow"
              >
                <span>下一首 ▶</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MINIMIZED FLOAT PLAYING INDICATOR (第二張圖經典風格粉紅旋轉/彈跳按鈕) */}
      {currentSong && !showMiniPlayer && (
        <button
          onClick={() => setShowMiniPlayer(true)}
          className={`fixed bottom-4 right-4 z-50 bg-pink-500 hover:bg-pink-400 text-slate-950 p-3.5 rounded-full shadow-[0_0_25px_rgba(236,72,153,0.8)] flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all ${
            isLooping ? 'animate-spin' : 'animate-bounce'
          }`}
          style={isLooping ? { animationDuration: '4s' } : undefined}
          title={`背景音樂持續播放中 - 點擊展開廣播器 (${isLooping ? '無限循環旋轉中' : '廣播中'}): ${currentSong.title}`}
        >
          <Music className="w-6 h-6 text-slate-950" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-950 rounded-full animate-ping" />
        </button>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 text-center py-6 text-xs text-slate-500 mt-auto">
        <p>Bilibili Marquee Message Board System © 2026 Antigravity Workshop. Crafted with Pride & React.</p>
      </footer>

    </div>
  );
}
