import React, { useState, useEffect, useRef } from 'react';
import { XiangqiEngine, XiangqiAI, Move, Piece, Color } from '../lib/xiangqiEngine';
import { Mic, MicOff, RotateCcw, HelpCircle, Trophy, Sparkles, Volume2, Shield, Activity, User, Play, Pause, Compass, HelpCircle as HelpIcon } from 'lucide-react';

interface GameLogEntry {
  id: string;
  text: string;
  time: string;
  type: 'red' | 'black' | 'system';
}

interface XiangqiVoiceGameProps {
  fullscreen?: boolean;
}

export default function XiangqiVoiceGame({ fullscreen = false }: XiangqiVoiceGameProps) {
  const [engine] = useState(() => new XiangqiEngine());
  const [ai] = useState(() => new XiangqiAI());
  
  // States
  const [board, setBoard] = useState<(Piece | null)[]>(() => [...engine.board]);
  const [turn, setTurn] = useState<Color>(() => engine.turn);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [pendingVoiceMove, setPendingVoiceMove] = useState<{
    from: number;
    to: number;
    notation: string;
  } | null>(null);
  const [gameMode, setGameMode] = useState<'ai' | 'pvp'>('ai');
  const [isListening, setIsListening] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState('語音助理未啟動');
  const [transcript, setTranscript] = useState('');
  const [logs, setLogs] = useState<GameLogEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [waveform, setWaveform] = useState<number[]>(Array(24).fill(2));
  
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldListenRef = useRef(false);

  // Sound generator
  const playSound = (type: 'move' | 'capture' | 'check' | 'error' | 'win') => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          audioCtxRef.current = new AudioCtxClass();
        }
      }
      
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(550, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'capture') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(280, now + 0.18);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'check') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.setValueAtTime(240, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now); // C5
        osc.frequency.setValueAtTime(659, now + 0.1); // E5
        osc.frequency.setValueAtTime(783, now + 0.2); // G5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      // Audio fallback
    }
  };

  // Text-to-Speech
  const speakAnnouncement = (text: string) => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      
      const voices = window.speechSynthesis.getVoices();
      const twVoice = voices.find(v => v.lang.includes('TW') || v.lang.includes('HK') || v.lang.includes('ZH'));
      if (twVoice) utterance.voice = twVoice;
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  // Log updates
  const addLog = (text: string, type: 'red' | 'black' | 'system') => {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [
      ...prev,
      { id: `log_${Date.now()}_${Math.random()}`, text, time: formattedTime, type }
    ]);
  };

  // Advanced Normalizer for Chinese Speech Homophones & Xiangqi Terms
  const normalizeVoiceText = (text: string): string => {
    let s = text.toLowerCase().trim()
      .replace(/[\s\t\n,，。！？!?:：;；"'-]/g, '')
      .replace(/^(請|幫我|我想|幫忙|麻煩|請把|把|移動|可以|幫我走)+/, '')
      .replace(/(一下|謝謝|拉|去|到|吧)$/, '');

    // Pieces homophones
    s = s.replace(/包|爆|報|抱|泡|跑|鮑|暴|寶/g, '炮');
    s = s.replace(/俥|扯|徹|澈|側|撤|居/g, '車');
    s = s.replace(/傌|碼|瑪|螞|罵|麻|媽|嗎/g, '馬');
    s = s.replace(/相|像|向|橡|巷|想|響|項/g, '象');
    s = s.replace(/仕|事|示|是|試|視|市|飾|適|室/g, '士');
    s = s.replace(/帥|匠|率|衰|醬/g, '將');
    s = s.replace(/卒|冰|餅|炳|稟|祖|竹|族|阻|註|主/g, '兵');

    // Modifiers
    s = s.replace(/錢|淺/g, '前');
    s = s.replace(/厚|候|後頭/g, '後');
    s = s.replace(/重|鍾|種/g, '中');

    // Actions
    s = s.replace(/近|盡|禁|浸|晉|緊|靜|今|晶|敬|勁/g, '進');
    s = s.replace(/推|腿|特|忒|對|兌/g, '退');
    s = s.replace(/評|屏|瓶|坪|憑|蘋|拼/g, '平');

    // Number homophones
    s = s.replace(/壹|伊|衣|醫|依|抑/g, '一');
    s = s.replace(/貳|爾|兩|兒|而|梁|亮/g, '二');
    s = s.replace(/參|傘|散|刪|衫/g, '三');
    s = s.replace(/肆|似|寺|思|撕|絲/g, '四');
    s = s.replace(/伍|武|舞|吾|午/g, '五');
    s = s.replace(/陸|綠|溜|路|鹿/g, '六');
    s = s.replace(/柒|漆|妻|戚|其|騎/g, '七');
    s = s.replace(/捌|巴|吧|拔|把|霸/g, '八');
    s = s.replace(/玖|酒|久|就|救|舊/g, '九');

    // Alphabet homophones for coordinates
    s = s.replace(/欸|愛|阿|埃|艾/g, 'a');
    s = s.replace(/必|逼|筆|弊|閉|比/g, 'b');
    s = s.replace(/西|溪|希|吸|洗|喜/g, 'c');
    s = s.replace(/弟|滴|狄|低|遞|帝/g, 'd');
    s = s.replace(/依|醫|宜|移/g, 'e');
    s = s.replace(/夫|福|浮|付|扶/g, 'f');
    s = s.replace(/雞|極|集|急|居|基/g, 'g');
    s = s.replace(/嗨|赫|黑|欸區/g, 'h');

    return s;
  };

  // Map Speech Homophones
  const pieceMap: Record<string, string> = {
    '車': 'r', '俥': 'r', '居': 'r', '居士': 'r', '車子': 'r',
    '馬': 'n', '傌': 'n', '碼': 'n', '嘛': 'n', '媽': 'n', '麻': 'n',
    '相': 'b', '象': 'b', '向': 'b', '像': 'b', '巷': 'b',
    '士': 'a', '仕': 'a', '事': 'a', '是': 'a', '市': 'a', '示': 'a',
    '帥': 'k', '將': 'k', '帥哥': 'k', '將軍': 'k', '降': 'k', '江': 'k',
    '砲': 'c', '炮': 'c', '泡': 'c', '跑': 'c', '抱': 'c',
    '兵': 'p', '卒': 'p', '冰': 'p', '足': 'p', '族': 'p', '阻': 'p'
  };

  const dirMap: Record<string, string> = {
    '進': '進', '上': '進', '前': '進', '近': '進',
    '退': '退', '下': '退', '回': '退',
    '平': '平', '走': '平', '橫': '平', '到': '平'
  };

  const numMap: Record<string, number> = {
    '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '零': 0, '十': 10, '0': 0
  };

  // Perform legal move
  const performMove = (from: number, to: number): boolean => {
    const originalPiece = engine.board[from];
    if (!originalPiece) return false;

    const isCapture = engine.board[to] !== null;
    const traditionalNotation = engine.formatMoveTraditional(from, to);
    const turnStr = engine.turn === 'w' ? '紅方' : '黑方';

    const success = engine.move(from, to);
    if (success) {
      setBoard([...engine.board]);
      setTurn(engine.turn);
      setSelectedIdx(null);
      setPendingVoiceMove(null);

      // Sound and TTS feedback
      if (isCapture) {
        playSound('capture');
      } else {
        playSound('move');
      }

      speakAnnouncement(`${turnStr}：${traditionalNotation}`);
      addLog(`${turnStr}走：${traditionalNotation}`, turn === 'w' ? 'red' : 'black');

      // Checkmate / Check checker
      const checkRed = engine.isCheck('w');
      const checkBlack = engine.isCheck('b');
      if (checkRed) {
        playSound('check');
        speakAnnouncement('紅方被將軍！');
        addLog('🚨 紅方被將軍！', 'system');
      }
      if (checkBlack) {
        playSound('check');
        speakAnnouncement('黑方被將軍！');
        addLog('🚨 黑方被將軍！', 'system');
      }

      if (engine.isCheckmate()) {
        playSound('win');
        speakAnnouncement(`${turnStr}獲勝！將軍抽車，絕殺！`);
        addLog(`🏆 遊戲結束：${turnStr}絕殺獲勝！`, 'system');
      } else if (engine.isStalemate()) {
        speakAnnouncement('困斃，雙方和棋');
        addLog('🤝 遊戲結束：困斃和棋！', 'system');
      }

      // Auto trigger computer AI move
      if (gameMode === 'ai' && engine.turn === 'b') {
        setTimeout(() => {
          const aiMove = ai.getBestMove(engine, 3);
          if (aiMove) {
            performMove(aiMove.from, aiMove.to);
          }
        }, 600);
      }

      return true;
    }

    return false;
  };

  // Disambiguate multi-candidate choices
  const disambiguateCandidates = (
    candidates: { row: number; col: number; index: number }[],
    direction: string,
    targetVal: number | null,
    pieceType: string
  ): { row: number; col: number; index: number } | null => {
    const matching: typeof candidates = [];
    const color = engine.turn;

    for (const cand of candidates) {
      const legalMoves = engine.generateLegalMoves().filter(m => m.from === cand.index);
      for (const move of legalMoves) {
        const from = engine.getCoords(move.from);
        const to = engine.getCoords(move.to);
        const dy = to.row - from.row;
        let moveDir = '';
        if (color === 'w') {
          if (dy < 0) moveDir = '進';
          else if (dy > 0) moveDir = '退';
          else moveDir = '平';
        } else {
          if (dy > 0) moveDir = '進';
          else if (dy < 0) moveDir = '退';
          else moveDir = '平';
        }

        if (moveDir !== direction) continue;

        if (direction === '平') {
          const targetColIdx = (color === 'w') ? (9 - (targetVal || 0)) : ((targetVal || 0) - 1);
          if (to.col === targetColIdx) matching.push(cand);
        } else {
          const isDiagonalPiece = ['a', 'b', 'n'].includes(pieceType);
          if (isDiagonalPiece) {
            const targetColIdx = (color === 'w') ? (9 - (targetVal || 0)) : ((targetVal || 0) - 1);
            if (to.col === targetColIdx) matching.push(cand);
          } else {
            const distance = Math.abs(dy);
            if (distance === targetVal) matching.push(cand);
          }
        }
      }
    }

    if (matching.length === 1) return matching[0];
    return candidates[0] || null;
  };

  // Traditional speech parser
  const parseTraditionalMove = (
    posModifier: string,
    pieceType: string,
    startColVal: number,
    direction: string,
    targetVal: number | null
  ): { from: number; to: number } | null => {
    const turnColor = engine.turn;
    const startColIdx = (turnColor === 'w') ? (9 - startColVal) : (startColVal - 1);

    if (startColIdx < 0 || startColIdx > 8) return null;

    // Find pieces
    const candidates: { row: number; col: number; index: number }[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = engine.getPiece(r, c);
        if (piece && engine.getPieceColor(piece) === turnColor && engine.getPieceType(piece) === pieceType) {
          if (c === startColIdx) {
            candidates.push({ row: r, col: c, index: r * 9 + c });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    let sourcePiece: { row: number; col: number; index: number } | null = null;
    if (candidates.length === 1) {
      sourcePiece = candidates[0];
    } else {
      candidates.sort((a, b) => a.row - b.row);
      if (turnColor === 'w') {
        if (posModifier === '前') {
          sourcePiece = candidates[0];
        } else if (posModifier === '後') {
          sourcePiece = candidates[candidates.length - 1];
        } else {
          sourcePiece = disambiguateCandidates(candidates, direction, targetVal, pieceType);
        }
      } else {
        if (posModifier === '前') {
          sourcePiece = candidates[candidates.length - 1];
        } else if (posModifier === '後') {
          sourcePiece = candidates[0];
        } else {
          sourcePiece = disambiguateCandidates(candidates, direction, targetVal, pieceType);
        }
      }
    }

    if (!sourcePiece) return null;

    // Filter move matching direction
    const legalMoves = engine.generateLegalMoves().filter(m => m.from === sourcePiece!.index);
    for (const move of legalMoves) {
      const from = engine.getCoords(move.from);
      const to = engine.getCoords(move.to);
      const dy = to.row - from.row;
      let moveDir = '';
      if (turnColor === 'w') {
        if (dy < 0) moveDir = '進';
        else if (dy > 0) moveDir = '退';
        else moveDir = '平';
      } else {
        if (dy > 0) moveDir = '進';
        else if (dy < 0) moveDir = '退';
        else moveDir = '平';
      }

      if (moveDir !== direction) continue;

      if (direction === '平') {
        const targetColIdx = (turnColor === 'w') ? (9 - (targetVal || 0)) : ((targetVal || 0) - 1);
        if (to.col === targetColIdx) {
          return { from: move.from, to: move.to };
        }
      } else {
        const isDiagonalPiece = ['a', 'b', 'n'].includes(pieceType);
        if (isDiagonalPiece) {
          const targetColIdx = (turnColor === 'w') ? (9 - (targetVal || 0)) : ((targetVal || 0) - 1);
          if (to.col === targetColIdx) {
            return { from: move.from, to: move.to };
          }
        } else {
          const distance = Math.abs(dy);
          if (distance === targetVal) {
            return { from: move.from, to: move.to };
          }
        }
      }
    }

    return null;
  };

  // Normalize and process voice command with selection confirmation & fuzzy matching
  const processVoiceCommand = (text: string) => {
    if (!text || !text.trim()) return;
    setTranscript(text);

    const rawLower = text.toLowerCase().trim();
    const clean = normalizeVoiceText(text);

    // HIGHEST PRIORITY: Confirmation and Cancellation commands when in pending/selected state
    const isConfirm = /確定|確認|卻定|雀定|執行|對|ok|okay|是的|行|好|走|確認走|確定走|走吧|沒錯|正確|同意|要|好啊|走這步/.test(rawLower) || /確定|確認|對|走|好/.test(clean);
    const isCancel = /取消|重選|不對|不是|算了一步|算了|不要|別|重新選擇|錯了|別走/.test(rawLower) || /取消|重選|不對|不是|算了/.test(clean);

    if (pendingVoiceMove) {
      if (isConfirm) {
        const { from, to, notation } = pendingVoiceMove;
        const ok = performMove(from, to);
        if (ok) {
          addLog(`✅ 聲控確認執行著法：${notation}`, turn === 'w' ? 'red' : 'black');
        }
        setPendingVoiceMove(null);
        setSelectedIdx(null);
        return;
      }
      if (isCancel) {
        setPendingVoiceMove(null);
        setSelectedIdx(null);
        speakAnnouncement('已取消選擇');
        addLog('❌ 已取消棋子選擇', 'system');
        return;
      }
    } else if (selectedIdx !== null) {
      if (isCancel) {
        setSelectedIdx(null);
        speakAnnouncement('已取消選擇');
        addLog('❌ 已取消棋子選擇', 'system');
        return;
      }
      if (isConfirm) {
        const targets = engine.generateLegalMoves().filter(m => m.from === selectedIdx).map(m => m.to);
        if (targets.length === 1) {
          const notation = engine.formatMoveTraditional(selectedIdx, targets[0]);
          const ok = performMove(selectedIdx, targets[0]);
          if (ok) {
            addLog(`✅ 聲控確認唯一著法：${notation}`, turn === 'w' ? 'red' : 'black');
          }
          setSelectedIdx(null);
          return;
        } else if (targets.length > 1) {
          speakAnnouncement('該棋子有多個可能落點，請指示落點或目的地。');
          addLog('💡 請指示落點（例如平五或到A5）', 'system');
          return;
        }
      }
    }

    // Step 3: Game Control Commands (悔棋 / 重新開始 / 提示)
    if (/悔|毀|灰|回棋|悔一步|毀一步|退一步|上一步|撤銷|復原|重來一步/.test(rawLower)) {
      handleUndo();
      setPendingVoiceMove(null);
      speakAnnouncement('已進行悔棋');
      addLog(`🗣️ 聲控口令：悔棋 (語音：「${text}」)`, 'system');
      return;
    }
    if (/重新|重來|重開|新局|重置|開局|重新開始/.test(rawLower)) {
      handleRestart();
      setPendingVoiceMove(null);
      addLog(`🗣️ 聲控口令：重新開始 (語音：「${text}」)`, 'system');
      return;
    }
    if (/提示|求助|幫我|走哪|下哪|建議/.test(rawLower)) {
      handleHint();
      addLog(`🗣️ 聲控口令：提示 (語音：「${text}」)`, 'system');
      return;
    }

    // Step 4: Destination match when a piece is ALREADY selected (e.g. "平五", "進一", "到A5")
    if (selectedIdx !== null && !pendingVoiceMove) {
      const legalMovesForSelected = engine.generateLegalMoves().filter(m => m.from === selectedIdx);
      let matchedTargetMove: { from: number; to: number } | null = null;

      for (const m of legalMovesForSelected) {
        const trad = engine.formatMoveTraditional(m.from, m.to);
        const normTrad = normalizeVoiceText(trad);
        const toCoord = engine.getCoords(m.to);
        const colChar = String.fromCharCode(97 + toCoord.col);

        if (clean.includes(normTrad) || rawLower.includes(`${colChar}${toCoord.row}`) || clean.includes(trad[trad.length - 2] + trad[trad.length - 1])) {
          matchedTargetMove = m;
          break;
        }
      }

      if (matchedTargetMove) {
        const notation = engine.formatMoveTraditional(matchedTargetMove.from, matchedTargetMove.to);
        const piece = engine.board[selectedIdx];
        const pieceName = piece ? engine.getPieceChineseName(piece) : '棋子';
        const pieceColorName = piece ? (engine.getPieceColor(piece) === 'w' ? '紅' : '黑') : '';
        setPendingVoiceMove({ from: matchedTargetMove.from, to: matchedTargetMove.to, notation });

        speakAnnouncement(`已選擇${pieceColorName}${pieceName}，預計${notation}。請說『確定』執行，或『取消』重選。`);
        addLog(`🎯 預覽聲控著法：${notation}，請說「確定」執行或「取消」重選`, turn === 'w' ? 'red' : 'black');
        return;
      }
    }

    // Step 5: Helper to select piece and preview candidate move
    const prepareVoiceMoveConfirmation = (fromIdx: number, toIdx: number | null, customNotation?: string) => {
      setSelectedIdx(fromIdx);
      const piece = engine.board[fromIdx];
      const pieceName = piece ? engine.getPieceChineseName(piece) : '棋子';
      const pieceColorName = piece ? (engine.getPieceColor(piece) === 'w' ? '紅' : '黑') : '';

      if (toIdx !== null) {
        const notation = customNotation || engine.formatMoveTraditional(fromIdx, toIdx);
        setPendingVoiceMove({ from: fromIdx, to: toIdx, notation });

        speakAnnouncement(`已選擇${pieceColorName}${pieceName}，預計${notation}。請說『確定』執行，或『取消』重選。`);
        addLog(`🎯 預覽聲控著法：${notation}，請說「確定」執行或「取消」重選`, turn === 'w' ? 'red' : 'black');
      } else {
        setPendingVoiceMove(null);
        speakAnnouncement(`已選擇${pieceColorName}${pieceName}，現有可移動區域已高亮，請說出落點或『確定』。`);
        addLog(`🎯 聲控選取棋子：${pieceColorName}${pieceName} (可動區域已高亮)`, turn === 'w' ? 'red' : 'black');
      }
    };

    // Step 6: Coordinate Commands ("A2 到 A5")
    const coordRegex = /([a-iA-I])\s*([0-9])\s*(?:走到|到|至|往|移到|拉到|to|-|\s)*\s*([a-iA-I])\s*([0-9])/;
    const matchCoord = text.match(coordRegex) || clean.match(coordRegex);
    if (matchCoord) {
      const fromCol = matchCoord[1].toLowerCase().charCodeAt(0) - 97;
      const fromRow = parseInt(matchCoord[2], 10);
      const toCol = matchCoord[3].toLowerCase().charCodeAt(0) - 97;
      const toRow = parseInt(matchCoord[4], 10);

      const fromIdx = fromRow * 9 + fromCol;
      const toIdx = toRow * 9 + toCol;

      if (fromIdx >= 0 && fromIdx < 90 && toIdx >= 0 && toIdx < 90) {
        const piece = engine.board[fromIdx];
        if (piece && engine.getPieceColor(piece) === turn) {
          prepareVoiceMoveConfirmation(fromIdx, toIdx);
          return;
        }
      }
    }

    // Step 7: Traditional Commands ("炮二平五")
    const tradRegex = /(前|後|中)?([車俥居馬傌相象士仕帥將砲炮兵卒])([一二三四五六七八九兩1-9])?(進|退|平|上|下|走)([一二三四五六七八九兩0-9零]?)/;
    const matchTrad = clean.match(tradRegex) || text.match(tradRegex);
    if (matchTrad) {
      const posModifier = matchTrad[1] || '';
      const pieceChar = matchTrad[2];
      const startColChar = matchTrad[3];
      const directionChar = matchTrad[4];
      const targetChar = matchTrad[5] || '';

      const pieceType = pieceMap[pieceChar];
      let startColVal = startColChar ? numMap[startColChar] : null;
      const direction = dirMap[directionChar];
      const targetVal = targetChar ? numMap[targetChar] : null;

      if (pieceType && direction) {
        if (!startColVal) {
          const turnColor = engine.turn;
          const piecesOnBoard: number[] = [];
          for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
              const p = engine.getPiece(r, c);
              if (p && engine.getPieceColor(p) === turnColor && engine.getPieceType(p) === pieceType) {
                piecesOnBoard.push(c);
              }
            }
          }
          if (piecesOnBoard.length === 1) {
            startColVal = turnColor === 'w' ? (9 - piecesOnBoard[0]) : (piecesOnBoard[0] + 1);
          }
        }

        if (startColVal) {
          const moveRes = parseTraditionalMove(posModifier, pieceType, startColVal, direction, targetVal);
          if (moveRes) {
            prepareVoiceMoveConfirmation(moveRes.from, moveRes.to);
            return;
          }
        }
      }
    }

    // Step 8: Direct Piece Selection Only ("選炮二", "選擇炮", "A2")
    const pieceOnlyRegex = /([車俥居馬傌相象士仕帥將砲炮兵卒])([一二三四五六七八九兩1-9])?/;
    const matchPieceOnly = clean.match(pieceOnlyRegex);
    if (matchPieceOnly) {
      const pieceChar = matchPieceOnly[1];
      const colChar = matchPieceOnly[2];
      const pieceType = pieceMap[pieceChar];
      let colVal = colChar ? numMap[colChar] : null;

      if (pieceType) {
        const turnColor = engine.turn;
        const candidates: number[] = [];
        for (let i = 0; i < 90; i++) {
          const p = engine.board[i];
          if (p && engine.getPieceColor(p) === turnColor && engine.getPieceType(p) === pieceType) {
            const coords = engine.getCoords(i);
            const actualColVal = turnColor === 'w' ? (9 - coords.col) : (coords.col + 1);
            if (!colVal || colVal === actualColVal) {
              candidates.push(i);
            }
          }
        }
        if (candidates.length > 0) {
          prepareVoiceMoveConfirmation(candidates[0], null);
          return;
        }
      }
    }

    // Step 9: ULTIMATE FUZZY CANDIDATE MATCHING AGAINST ALL LEGAL MOVES
    const legalMoves = engine.generateLegalMoves();
    if (legalMoves.length > 0) {
      let bestMove: { from: number; to: number } | null = null;
      let maxScore = 0;
      let bestTrad = '';

      for (const m of legalMoves) {
        const trad = engine.formatMoveTraditional(m.from, m.to);
        const normTrad = normalizeVoiceText(trad);
        const fromCoord = engine.getCoords(m.from);
        const toCoord = engine.getCoords(m.to);
        const colLetterFrom = String.fromCharCode(97 + fromCoord.col);
        const colLetterTo = String.fromCharCode(97 + toCoord.col);

        let score = 0;

        const pieceChar = trad[0];
        if (clean.includes(pieceChar) || text.includes(pieceChar)) score += 35;

        const dirChar = trad.length >= 3 ? trad[trad.length - 2] : '';
        if (dirChar && (clean.includes(dirChar) || text.includes(dirChar))) score += 25;

        const numsInTrad = trad.match(/[一二三四五六七八九1-9]/g) || [];
        for (const num of numsInTrad) {
          if (clean.includes(num) || text.includes(num)) score += 15;
        }

        if (clean.includes(normTrad) || normTrad.includes(clean)) {
          score += 40;
        }

        const coordSub1 = `${colLetterFrom}${fromCoord.row}${colLetterTo}${toCoord.row}`;
        const coordSub2 = `${colLetterFrom}${fromCoord.row}`;
        if (rawLower.includes(coordSub1)) score += 50;
        else if (rawLower.includes(coordSub2)) score += 20;

        if (score > maxScore) {
          maxScore = score;
          bestMove = m;
          bestTrad = trad;
        }
      }

      if (bestMove && maxScore >= 35) {
        prepareVoiceMoveConfirmation(bestMove.from, bestMove.to, bestTrad);
        return;
      }
    }

    // Unmatched fallback
    playSound('error');
    speakAnnouncement('未辨識出有效棋步，請重新說一次。');
    addLog(`❓ 未能配對合法棋步：「${text}」`, 'system');
  };

  // Start Voice Recognition
  const toggleListening = () => {
    playSound('move');
    if (isListening) {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setVoiceStatusText('語音辨識已關閉');
    } else {
      shouldListenRef.current = true;
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechClass) {
        setVoiceStatusText('您的瀏覽器不支援語音辨識，請使用 Chrome、Edge 或 Safari。');
        return;
      }

      const rec = new SpeechClass();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'zh-TW';

      rec.onstart = () => {
        setIsListening(true);
        setVoiceStatusText('語音聆聽中，請說口令（例：炮二平五）...');
      };

      rec.onresult = (e: any) => {
        const result = e.results[e.resultIndex];
        const text = result[0].transcript;
        processVoiceCommand(text);
      };

      rec.onerror = (err: any) => {
        console.error('Speech recognition error: ', err.error);
        if (err.error === 'not-allowed') {
          shouldListenRef.current = false;
          setVoiceStatusText('麥克風權限被拒！請點選右上角「在新分頁開啟」或檢查瀏覽器網址列設定。');
        } else if (err.error === 'audio-capture') {
          shouldListenRef.current = false;
          setVoiceStatusText('找不到麥克風裝置或錄音失敗！請確認裝置是否連接、正確啟用且無其他程式佔用。');
        } else if (err.error === 'no-speech') {
          // Keep shouldListenRef.current as true, silence is expected in long-term listening
          console.log('No speech detected, will auto-restart.');
        } else if (err.error === 'network') {
          shouldListenRef.current = false;
          setVoiceStatusText('網路連接錯誤，請檢查您的網路狀態。');
        } else {
          setVoiceStatusText(`辨識出錯：${err.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        if (shouldListenRef.current) {
          try {
            rec.start();
          } catch (e) {
            console.error('Auto-restart speech recognition failed:', e);
          }
        } else {
          setIsListening(false);
          setVoiceStatusText('語音辨識已關閉');
        }
      };

      rec.start();
      recognitionRef.current = rec;
    }
  };

  // Waveform effect when listening
  useEffect(() => {
    let anim: NodeJS.Timeout;
    if (isListening) {
      anim = setInterval(() => {
        setWaveform(Array(24).fill(0).map(() => Math.floor(Math.random() * 20) + 4));
      }, 100);
    } else {
      setWaveform(Array(24).fill(2));
    }
    return () => clearInterval(anim);
  }, [isListening]);

  // Clean recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Controls Handlers
  const handleTileClick = (idx: number) => {
    if (selectedIdx === null) {
      const piece = board[idx];
      if (piece && engine.getPieceColor(piece) === turn) {
        setSelectedIdx(idx);
        playSound('move');
      }
    } else {
      if (selectedIdx === idx) {
        setSelectedIdx(null);
      } else {
        const piece = board[idx];
        if (piece && engine.getPieceColor(piece) === turn) {
          setSelectedIdx(idx);
          playSound('move');
        } else {
          const ok = performMove(selectedIdx, idx);
          if (!ok) playSound('error');
        }
      }
    }
  };

  const handleUndo = () => {
    engine.undo();
    if (gameMode === 'ai') {
      engine.undo(); // undo AI turn as well
    }
    setBoard([...engine.board]);
    setTurn(engine.turn);
    setSelectedIdx(null);
    addLog('↩️ 已悔棋至上一回合', 'system');
    playSound('move');
  };

  const handleRestart = () => {
    engine.reset();
    setBoard([...engine.board]);
    setTurn(engine.turn);
    setSelectedIdx(null);
    setLogs([]);
    addLog('🔄 重新開始！紅方先行。', 'system');
    speakAnnouncement('重新開始！紅方先行。');
    playSound('win');
  };

  const handleHint = () => {
    const hintMove = ai.getBestMove(engine, 2);
    if (hintMove) {
      setSelectedIdx(hintMove.from);
      const text = engine.formatMoveTraditional(hintMove.from, hintMove.to);
      speakAnnouncement(`提示著法：${text}`);
      addLog(`💡 提示步：${text}`, 'system');
    }
  };

  // Get active targets of selected piece
  const activeTargets = selectedIdx !== null
    ? engine.generateLegalMoves().filter(m => m.from === selectedIdx).map(m => m.to)
    : [];

  // Board jsx element (reusable for both normal & side-by-side fullscreen)
  const renderBoard = () => (
    <div 
      ref={containerRef}
      className="relative aspect-[9/10] bg-slate-950 rounded-2xl border border-slate-800/80 p-7 sm:p-8 shadow-2xl flex items-center justify-center select-none w-full"
    >
      {/* Active Board Area */}
      <div className="relative w-full h-full">
        {/* Draw Board grid lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-45" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Horizontal rows (10 rows, y = 0 to 9) */}
          {Array(10).fill(0).map((_, i) => (
            <line key={`h_${i}`} x1="0%" y1={`${i * 11.111}%`} x2="100%" y2={`${i * 11.111}%`} stroke="#cbd5e1" strokeWidth="1" />
          ))}

          {/* Vertical columns (split by river row 4.5) */}
          {Array(9).fill(0).map((_, i) => {
            if (i === 0 || i === 8) {
              return <line key={`v_${i}`} x1={`${i * 12.5}%`} y1="0%" x2={`${i * 12.5}%`} y2="100%" stroke="#cbd5e1" strokeWidth="1" />;
            } else {
              return (
                <React.Fragment key={`v_${i}`}>
                  <line x1={`${i * 12.5}%`} y1="0%" x2={`${i * 12.5}%`} y2="44.444%" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1={`${i * 12.5}%`} y1="55.556%" x2={`${i * 12.5}%`} y2="100%" stroke="#cbd5e1" strokeWidth="1" />
                </React.Fragment>
              );
            }
          })}

          {/* Diagonals for Palaces */}
          <line x1="37.5%" y1="0%" x2="62.5%" y2="22.222%" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3,3" />
          <line x1="62.5%" y1="0%" x2="37.5%" y2="22.222%" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3,3" />
          <line x1="37.5%" y1="77.778%" x2="62.5%" y2="100%" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3,3" />
          <line x1="62.5%" y1="77.778%" x2="37.5%" y2="100%" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3,3" />

          {/* River Text */}
          <text x="25%" y="51.5%" fill="rgba(255,255,255,0.25)" fontSize="6" fontWeight="bold" textAnchor="middle">楚河</text>
          <text x="75%" y="51.5%" fill="rgba(255,255,255,0.25)" fontSize="6" fontWeight="bold" textAnchor="middle">漢界</text>
        </svg>

        {/* Row labels on left/right margins (Offset -18px 避免觸壓邊線) */}
        {Array(10).fill(0).map((_, r) => {
          const top = `${(r / 9) * 100}%`;
          return (
            <React.Fragment key={`row_lbl_${r}`}>
              <span 
                className="absolute text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 pointer-events-none select-none"
                style={{ top, left: '-20px', transform: 'translateY(-50%)' }}
              >
                {r}
              </span>
              <span 
                className="absolute text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 pointer-events-none select-none"
                style={{ top, right: '-20px', transform: 'translateY(-50%)' }}
              >
                {r}
              </span>
            </React.Fragment>
          );
        })}

        {/* Col labels on top/bottom margins */}
        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((char, c) => {
          const left = `${(c / 8) * 100}%`;
          return (
            <React.Fragment key={`col_lbl_${c}`}>
              <span 
                className="absolute text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 pointer-events-none select-none"
                style={{ left, top: '-20px', transform: 'translateX(-50%)' }}
              >
                {char}
              </span>
              <span 
                className="absolute text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 pointer-events-none select-none"
                style={{ left, bottom: '-20px', transform: 'translateX(-50%)' }}
              >
                {char}
              </span>
            </React.Fragment>
          );
        })}

        {/* Active board click targets, pieces, and paths */}
        <div className="absolute inset-0 z-10">
          {/* Click catcher tiles for all 90 intersections */}
          {Array(90).fill(null).map((_, i) => {
            const row = Math.floor(i / 9);
            const col = i % 9;
            const left = `${(col / 8) * 100}%`;
            const top = `${(row / 9) * 100}%`;
            
            return (
              <div
                key={`click_${i}`}
                onClick={() => handleTileClick(i)}
                className="absolute w-[11%] h-[10%] cursor-pointer z-10"
                style={{
                  left,
                  top,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}

          {/* Pieces */}
          {board.map((piece, i) => {
            if (!piece) return null;
            const row = Math.floor(i / 9);
            const col = i % 9;
            const left = `${(col / 8) * 100}%`;
            const top = `${(row / 9) * 100}%`;
            const isSelected = selectedIdx === i;

            return (
              <div
                key={`piece_${i}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTileClick(i);
                }}
                className={`absolute aspect-square rounded-full flex items-center justify-center font-bold transition-all duration-150 border-2 select-none z-20 cursor-pointer shadow-md
                  ${fullscreen ? 'text-sm sm:text-base md:text-lg' : 'text-xs sm:text-sm md:text-base'}
                  ${isSelected 
                    ? 'scale-110 border-pink-400 z-30 shadow-[0_0_15px_#ff007f]' 
                    : 'border-slate-800'}
                  ${engine.getPieceColor(piece) === 'w' 
                    ? 'bg-gradient-to-br from-slate-900 via-slate-950 to-black text-rose-500 border-rose-500/40 hover:border-rose-400 shadow-rose-950/40' 
                    : 'bg-gradient-to-br from-slate-950 via-slate-900 to-black text-emerald-400 border-emerald-500/40 hover:border-emerald-400 shadow-emerald-950/40'}`}
                style={{
                  left,
                  top,
                  transform: 'translate(-50%, -50%)',
                  width: '10.5%',
                }}
              >
                <span>{engine.getPieceChineseName(piece)}</span>
              </div>
            );
          })}

          {/* Move Target Guide points */}
          {activeTargets.map((toIdx) => {
            const row = Math.floor(toIdx / 9);
            const col = toIdx % 9;
            const left = `${(col / 8) * 100}%`;
            const top = `${(row / 9) * 100}%`;
            const isPendingTarget = pendingVoiceMove?.to === toIdx;

            return (
              <div
                key={`target_${toIdx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTileClick(toIdx);
                }}
                className="absolute aspect-square flex items-center justify-center cursor-pointer z-30"
                style={{
                  left,
                  top,
                  transform: 'translate(-50%, -50%)',
                  width: '10%',
                }}
              >
                {isPendingTarget ? (
                  <>
                    <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-ping opacity-80 pointer-events-none" />
                    <div className="absolute w-5 h-5 bg-amber-500/40 border-2 border-amber-300 rounded-full pointer-events-none flex items-center justify-center shadow-[0_0_10px_#f59e0b]">
                      <span className="w-2 h-2 bg-amber-300 rounded-full animate-pulse" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute w-3 h-3 bg-pink-500 rounded-full animate-ping opacity-75 pointer-events-none" />
                    <div className="absolute w-2 h-2 bg-pink-500 rounded-full border border-slate-950 pointer-events-none" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Control panel jsx element (reusable)
  const renderControls = () => (
    <div className="space-y-4 flex flex-col justify-between h-full">
      {/* Title block */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-pink-500 font-semibold text-sm">
          <Activity className="w-4 h-4 text-pink-500 animate-pulse" />
          <span>聲控中國象棋 (Xiangqi Voice)</span>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-xs text-slate-400 hover:text-pink-400 font-medium flex items-center gap-1 transition-colors cursor-pointer"
        >
          <HelpIcon className="w-3.5 h-3.5" />
          <span>語音語法</span>
        </button>
      </div>

      {/* Voice Assistant Visualizer Panel */}
      <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 flex flex-col items-center space-y-2.5 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-pink-500 animate-pulse shadow-[0_0_8px_#ff6699]' : 'bg-slate-600'}`} />
          <span className="text-[11px] text-slate-400 font-mono font-bold uppercase tracking-wider">
            {isListening ? 'VOICE LISTENING' : 'VOICE ASSISTANT STANDBY'}
          </span>
        </div>

        {/* Audio Waveform */}
        <div className="flex items-end justify-center gap-[3px] h-6 w-full">
          {waveform.map((h, i) => (
            <div
              key={i}
              className="w-[3px] bg-gradient-to-t from-pink-500 to-rose-500 rounded-full transition-all duration-100"
              style={{ height: `${h * 4}%` }}
            />
          ))}
        </div>

        {/* Dynamic Transcript text box */}
        <div className="w-full text-center py-2 bg-slate-900/50 rounded-lg border border-slate-800/60 min-h-[36px] flex items-center justify-center">
          <p className="text-xs sm:text-sm text-slate-300 font-medium px-2 italic">
            {transcript ? `"${transcript}"` : '「點擊麥克風後對著我說話吧」'}
          </p>
        </div>

        {/* Mic activation button */}
        <button
          onClick={toggleListening}
          className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-90 cursor-pointer shadow-lg
            ${isListening 
              ? 'bg-pink-500 text-white shadow-pink-500/20 animate-pulse' 
              : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-pink-500'}`}
        >
          {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>

        <span className="text-[10px] text-slate-500 font-medium">
          {voiceStatusText}
        </span>
      </div>

      {/* Voice Confirmation Card */}
      {selectedIdx !== null && (
        <div className="bg-slate-950 border border-pink-500/40 rounded-xl p-3 flex flex-col gap-2 shadow-lg animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-pink-400">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
              <span>
                已選定：{board[selectedIdx] ? engine.getPieceChineseName(board[selectedIdx]!) : '棋子'}
                {` (${String.fromCharCode(65 + engine.getCoords(selectedIdx).col)}${engine.getCoords(selectedIdx).row})`}
              </span>
            </div>
            {pendingVoiceMove ? (
              <span className="text-rose-300 font-bold bg-pink-950/60 border border-pink-500/30 px-2 py-0.5 rounded text-[11px]">
                預估：{pendingVoiceMove.notation}
              </span>
            ) : (
              <span className="text-slate-400 text-[11px]">
                已高亮可移動區域，請說「落點」或「確定」
              </span>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {pendingVoiceMove ? (
              <button
                onClick={() => {
                  performMove(pendingVoiceMove.from, pendingVoiceMove.to);
                  setPendingVoiceMove(null);
                  setSelectedIdx(null);
                }}
                className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span>✅ 確定執行 (說「確定」)</span>
              </button>
            ) : null}
            <button
              onClick={() => {
                setSelectedIdx(null);
                setPendingVoiceMove(null);
                speakAnnouncement('已取消選擇');
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs py-1.5 px-3 rounded-lg transition-all cursor-pointer"
            >
              ❌ 取消 (說「取消」)
            </button>
          </div>
        </div>
      )}

      {/* Xiangqi Help Modal overlay */}
      {showHelp && (
        <div className="bg-slate-950 p-3.5 rounded-xl border border-pink-500/30 space-y-2 text-xs">
          <div className="flex justify-between items-center border-b border-slate-800 pb-1">
            <span className="font-bold text-pink-400">🗣️ 聲控語音語法</span>
            <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <ul className="space-y-1 text-slate-300 list-disc list-inside leading-relaxed scale-95 origin-left">
            <li><strong>傳統口令：</strong> [棋子][起點][動作][落點]</li>
            <li className="list-none pl-3 text-[10px] text-pink-500">例：「炮二平五」、「馬八進七」、「兵五進一」</li>
            <li className="list-none pl-3 text-[10px] text-slate-500">※ 紅方用中文字（一至九）、黑方用數字（1至9）</li>
            <li><strong>座標口令：</strong> [起點] 到 [終點]</li>
            <li className="list-none pl-3 text-[10px] text-pink-500">例：「A2 到 A5」、「B2 走到 C4」</li>
            <li><strong>控制口令：</strong> 直接說「悔棋」或「重新開始」</li>
          </ul>
        </div>
      )}

      {/* Mode settings & manual controls block */}
      <div className="space-y-2.5">
        <div className="flex gap-2">
          {/* Game Mode switch button */}
          <button
            onClick={() => {
              setGameMode(gameMode === 'ai' ? 'pvp' : 'ai');
              playSound('move');
            }}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-medium text-xs py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>模式：{gameMode === 'ai' ? '對弈電腦 (AI)' : '雙人同台 (PVP)'}</span>
          </button>
          
          <button
            onClick={handleHint}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-medium text-xs py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>求助提示</span>
          </button>
        </div>

        {/* Move History / Real-time Chess Logs */}
        <div className={`bg-slate-950 rounded-lg p-2 border border-slate-800 overflow-y-auto custom-scrollbar flex flex-col space-y-1 ${fullscreen ? 'h-[120px]' : 'h-[80px]'}`}>
          {logs.length === 0 ? (
            <p className="text-[10px] text-slate-500 italic text-center my-auto">無走棋紀錄</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex justify-between items-center text-[10px]">
                <span className={`font-semibold ${log.type === 'red' ? 'text-rose-400' : log.type === 'black' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {log.text}
                </span>
                <span className="text-[9px] text-slate-600 font-mono">{log.time}</span>
              </div>
            ))
          )}
        </div>

        {/* Action controls footer */}
        <div className="flex gap-2.5 pt-1.5 border-t border-slate-800/60">
          <button
            onClick={handleUndo}
            disabled={engine.history.length === 0}
            className="flex-1 flex items-center justify-center gap-1 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs py-2 rounded-lg disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
          >
            ↩ 悔棋 (Undo)
          </button>
          <button
            onClick={handleRestart}
            className="flex-1 flex items-center justify-center gap-1 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-pink-500" />
            <span>重新開始</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Main Render
  if (fullscreen) {
    return (
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl select-none">
        {/* Left Side: Giant Chessboard */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col items-center justify-center">
          {renderBoard()}
        </div>

        {/* Right Side: Voice Console & Controls */}
        <div className="lg:col-span-5 xl:col-span-5 w-full">
          {renderControls()}
        </div>
      </div>
    );
  }

  // Default Normal Mode (compact single column)
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-xl max-w-sm w-full mx-auto select-none flex flex-col space-y-4">
      {renderControls()}
      {renderBoard()}
    </div>
  );
}
