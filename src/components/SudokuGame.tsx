import React, { useState, useEffect } from 'react';
import { RotateCcw, HelpCircle, Eraser, PenTool, Undo, Play, Trophy, Sparkles, Brain, Check, RefreshCw } from 'lucide-react';

interface SudokuCell {
  row: number;
  col: number;
  value: number;       // The correct solution value
  current: number;     // The user's input (0 for empty)
  isOriginal: boolean; // Is it pre-filled?
  notes: number[];     // Pencil draft notes
}

// Highly reliable Sudoku solved template base
const BASE_SOLVED = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [4, 5, 6, 7, 8, 9, 1, 2, 3],
  [7, 8, 9, 1, 2, 3, 4, 5, 6],
  [2, 3, 1, 5, 6, 4, 8, 9, 7],
  [5, 6, 4, 8, 9, 7, 2, 3, 1],
  [8, 9, 7, 2, 3, 1, 5, 6, 4],
  [3, 1, 2, 6, 4, 5, 9, 7, 8],
  [6, 4, 5, 9, 7, 8, 3, 1, 2],
  [9, 7, 8, 3, 1, 2, 6, 4, 5]
];

export default function SudokuGame() {
  const [board, setBoard] = useState<SudokuCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [isPencilMode, setIsPencilMode] = useState(false);
  const [history, setHistory] = useState<SudokuCell[][]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showConflicts, setShowConflicts] = useState(true);
  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem('sudoku_highscore') || '0');
  });

  // Dynamic Synthesizer Audio generator
  const playSynthSound = (freq: number, type: 'sine' | 'triangle' | 'sawtooth' | 'square' = 'sine', duration = 0.15) => {
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

  // Generate Sudoku puzzle via mathematically sound shuffling of our solved template
  const generatePuzzle = (diff: 'easy' | 'medium' | 'hard') => {
    // 1. Create copy of base solved
    let grid = BASE_SOLVED.map(row => [...row]);

    // 2. Perform safe shuffles (swapping rows/cols within blocks, and mapping values)
    // Map values: e.g. shuffle digits 1-9 to new digits 1-9
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    grid = grid.map(row => row.map(val => digits[val - 1]));

    // Swap row groups / column groups (within 3x3 blocks)
    const swapRows = (r1: number, r2: number) => {
      const temp = grid[r1];
      grid[r1] = grid[r2];
      grid[r2] = temp;
    };

    const swapCols = (c1: number, c2: number) => {
      for (let r = 0; r < 9; r++) {
        const temp = grid[r][c1];
        grid[r][c1] = grid[r][c2];
        grid[r][c2] = temp;
      }
    };

    // Swap columns in block 0
    if (Math.random() > 0.5) swapCols(0, 1);
    if (Math.random() > 0.5) swapCols(1, 2);
    // Swap columns in block 1
    if (Math.random() > 0.5) swapCols(3, 4);
    if (Math.random() > 0.5) swapCols(4, 5);
    // Swap columns in block 2
    if (Math.random() > 0.5) swapCols(6, 7);
    if (Math.random() > 0.5) swapCols(7, 8);

    // Swap rows in block 0
    if (Math.random() > 0.5) swapRows(0, 1);
    if (Math.random() > 0.5) swapRows(1, 2);
    // Swap rows in block 1
    if (Math.random() > 0.5) swapRows(3, 4);
    if (Math.random() > 0.5) swapRows(4, 5);
    // Swap rows in block 2
    if (Math.random() > 0.5) swapRows(6, 7);
    if (Math.random() > 0.5) swapRows(7, 8);

    // 3. Mask cells depending on difficulty
    // Easy: ~35 masks (46 given). Medium: ~46 masks (35 given). Hard: ~53 masks (28 given)
    let masksCount = 35;
    if (diff === 'medium') masksCount = 46;
    if (diff === 'hard') masksCount = 53;

    const cellsList: { r: number; c: number }[] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cellsList.push({ r, c });
      }
    }

    // Shuffle cells to pick mask positions
    for (let i = cellsList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cellsList[i], cellsList[j]] = [cellsList[j], cellsList[i]];
    }

    // Build final cell objects
    const finalCells: SudokuCell[] = [];
    const maskedSet = new Set(cellsList.slice(0, masksCount).map(cell => `${cell.r}-${cell.c}`));

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const isMasked = maskedSet.has(`${r}-${c}`);
        finalCells.push({
          row: r,
          col: c,
          value: grid[r][c],
          current: isMasked ? 0 : grid[r][c],
          isOriginal: !isMasked,
          notes: []
        });
      }
    }

    setBoard(finalCells);
    setMistakes(0);
    setScore(0);
    setTimer(0);
    setHistory([]);
    setSelectedCell(null);
  };

  const handleStartGame = () => {
    generatePuzzle(difficulty);
    setIsPlaying(true);
    playSynthSound(523.25, 'sine', 0.25); // C5 Chime
    setTimeout(() => playSynthSound(659.25, 'sine', 0.2), 100); // E5
    setTimeout(() => playSynthSound(783.99, 'sine', 0.3), 200); // G5
  };

  // Timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Save historical move
  const pushHistory = (currentBoard: SudokuCell[]) => {
    const deepCopy = currentBoard.map(c => ({ ...c, notes: [...c.notes] }));
    setHistory(prev => [...prev, deepCopy]);
  };

  // Undo move
  const handleUndo = () => {
    if (history.length === 0) return;
    playSynthSound(440, 'triangle', 0.1);
    const previous = history[history.length - 1];
    setBoard(previous);
    setHistory(prev => prev.slice(0, prev.length - 1));
  };

  // Input value handler (numbers 1-9)
  const handleNumberInput = (num: number) => {
    if (!isPlaying || !selectedCell) return;

    const targetCell = board.find(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (!targetCell || targetCell.isOriginal) return;

    pushHistory(board);

    if (isPencilMode) {
      // Toggle note drafting
      playSynthSound(700, 'triangle', 0.08);
      const updated = board.map(c => {
        if (c.row === selectedCell.row && c.col === selectedCell.col) {
          const notes = c.notes.includes(num)
            ? c.notes.filter(n => n !== num)
            : [...c.notes, num].sort();
          return { ...c, current: 0, notes }; // Note forces cell value to 0
        }
        return c;
      });
      setBoard(updated);
    } else {
      // Place main value
      const isCorrect = num === targetCell.value;
      if (isCorrect) {
        playSynthSound(880, 'sine', 0.15); // Happy high pitch
        // Gain score based on speed/difficulty
        const points = difficulty === 'easy' ? 50 : difficulty === 'medium' ? 100 : 150;
        setScore(prev => prev + points);
      } else {
        playSynthSound(180, 'sawtooth', 0.3); // Low buzzer warning
        setMistakes(prev => {
          const next = prev + 1;
          if (next >= 3) {
            // GameOver
            setIsPlaying(false);
            playSynthSound(120, 'sawtooth', 0.5);
            if (score > highScore) {
              setHighScore(score);
              localStorage.setItem('sudoku_highscore', score.toString());
            }
          }
          return next;
        });
      }

      const updated = board.map(c => {
        if (c.row === selectedCell.row && c.col === selectedCell.col) {
          return { ...c, current: num, notes: [] }; // Fill value, wipe pencil notes
        }
        return c;
      });
      setBoard(updated);

      // Check for win condition
      const isComplete = updated.every(c => c.current === c.value);
      if (isComplete) {
        setIsPlaying(false);
        playSynthSound(1046.5, 'sine', 0.3); // High win chime arpeggio
        setTimeout(() => playSynthSound(1318.5, 'sine', 0.3), 150);
        setTimeout(() => playSynthSound(1568, 'sine', 0.4), 300);
        
        // Save highscore
        const winBonus = 500;
        const finalScore = score + winBonus;
        setScore(finalScore);
        if (finalScore > highScore) {
          setHighScore(finalScore);
          localStorage.setItem('sudoku_highscore', finalScore.toString());
        }
      }
    }
  };

  // Erase current cell value/notes
  const handleErase = () => {
    if (!isPlaying || !selectedCell) return;
    const targetCell = board.find(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (!targetCell || targetCell.isOriginal) return;

    pushHistory(board);
    playSynthSound(350, 'triangle', 0.1);

    setBoard(board.map(c => {
      if (c.row === selectedCell.row && c.col === selectedCell.col) {
        return { ...c, current: 0, notes: [] };
      }
      return c;
    }));
  };

  // Provide a correct value hint
  const handleHint = () => {
    if (!isPlaying || !selectedCell) return;
    const targetCell = board.find(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (!targetCell || targetCell.isOriginal) return;

    pushHistory(board);
    playSynthSound(987.77, 'sine', 0.25); // Celestial hint noise

    // Penalty for hint
    setScore(prev => Math.max(0, prev - 30));

    setBoard(board.map(c => {
      if (c.row === selectedCell.row && c.col === selectedCell.col) {
        return { ...c, current: c.value, notes: [] };
      }
      return c;
    }));
  };

  // Dynamic formatting of elapsed timer
  const formatTime = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Compute duplicate conflicts for highlighting
  const hasConflict = (cell: SudokuCell) => {
    if (!showConflicts || cell.current === 0) return false;
    
    // Find if duplicate value exists in same row, column or 3x3 block
    const duplicates = board.filter(c => {
      // Exclude self
      if (c.row === cell.row && c.col === cell.col) return false;
      if (c.current !== cell.current) return false;

      // Same row
      if (c.row === cell.row) return true;
      // Same col
      if (c.col === cell.col) return true;
      // Same 3x3 Block
      const bRow = Math.floor(cell.row / 3);
      const bCol = Math.floor(cell.col / 3);
      const cbRow = Math.floor(c.row / 3);
      const cbCol = Math.floor(c.col / 3);
      return bRow === cbRow && bCol === cbCol;
    });

    return duplicates.length > 0;
  };

  // Highlight helper for selected cell context (peer lines/same values)
  const getCellHighlightClass = (cell: SudokuCell) => {
    if (!selectedCell) return '';
    const isSelected = selectedCell.row === cell.row && selectedCell.col === cell.col;
    if (isSelected) {
      return 'bg-pink-500/30 border-pink-400 ring-2 ring-pink-500 shadow-[0_0_12px_rgba(255,102,153,0.3)] z-10 scale-102';
    }

    const sameRow = selectedCell.row === cell.row;
    const sameCol = selectedCell.col === cell.col;
    
    // Check same 3x3 block
    const bRow = Math.floor(selectedCell.row / 3);
    const bCol = Math.floor(selectedCell.col / 3);
    const cbRow = Math.floor(cell.row / 3);
    const cbCol = Math.floor(cell.col / 3);
    const sameBlock = bRow === cbRow && bCol === cbCol;

    if (sameRow || sameCol || sameBlock) {
      return 'bg-slate-900/40 border-slate-800/80';
    }

    // Highlight identical values on the board
    const selectedTarget = board.find(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (selectedTarget && selectedTarget.current !== 0 && selectedTarget.current === cell.current) {
      return 'bg-pink-950/40 text-pink-300 border-pink-800/60';
    }

    return '';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-xl max-w-sm w-full mx-auto select-none">
      {/* Header Panel */}
      <div className="flex items-center justify-between mb-3.5 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-pink-500 font-semibold text-sm">
          <Brain className="w-4 h-4 text-pink-500 animate-pulse" />
          <span>經典智力數獨 (Sudoku Classic)</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>High: {highScore}</span>
        </div>
      </div>

      {!isPlaying ? (
        <div className="flex flex-col items-center justify-center h-[290px] bg-slate-950/80 rounded-xl border border-dashed border-slate-800 p-4 text-center space-y-4">
          <div className="bg-pink-500/10 p-3.5 rounded-full text-pink-500 animate-pulse">
            <Brain className="w-8 h-8" />
          </div>
          
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white">開啟邏輯思維的拼圖旅程</h4>
            <p className="text-[11px] text-slate-400 max-w-[240px] mx-auto leading-normal">
              經典數學拼圖，每行、每列以及每個 3x3 九宮格中填入 1-9 的數字，不可重複！
            </p>
          </div>

          {/* Difficulty Pickers */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 gap-1 text-[10px] font-bold">
            {(['easy', 'medium', 'hard'] as const).map(diff => (
              <button
                key={diff}
                onClick={() => {
                  setDifficulty(diff);
                  playSynthSound(400, 'sine', 0.08);
                }}
                className={`px-3 py-1 rounded transition-colors uppercase cursor-pointer
                  ${difficulty === diff 
                    ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20' 
                    : 'text-slate-400 hover:text-white'}`}
              >
                {diff === 'easy' ? '簡單' : diff === 'medium' ? '中等' : '困難'}
              </button>
            ))}
          </div>

          <button
            onClick={handleStartGame}
            className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-lg hover:shadow-pink-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>開始新局 (Start Sudoku)</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Status HUD Info */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/70 rounded-lg p-1.5 border border-slate-800/60">
              <span className="block text-[9px] text-slate-500 uppercase tracking-tight">得分 Score</span>
              <span className="text-xs font-bold text-pink-400 font-mono">{score}</span>
            </div>
            <div className="bg-slate-950/70 rounded-lg p-1.5 border border-slate-800/60">
              <span className="block text-[9px] text-slate-500 uppercase tracking-tight">失誤 Mistakes</span>
              <span className={`text-xs font-bold font-mono ${mistakes > 1 ? 'text-rose-500 animate-pulse' : 'text-slate-300'}`}>
                {mistakes} / 3
              </span>
            </div>
            <div className="bg-slate-950/70 rounded-lg p-1.5 border border-slate-800/60 relative overflow-hidden">
              <span className="block text-[9px] text-slate-500 uppercase tracking-tight">時間 Timer</span>
              <span className="text-xs font-bold text-sky-400 font-mono">{formatTime(timer)}</span>
            </div>
          </div>

          {/* Sudoku Grid */}
          <div className="grid grid-cols-9 gap-[1px] bg-slate-800 p-1.5 rounded-xl border border-slate-850 shadow-inner relative overflow-hidden">
            {board.map((cell) => {
              const isCellConflict = hasConflict(cell);
              const highlightClass = getCellHighlightClass(cell);
              const isOriginal = cell.isOriginal;
              
              // Determine border thickness for 3x3 grids
              const borderRightClass = (cell.col % 3 === 2 && cell.col !== 8) ? 'border-r-2 border-r-slate-700' : '';
              const borderBottomClass = (cell.row % 3 === 2 && cell.row !== 8) ? 'border-b-2 border-b-slate-700' : '';

              return (
                <div
                  key={`${cell.row}-${cell.col}`}
                  onClick={() => {
                    setSelectedCell({ row: cell.row, col: cell.col });
                    playSynthSound(600, 'sine', 0.05);
                  }}
                  className={`aspect-square flex flex-col items-center justify-center text-center text-xs font-bold relative transition-all duration-150 cursor-pointer select-none
                    ${borderRightClass} ${borderBottomClass}
                    ${isOriginal 
                      ? 'bg-slate-950/90 text-slate-300' 
                      : cell.current !== 0 
                        ? (cell.current === cell.value ? 'bg-slate-950 text-sky-400 font-black' : 'bg-slate-950 text-rose-500 line-through font-extrabold')
                        : 'bg-slate-950 text-slate-500 font-medium'
                    }
                    ${isCellConflict ? 'bg-rose-950/40 text-rose-500 animate-pulse' : ''}
                    ${highlightClass}
                  `}
                >
                  {/* Notes Layer or Value Display */}
                  {cell.current !== 0 ? (
                    <span className="text-sm scale-110">{cell.current}</span>
                  ) : cell.notes.length > 0 ? (
                    <div className="grid grid-cols-3 gap-[1px] absolute inset-0.5 p-[1px] text-[7px] leading-none text-pink-400/80 font-mono font-medium">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <span key={n} className="flex items-center justify-center">
                          {cell.notes.includes(n) ? n : ''}
                        </span>
                      ))}
                    </div>
                  ) : (
                    ''
                  )}
                </div>
              );
            })}
          </div>

          {/* Core Controller Keypad */}
          <div className="space-y-2">
            {/* Action Tool Buttons */}
            <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95
                  ${history.length > 0 
                    ? 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800' 
                    : 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'}`}
                title="撤銷上一步"
              >
                <Undo className="w-3 h-3 text-sky-400" />
                <span>復原</span>
              </button>

              <button
                onClick={handleErase}
                disabled={!selectedCell}
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95
                  ${selectedCell 
                    ? 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800' 
                    : 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'}`}
                title="清除選中格數字"
              >
                <Eraser className="w-3 h-3 text-pink-400" />
                <span>清除</span>
              </button>

              <button
                onClick={() => {
                  setIsPencilMode(!isPencilMode);
                  playSynthSound(isPencilMode ? 400 : 500, 'sine', 0.1);
                }}
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95
                  ${isPencilMode 
                    ? 'bg-pink-500 border-pink-400 text-white shadow-md shadow-pink-500/10' 
                    : 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                title="開啟/關閉草稿筆記模式"
              >
                <PenTool className="w-3 h-3 text-yellow-400" />
                <span>草稿 {isPencilMode ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={handleHint}
                disabled={!selectedCell}
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95
                  ${selectedCell 
                    ? 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800' 
                    : 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'}`}
                title="扣除30積分揭曉正解"
              >
                <HelpCircle className="w-3 h-3 text-emerald-400" />
                <span>提示 Hint</span>
              </button>
            </div>

            {/* Numbers pad 1-9 */}
            <div className="grid grid-cols-9 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberInput(num)}
                  disabled={!selectedCell}
                  className={`aspect-square rounded-lg flex items-center justify-center font-bold text-sm transition-all active:scale-90
                    ${selectedCell 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer hover:border-pink-500/50 hover:scale-105 border border-slate-700/50' 
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-850'
                    }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Validation options & Resetter */}
            <div className="flex gap-2 justify-between items-center text-[10px] text-slate-400 font-medium bg-slate-950/60 p-2 rounded-lg border border-slate-850">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showConflicts}
                  onChange={(e) => {
                    setShowConflicts(e.target.checked);
                    playSynthSound(450, 'sine', 0.05);
                  }}
                  className="rounded border-slate-800 text-pink-500 focus:ring-0 w-3 h-3 cursor-pointer bg-slate-900"
                />
                <span>即時衝突標記 (Highlight Error)</span>
              </label>

              <button
                onClick={handleStartGame}
                className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 hover:text-white px-2 py-1 rounded border border-slate-800 transition-all active:scale-95 cursor-pointer font-bold"
              >
                <RotateCcw className="w-3 h-3 text-sky-400" />
                <span>重開一局</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
