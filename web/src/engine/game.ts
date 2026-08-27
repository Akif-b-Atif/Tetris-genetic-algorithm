import { Board, WIDTH, BUFFER_ROWS } from "./board";
import { SevenBag, mulberry32 } from "./bag";
import { spawnPosition, PieceId, PIECE_IDS } from "./pieces";

export const PIECE_INDEX: Record<PieceId, number> = PIECE_IDS.reduce(
  (acc, p, i) => ({ ...acc, [p]: i + 1 }),
  {} as Record<PieceId, number>
);

export const LINE_SCORE: Record<number, number> = { 0: 0, 1: 100, 2: 300, 3: 500, 4: 800 };

export interface Placement {
  state: number;
  col: number;
  useHold: boolean;
  /** The exact row the piece comes to rest at. Required for any
   * placement that isn't a straight drop from spawn -- in particular
   * a piece slid or rotated sideways underneath an overhang (T-spins
   * and other tucks), whose final row can't be recovered from `state`
   * and `col` alone. Interactive play always supplies this, since it
   * already knows exactly where the live piece sits. Omit only for a
   * placement that genuinely is a straight drop from spawn in the
   * given rotation and column -- the bot's case, since its search
   * never considers tucks -- and Game.apply() will compute it the old
   * way, via a straight hard drop from spawn. */
  row?: number;
  /** Cells of hard-drop bonus (2 pts/cell) to award for this placement.
   * Omit to default to the full spawn-to-landing distance -- correct
   * for the bot, which always conceptually hard-drops immediately on
   * spawn. Interactive play passes an explicit smaller value for a
   * real hard drop from wherever the piece currently sits, and 0 for
   * an ordinary gravity-driven lock, which earns no drop bonus. */
  hardDropCells?: number;
}

export interface StepResult {
  linesCleared: number;
  piecePlaced: PieceId;
  gameOver: boolean;
  toppedOut: boolean;
}

export class Game {
  board = new Board();
  private bag: SevenBag;
  queue: PieceId[] = [];
  current: PieceId;
  hold: PieceId | null = null;
  holdUsed = false;
  score = 0;
  linesClearedTotal = 0;
  piecesPlaced = 0;
  combo = -1;
  backToBack = false;
  gameOver = false;
  piecesLockedSinceStart: PieceId[] = [];

  constructor(rngSeed?: number, public pieceCap: number | null = null) {
    this.bag = new SevenBag(rngSeed !== undefined ? mulberry32(rngSeed) : undefined);
    for (let i = 0; i < 6; i++) this.queue.push(this.bag.next());
    this.current = this.queue.shift()!;
    this.queue.push(this.bag.next());
  }

  nextPieces(n = 1): PieceId[] {
    return this.queue.slice(0, n);
  }

  private refillQueue() {
    while (this.queue.length < 6) this.queue.push(this.bag.next());
  }

  /** Swap the current piece into hold (drawing from hold/queue as
   * needed), without locking anything. Used directly by interactive
   * play; Game.apply() performs the same swap inline when a placement
   * has useHold set. Throws if hold was already used this piece. */
  holdSwap(): void {
    if (this.holdUsed) throw new Error("hold already used this piece");
    const incoming = this.hold ?? this.queue.shift()!;
    this.hold = this.current;
    this.current = incoming;
    this.holdUsed = true;
    this.refillQueue();
  }

  private spawnCollides(piece: PieceId): boolean {
    const pos = spawnPosition(piece, WIDTH, BUFFER_ROWS);
    return this.board.collides(piece, 0, pos.col, pos.row);
  }

  apply(placement: Placement): StepResult {
    if (this.gameOver) throw new Error("game already over");

    if (placement.useHold) {
      this.holdSwap();
    }

    const pieceId = this.current;
    const pos = spawnPosition(pieceId, WIDTH, BUFFER_ROWS);

    // When the caller supplies an exact row, trust it instead of
    // recomputing a straight hard drop from spawn. Recomputing here
    // would be wrong for any placement reached by moving sideways
    // under an overhang after already falling past it (T-spins and
    // other tucks): a straight drop from spawn hits the underside of
    // the overhang and stops there, several rows above the tucked
    // piece's actual resting spot -- silently teleporting the lock to
    // the top of the stack instead of into the notch the player
    // actually filled.
    const dropRow = placement.row ?? this.board.hardDropRow(pieceId, placement.state, placement.col, pos.row);
    if (this.board.collides(pieceId, placement.state, placement.col, dropRow)) {
      throw new Error("illegal placement");
    }
    // A supplied row must be an actual resting position -- blocked
    // from falling any further -- otherwise a placement could lock
    // floating above open space instead of where a real piece would
    // land.
    if (placement.row !== undefined && !this.board.collides(pieceId, placement.state, placement.col, dropRow + 1)) {
      throw new Error("illegal placement: row is not resting on a surface");
    }

    this.board.place(pieceId, placement.state, placement.col, dropRow, PIECE_INDEX[pieceId]);
    const cleared = this.board.clearLines();

    this.piecesPlaced += 1;
    this.linesClearedTotal += cleared;

    // Line-clear score, with the Guideline's back-to-back bonus: a
    // tetris immediately following another tetris scores 1.5x. A
    // non-clearing placement doesn't break back-to-back status; only
    // clearing 1-3 lines ("a normal clear") does.
    let lineScore = LINE_SCORE[cleared];
    if (cleared === 4) {
      if (this.backToBack) lineScore = Math.floor(lineScore * 1.5);
      this.backToBack = true;
    } else if (cleared > 0) {
      this.backToBack = false;
    }
    this.score += lineScore;

    if (cleared > 0) {
      this.combo += 1;
      this.score += Math.max(0, this.combo) * 50;
    } else {
      this.combo = -1;
    }

    // Hard-drop bonus: 2 points per cell of drop distance credited to
    // this placement. Defaults to the full spawn-to-landing distance
    // when the caller doesn't specify one (the bot's case).
    const fullDistance = dropRow - pos.row;
    const hardDropCells = placement.hardDropCells ?? fullDistance;
    this.score += Math.max(0, hardDropCells) * 2;

    this.piecesLockedSinceStart.push(pieceId);
    this.current = this.queue.shift()!;
    this.refillQueue();
    this.holdUsed = false;

    const toppedOut = this.board.isToppedOut() || this.spawnCollides(this.current);
    const capped = this.pieceCap !== null && this.piecesPlaced >= this.pieceCap;
    this.gameOver = toppedOut || capped;

    return { linesCleared: cleared, piecePlaced: pieceId, gameOver: this.gameOver, toppedOut };
  }
}
