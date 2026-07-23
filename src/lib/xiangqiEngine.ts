/**
 * xiangqiEngine.ts
 * Self-contained Chinese Chess (象棋) rules engine & Minimax AI.
 */

export type Piece = string; // Uppercase for Red (R,N,B,A,K,C,P), Lowercase for Black (r,n,b,a,k,c,p)
export type Color = 'w' | 'b'; // w = Red, b = Black

export interface Move {
  from: number;
  to: number;
}

export class XiangqiEngine {
  board: (Piece | null)[] = Array(90).fill(null);
  turn: Color = 'w';
  history: { board: (Piece | null)[]; turn: Color; move: Move; captured: Piece | null }[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    const initialBoard = [
      'r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r', // Row 0 (Black back line)
      null, null, null, null, null, null, null, null, null, // Row 1
      null, 'c', null, null, null, null, null, 'c', null, // Row 2 (Black cannons)
      'p', null, 'p', null, 'p', null, 'p', null, 'p', // Row 3 (Black soldiers)
      null, null, null, null, null, null, null, null, null, // Row 4
      null, null, null, null, null, null, null, null, null, // Row 5
      'P', null, 'P', null, 'P', null, 'P', null, 'P', // Row 6 (Red soldiers)
      null, 'C', null, null, null, null, null, 'C', null, // Row 7 (Red cannons)
      null, null, null, null, null, null, null, null, null, // Row 8
      'R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'  // Row 9 (Red back line)
    ];
    this.board = [...initialBoard];
    this.turn = 'w';
    this.history = [];
  }

  getIndex(row: number, col: number): number {
    return row * 9 + col;
  }

  getCoords(index: number) {
    return {
      row: Math.floor(index / 9),
      col: index % 9
    };
  }

  getPiece(row: number, col: number): Piece | null {
    return this.board[this.getIndex(row, col)];
  }

  getPieceColor(piece: Piece | null): Color | null {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? 'w' : 'b';
  }

  getPieceType(piece: Piece | null): string | null {
    if (!piece) return null;
    return piece.toLowerCase();
  }

  inBounds(row: number, col: number): boolean {
    return row >= 0 && row <= 9 && col >= 0 && col <= 8;
  }

  inPalace(row: number, col: number, color: Color): boolean {
    if (col < 3 || col > 5) return false;
    if (color === 'w') {
      return row >= 7 && row <= 9;
    } else {
      return row >= 0 && row <= 2;
    }
  }

