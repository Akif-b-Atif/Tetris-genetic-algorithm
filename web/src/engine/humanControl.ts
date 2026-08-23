import { Board, WIDTH, BUFFER_ROWS } from "./board";
import { spawnPosition, kicksFor, PieceId } from "./pieces";
import { Game, Placement } from "./game";

/**
 * Wraps a Game with the extra state a human player needs that the bot
 * never does: a live falling-piece position, gravity, and a short
 * lock-delay grace period after the piece first touches down. The bot
 * skips all of this and calls Game.apply() directly with a final
 * placement.
 *
 * Gravity and lock delay are both driven by real elapsed time via
 * advance(deltaMs), called once per animation frame -- not by a fixed
 * per-move counter, so a piece resting on the ground with no further
 * input still locks after its grace period runs out.
 */
export class HumanControl {
  game: Game;
  col: number;
  row: number;
  state = 0;

  gravityMs = 700;
  lockDelayMs = 500;
  private readonly maxLockResets = 15;

  private gravityAcc = 0;
  private lockAcc = 0;
  private lockResets = 0;

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
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.lockResets = 0;
  }

  private collidesNow(col: number, row: number, state: number) {
    return this.game.board.collides(this.game.current, state, col, row);
  }

  isOnGround(): boolean {
    return this.collidesNow(this.col, this.row + 1, this.state);
  }

  /** Any successful move/rotate while grounded refreshes the lock
   * timer, up to a capped number of resets so a piece can't be kept
   * airborne-on-the-ground forever by spamming input. */
  private onSuccessfulMove() {
    if (this.isOnGround()) {
      if (this.lockResets < this.maxLockResets) {
        this.lockAcc = 0;
        this.lockResets += 1;
      }
    } else {
      this.lockAcc = 0;
      this.lockResets = 0;
    }
  }

  moveLeft() {
    if (!this.collidesNow(this.col - 1, this.row, this.state)) {
      this.col -= 1;
      this.onSuccessfulMove();
    }
  }

  moveRight() {
    if (!this.collidesNow(this.col + 1, this.row, this.state)) {
      this.col += 1;
      this.onSuccessfulMove();
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
        this.onSuccessfulMove();
        return;
      }
    }
  }

  /** Manual soft drop (holding the down key). Moves one row if legal;
   * does nothing else special -- gravity/lock timing is handled by
   * advance(). Returns whether it actually moved. */
  softDrop(): boolean {
    if (!this.collidesNow(this.col, this.row + 1, this.state)) {
      this.row += 1;
      this.gravityAcc = 0;
      this.lockAcc = 0;
      this.lockResets = 0;
      return true;
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

  /** Called once per animation frame with the elapsed milliseconds
   * since the previous call. Returns true if the piece locked (and a
   * new one spawned) this frame. */
  advance(deltaMs: number): boolean {
    if (this.isOnGround()) {
      this.lockAcc += deltaMs;
      if (this.lockAcc >= this.lockDelayMs) {
        return this.lock();
      }
    } else {
      this.gravityAcc += deltaMs;
      if (this.gravityAcc >= this.gravityMs) {
        this.gravityAcc = 0;
        this.softDrop();
      }
    }
    return false;
  }

  private lock(): boolean {
    this.game.apply({ state: this.state, col: this.col, useHold: false });
    this.resetForCurrentPiece();
    return true;
  }
}

export type { PieceId, Placement };
export { Board };
