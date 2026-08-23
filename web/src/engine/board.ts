import { ROTATION_STATES, PieceId } from "./pieces";

export const VISIBLE_ROWS = 20;
export const BUFFER_ROWS = 20;
export const TOTAL_ROWS = VISIBLE_ROWS + BUFFER_ROWS;
export const WIDTH = 10;

export type Grid = number[][]; // 0 = empty, else piece index (1-7)

export class Board {
  grid: Grid;

  constructor(grid?: Grid) {
    this.grid = grid ?? Array.from({ length: TOTAL_ROWS }, () => new Array(WIDTH).fill(0));
  }

  clone(): Board {
    return new Board(this.grid.map((row) => row.slice()));
  }

  collides(piece: PieceId, state: number, col: number, row: number): boolean {
    for (const [dc, dr] of ROTATION_STATES[piece][state]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= WIDTH || r >= TOTAL_ROWS) return true;
      if (r >= 0 && this.grid[r][c]) return true;
    }
    return false;
  }

  /** Simulate gravity: the single drop routine reused by real hard
   * drops and the bot's search, so the two can never drift apart. */
  hardDropRow(piece: PieceId, state: number, col: number, row: number): number {
    let r = row;
    while (!this.collides(piece, state, col, r + 1)) r++;
    return r;
  }

  place(piece: PieceId, state: number, col: number, row: number, pieceIndex: number): void {
    for (const [dc, dr] of ROTATION_STATES[piece][state]) {
      const c = col + dc;
      const r = row + dr;
      if (r >= 0 && r < TOTAL_ROWS) this.grid[r][c] = pieceIndex;
    }
  }

  clearLines(): number {
    const remaining = this.grid.filter((row) => row.some((cell) => cell === 0));
    const cleared = TOTAL_ROWS - remaining.length;
    while (remaining.length < TOTAL_ROWS) remaining.unshift(new Array(WIDTH).fill(0));
    this.grid = remaining;
    return cleared;
  }

  columnHeights(): number[] {
    const heights = new Array(WIDTH).fill(0);
    for (let c = 0; c < WIDTH; c++) {
      for (let r = 0; r < TOTAL_ROWS; r++) {
        if (this.grid[r][c]) {
          heights[c] = TOTAL_ROWS - r;
          break;
        }
      }
    }
    return heights;
  }

  isToppedOut(): boolean {
    return this.grid[0].some((cell) => cell !== 0);
  }
}