  getPseudoLegalMoves(fromIndex: number): Move[] {
    const moves: Move[] = [];
    const piece = this.board[fromIndex];
    if (!piece) return moves;

    const color = this.getPieceColor(piece)!;
    const type = this.getPieceType(piece)!;
    const { row, col } = this.getCoords(fromIndex);

    const addMoveIfValid = (toRow: number, toCol: number): boolean => {
      if (!this.inBounds(toRow, toCol)) return false;
      const targetIndex = this.getIndex(toRow, toCol);
      const targetPiece = this.board[targetIndex];
      if (targetPiece && this.getPieceColor(targetPiece) === color) {
        return false;
      }
      moves.push({ from: fromIndex, to: targetIndex });
      return true;
    };

    switch (type) {
      case 'k': { // King
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
          const nr = row + dr;
          const nc = col + dc;
          if (this.inPalace(nr, nc, color)) {
            addMoveIfValid(nr, nc);
          }
        }
        break;
      }
      case 'a': { // Advisor
        const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of diagonals) {
          const nr = row + dr;
          const nc = col + dc;
          if (this.inPalace(nr, nc, color)) {
            addMoveIfValid(nr, nc);
          }
        }
        break;
      }
      case 'b': { // Elephant
        const diagonals = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
        for (const [dr, dc] of diagonals) {
          const nr = row + dr;
          const nc = col + dc;
          if (color === 'w' && nr < 5) continue;
          if (color === 'b' && nr > 4) continue;

          if (this.inBounds(nr, nc)) {
            const eyeRow = row + dr / 2;
            const eyeCol = col + dc / 2;
            if (this.getPiece(eyeRow, eyeCol) === null) {
              addMoveIfValid(nr, nc);
            }
          }
        }
        break;
      }
      case 'n': { // Horse
        const jumps = [
          [-2, -1], [-2, 1], [2, -1], [2, 1],
          [-1, -2], [1, -2], [-1, 2], [1, 2]
        ];
        for (const [dr, dc] of jumps) {
          const nr = row + dr;
          const nc = col + dc;
          if (this.inBounds(nr, nc)) {
            let legRow = row;
            let legCol = col;
            if (Math.abs(dr) === 2) {
              legRow += dr / 2;
            } else {
              legCol += dc / 2;
            }
            if (this.getPiece(legRow, legCol) === null) {
              addMoveIfValid(nr, nc);
            }
          }
        }
        break;
      }
      case 'r': { // Chariot
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
          let nr = row + dr;
          let nc = col + dc;
          while (this.inBounds(nr, nc)) {
            const targetPiece = this.getPiece(nr, nc);
            if (targetPiece === null) {
              addMoveIfValid(nr, nc);
            } else {
              if (this.getPieceColor(targetPiece) !== color) {
                addMoveIfValid(nr, nc);
              }
              break;
            }
            nr += dr;
            nc += dc;
          }
        }
        break;
      }
      case 'c': { // Cannon
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
          let nr = row + dr;
          let nc = col + dc;
          let screenFound = false;
          while (this.inBounds(nr, nc)) {
            const targetPiece = this.getPiece(nr, nc);
            if (!screenFound) {
              if (targetPiece === null) {
                addMoveIfValid(nr, nc);
              } else {
                screenFound = true;
              }
            } else {
              if (targetPiece !== null) {
                if (this.getPieceColor(targetPiece) !== color) {
                  addMoveIfValid(nr, nc);
                }
                break;
              }
            }
            nr += dr;
            nc += dc;
          }
        }
        break;
      }
      case 'p': { // Soldier
        const direction = (color === 'w') ? -1 : 1;
        addMoveIfValid(row + direction, col);
        const crossedRiver = (color === 'w') ? (row <= 4) : (row >= 5);
        if (crossedRiver) {
          addMoveIfValid(row, col - 1);
          addMoveIfValid(row, col + 1);
        }
        break;
      }
    }
    return moves;
  }

  getAllPseudoLegalMoves(color: Color = this.turn): Move[] {
    let moves: Move[] = [];
    for (let i = 0; i < 90; i++) {
      const piece = this.board[i];
      if (piece && this.getPieceColor(piece) === color) {
        moves = moves.concat(this.getPseudoLegalMoves(i));
      }
    }
    return moves;
  }

  findKing(color: Color): number {
    const kingChar = (color === 'w') ? 'K' : 'k';
    for (let i = 0; i < 90; i++) {
      if (this.board[i] === kingChar) return i;
    }
    return -1;
  }

  areKingsFacingDirectly(): boolean {
    const redKingIdx = this.findKing('w');
    const blackKingIdx = this.findKing('b');
    if (redKingIdx === -1 || blackKingIdx === -1) return false;

    const rk = this.getCoords(redKingIdx);
    const bk = this.getCoords(blackKingIdx);

    if (rk.col !== bk.col) return false;

    const startRow = Math.min(rk.row, bk.row);
    const endRow = Math.max(rk.row, bk.row);
    for (let r = startRow + 1; r < endRow; r++) {
      if (this.getPiece(r, rk.col) !== null) {
        return false;
      }
    }
    return true;
  }

  isCheck(color: Color = this.turn): boolean {
    const kingIndex = this.findKing(color);
    if (kingIndex === -1) return false;

    const opponentColor = (color === 'w') ? 'b' : 'w';
    if (this.areKingsFacingDirectly()) return true;

    const opponentMoves = this.getAllPseudoLegalMoves(opponentColor);
    for (const move of opponentMoves) {
      if (move.to === kingIndex) return true;
    }
    return false;
  }

  isMoveLegal(fromIndex: number, toIndex: number): boolean {
    const piece = this.board[fromIndex];
    if (!piece) return false;
    const color = this.getPieceColor(piece)!;
    if (color !== this.turn) return false;

    const pseudoMoves = this.getPseudoLegalMoves(fromIndex);
    if (!pseudoMoves.some(m => m.to === toIndex)) return false;

    const savedBoard = [...this.board];
    this.board[toIndex] = piece;
    this.board[fromIndex] = null;

    const illegal = this.areKingsFacingDirectly() || this.isCheck(color);
    this.board = savedBoard;

    return !illegal;
  }

  generateLegalMoves(): Move[] {
    const legalMoves: Move[] = [];
    const color = this.turn;
    for (let i = 0; i < 90; i++) {
      const piece = this.board[i];
      if (piece && this.getPieceColor(piece) === color) {
        const pseudoMoves = this.getPseudoLegalMoves(i);
        for (const move of pseudoMoves) {
          if (this.isMoveLegal(move.from, move.to)) {
            legalMoves.push(move);
          }
        }
      }
    }
    return legalMoves;
  }

  move(fromIndex: number, toIndex: number): boolean {
    if (!this.isMoveLegal(fromIndex, toIndex)) return false;

    const piece = this.board[fromIndex];
    const captured = this.board[toIndex];

    this.history.push({
      board: [...this.board],
      turn: this.turn,
      move: { from: fromIndex, to: toIndex },
      captured
    });

    this.board[toIndex] = piece;
    this.board[fromIndex] = null;
    this.turn = (this.turn === 'w') ? 'b' : 'w';

    return true;
  }

  undo(): Move | null {
    if (this.history.length === 0) return null;
    const lastState = this.history.pop()!;
    this.board = lastState.board;
    this.turn = lastState.turn;
    return lastState.move;
  }

  isCheckmate(): boolean {
    if (!this.isCheck(this.turn)) return false;
    return this.generateLegalMoves().length === 0;
  }

  isStalemate(): boolean {
    if (this.isCheck(this.turn)) return false;
    return this.generateLegalMoves().length === 0;
  }

  getPieceChineseName(piece: Piece | null): string {
    if (!piece) return '';
    const nameMap: Record<string, string> = {
      'K': '帥', 'A': '仕', 'B': '相', 'N': '傌', 'R': '俥', 'C': '砲', 'P': '兵',
      'k': '將', 'a': '士', 'b': '象', 'n': '馬', 'r': '車', 'c': '砲', 'p': '卒'
    };
    return nameMap[piece] || '';
  }

  formatMoveTraditional(fromIndex: number, toIndex: number): string {
    const piece = this.board[fromIndex];
    if (!piece) return '';
    const color = this.getPieceColor(piece)!;
    const type = this.getPieceType(piece)!;
    const from = this.getCoords(fromIndex);
    const to = this.getCoords(toIndex);

    const pieceName = this.getPieceChineseName(piece);
    let startColName = '';
    if (color === 'w') {
      startColName = ['九', '八', '七', '六', '五', '四', '三', '二', '一'][from.col];
    } else {
      startColName = ['1', '2', '3', '4', '5', '6', '7', '8', '9'][from.col];
    }

    let direction = '';
    const dy = to.row - from.row;
    if (color === 'w') {
      if (dy < 0) direction = '進';
      else if (dy > 0) direction = '退';
      else direction = '平';
    } else {
      if (dy > 0) direction = '進';
      else if (dy < 0) direction = '退';
      else direction = '平';
    }

    let endName = '';
    const isDiagonalPiece = ['a', 'b', 'n'].includes(type);

    if (direction === '平') {
      if (color === 'w') {
        endName = ['九', '八', '七', '六', '五', '四', '三', '二', '一'][to.col];
      } else {
        endName = ['1', '2', '3', '4', '5', '6', '7', '8', '9'][to.col];
      }
    } else {
      if (isDiagonalPiece) {
        if (color === 'w') {
          endName = ['九', '八', '七', '六', '五', '四', '三', '二', '一'][to.col];
        } else {
          endName = ['1', '2', '3', '4', '5', '6', '7', '8', '9'][to.col];
        }
      } else {
        const distance = Math.abs(dy);
        if (color === 'w') {
          endName = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][distance];
        } else {
          endName = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'][distance];
        }
      }
    }

    return `${pieceName}${startColName}${direction}${endName}`;
  }
}

