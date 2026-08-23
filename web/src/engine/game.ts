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
    const dropRow = this.board.hardDropRow(pieceId, placement.state, placement.col, pos.row);
    if (this.board.collides(pieceId, placement.state, placement.col, dropRow)) {
      throw new Error("illegal placement");
    }

    this.board.place(pieceId, placement.state, placement.col, dropRow, PIECE_INDEX[pieceId]);
    const cleared = this.board.clearLines();

    this.piecesPlaced += 1;
    this.linesClearedTotal += cleared;
    this.score += LINE_SCORE[cleared];
    if (cleared > 0) {
      this.combo += 1;
      this.score += Math.max(0, this.combo) * 50;
    } else {
      this.combo = -1;
    }

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
