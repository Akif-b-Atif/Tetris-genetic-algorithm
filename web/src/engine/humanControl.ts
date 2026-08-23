import { Board, WIDTH, BUFFER_ROWS } from "./board";
import { spawnPosition, kicksFor, PieceId } from "./pieces";
import { Game, Placement } from "./game";

/**
 * Wraps a Game with the extra state a human player needs that the
 * bot never does: a live falling-piece position, gravity ticks, and a
 * short lock-delay grace period after the piece lands. The bot skips
 * all of this and calls Game.apply() directly with a final placement.
 */
export class HumanControl {
  game: Game;
  col: number;
  row: number;
  state = 0;
  lockDelayActive = false;
  private lockDelayMoves = 0;
  private readonly maxLockDelayMoves = 15;

  constructor(game: Game) {
    this.game = game;
    const pos = spawnPosition(game.current, WIDTH, BUFFER_ROWS);
    this.col = pos.col;
    this.row = pos.row;
  }

  private resetForCurrentPiece() {
    const pos = spawnPosition(this.game.current, WIDTH, BUFFER_ROWS);
    this.col = pos.col;
    this.row = pos.row;
    this.state = 0;
    this.lockDelayActive = false;
    this.lockDelayMoves = 0;
  }

  private collidesNow(col: number, row: number, state: number) {
    return this.game.board.collides(this.game.current, state, col, row);
  }

  private noteMove() {
    if (this.lockDelayActive) this.lockDelayMoves++;
  }

  isOnGround(): boolean {
    return this.collidesNow(this.col, this.row + 1, this.state);
  }

  private syncLockDelay() {
    if (this.isOnGround()) {
      this.lockDelayActive = true;
    } else {
      this.lockDelayActive = false;
      this.lockDelayMoves = 0;
    }
  }

  moveLeft() {
    if (!this.collidesNow(this.col - 1, this.row, this.state)) {
      this.col -= 1;
      this.noteMove();
      this.syncLockDelay();
    }
  }

  moveRight() {
    if (!this.collidesNow(this.col + 1, this.row, this.state)) {
      this.col += 1;
      this.noteMove();
      this.syncLockDelay();
    }
  }

  rotate(clockwise: boolean) {
    const from = this.state;
    const to = clockwise ? (from + 1) % 4 : (from + 3) % 4;
    const tests: readonly (readonly [number, number])[] = [[0, 0] as const, ...kicksFor(this.game.current, from, to)];
    for (const [dc, dr] of tests) {
      const c = this.col + dc;
      const r = this.row + dr;
      if (!this.collidesNow(c, r, to)) {
        this.col = c;
        this.row = r;
        this.state = to;
        this.noteMove();
        this.syncLockDelay();
        return;
      }
    }
  }

  softDrop(): boolean {
    if (!this.collidesNow(this.col, this.row + 1, this.state)) {
      this.row += 1;
      this.syncLockDelay();
      return true;
    }
    this.lockDelayActive = true;
    return false;
  }

  /** Gravity tick, called on a timer. Returns true if the piece locked. */
  tick(): boolean {
    if (!this.softDrop()) {
      return this.lockDelayMoves >= this.maxLockDelayMoves ? this.lock() : false;
    }
    return false;
  }

  ghostRow(): number {
    return this.game.board.hardDropRow(this.game.current, this.state, this.col, this.row);
  }

  hardDrop() {
    this.row = this.ghostRow();
    this.lock();
  }

  hold() {
    if (this.game.holdUsed) return;
    this.game.holdSwap();
    this.resetForCurrentPiece();
  }

  private lock(): boolean {
    const result = this.game.apply({ state: this.state, col: this.col, useHold: false });
    this.resetForCurrentPiece();
    return result.gameOver;
  }
}

export type { PieceId };
export { Board };