// Alpha-Beta Search AI Evaluator
export class XiangqiAI {
  PIECE_VALUES: Record<string, number> = {
    'k': 10000, 'K': 10000,
    'r': 900,   'R': 900,
    'c': 450,   'C': 450,
    'n': 400,   'N': 400,
    'b': 200,   'B': 200,
    'a': 200,   'A': 200,
    'p': 100,   'P': 100
  };

  RED_P_POSITION = [
    [0,  3,  6,  9, 12,  9,  6,  3,  0],
    [18, 36, 54, 72, 80, 72, 54, 36, 18],
    [14, 28, 42, 56, 60, 56, 42, 28, 14],
    [10, 20, 30, 40, 50, 40, 30, 20, 10],
    [6,  12, 18, 24, 30, 24, 18, 12,  6],
    [0,   0,  0,  0,  0,  0,  0,  0,  0],
    [0,   0,  0,  0,  0,  0,  0,  0,  0],
    [0,   0,  0,  0,  0,  0,  0,  0,  0],
    [0,   0,  0,  0,  0,  0,  0,  0,  0],
    [0,   0,  0,  0,  0,  0,  0,  0,  0]
  ];

  BLACK_P_POSITION = [...this.RED_P_POSITION].reverse();

  HORSE_POSITION = [
    [ 0, -4, -2,  0,  0,  0, -2, -4,  0],
    [ 0,  2,  4,  6,  4,  6,  4,  2,  0],
    [ 2,  4,  8, 10,  8, 10,  8,  4,  2],
    [ 4,  6, 10, 12, 14, 12, 10,  6,  4],
    [ 4,  8, 12, 14, 16, 14, 12,  8,  4],
    [ 4,  8, 12, 14, 16, 14, 12,  8,  4],
    [ 4,  6, 10, 12, 14, 12, 10,  6,  4],
    [ 2,  4,  8, 10,  8, 10,  8,  4,  2],
    [ 0,  2,  4,  6,  4,  6,  4,  2,  0],
    [ 0, -4, -2,  0,  0,  0, -2, -4,  0]
  ];

  evaluate(engine: XiangqiEngine): number {
    let score = 0;
    for (let i = 0; i < 90; i++) {
      const piece = engine.board[i];
      if (!piece) continue;

      const color = piece === piece.toUpperCase() ? 'w' : 'b';
      const type = piece.toLowerCase();
      let value = this.PIECE_VALUES[piece] || 0;

      const row = Math.floor(i / 9);
      const col = i % 9;

      if (type === 'p') {
        if (color === 'w') {
          value += this.RED_P_POSITION[row][col];
        } else {
          value += this.BLACK_P_POSITION[row][col];
        }
      } else if (type === 'n') {
        value += this.HORSE_POSITION[row][col];
      } else if (type === 'r') {
        value += (col >= 3 && col <= 5) ? 15 : 5;
      } else if (type === 'c') {
        value += (row === 2 || row === 7) ? 10 : 0;
      }

      if (color === 'w') {
        score += value;
      } else {
        score -= value;
      }
    }
    return score;
  }

  getBestMove(engine: XiangqiEngine, depth = 2): Move | null {
    const color = engine.turn;
    const moves = engine.generateLegalMoves();
    if (moves.length === 0) return null;

    moves.sort(() => Math.random() - 0.5);

    let bestMove: Move | null = null;
    let alpha = -Infinity;
    let beta = Infinity;

    if (color === 'w') {
      let maxScore = -Infinity;
      for (const move of moves) {
        const savedBoard = [...engine.board];
        engine.board[move.to] = engine.board[move.from];
        engine.board[move.from] = null;

        const score = this.minimax(engine, depth - 1, alpha, beta, false);
        engine.board = savedBoard;

        if (score > maxScore) {
          maxScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
    } else {
      let minScore = Infinity;
      for (const move of moves) {
        const savedBoard = [...engine.board];
        engine.board[move.to] = engine.board[move.from];
        engine.board[move.from] = null;

        const score = this.minimax(engine, depth - 1, alpha, beta, true);
        engine.board = savedBoard;

        if (score < minScore) {
          minScore = score;
          bestMove = move;
        }
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
    }

    return bestMove;
  }

  minimax(engine: XiangqiEngine, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    if (depth === 0) {
      return this.evaluate(engine);
    }

    const redKing = engine.findKing('w');
    const blackKing = engine.findKing('b');
    if (redKing === -1) return -100000;
    if (blackKing === -1) return 100000;

    const movingColor = isMaximizing ? 'w' : 'b';
    const moves = engine.getAllPseudoLegalMoves(movingColor);

    if (moves.length === 0) {
      if (engine.isCheck(movingColor)) {
        return isMaximizing ? -100000 : 100000;
      }
      return 0;
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        const targetPiece = engine.board[move.to];
        engine.board[move.to] = engine.board[move.from];
        engine.board[move.from] = null;

        const illegal = engine.areKingsFacingDirectly();
        let score = 0;
        if (!illegal) {
          score = this.minimax(engine, depth - 1, alpha, beta, false);
        } else {
          score = -90000;
        }

        engine.board[move.from] = engine.board[move.to];
        engine.board[move.to] = targetPiece;

        if (!illegal) {
          maxScore = Math.max(maxScore, score);
          alpha = Math.max(alpha, score);
          if (beta <= alpha) break;
        }
      }
      return maxScore === -Infinity ? -100000 : maxScore;
    } else {
      let minScore = Infinity;
      for (const move of moves) {
        const targetPiece = engine.board[move.to];
        engine.board[move.to] = engine.board[move.from];
        engine.board[move.from] = null;

        const illegal = engine.areKingsFacingDirectly();
        let score = 0;
        if (!illegal) {
          score = this.minimax(engine, depth - 1, alpha, beta, true);
        } else {
          score = 90000;
        }

        engine.board[move.from] = engine.board[move.to];
        engine.board[move.to] = targetPiece;

        if (!illegal) {
          minScore = Math.min(minScore, score);
          beta = Math.min(beta, score);
          if (beta <= alpha) break;
        }
      }
      return minScore === Infinity ? 100000 : minScore;
    }
  }
}
