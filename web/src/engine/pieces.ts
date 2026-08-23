/**
 * Tetromino definitions and Super Rotation System (SRS) data.
 *
 * Board convention: row 0 is the top of the grid, row index increases
 * downward, column 0 is the left wall. This is a direct port of
 * bot-trainer/engine/pieces.py -- keep the two in sync if either changes.
 */

export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const PIECE_IDS: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];

export type Cell = readonly [number, number]; // [col, row] offset

const SPAWN_SHAPES: Record<PieceId, Cell[]> = {
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
};

export const BOX_SIZE: Record<PieceId, number> = {
  I: 4, O: 2, J: 3, L: 3, S: 3, T: 3, Z: 3,
};

function rotateCw(cells: Cell[], box: number): Cell[] {
  return cells.map(([x, y]) => [box - 1 - y, x] as Cell);
}

function buildStates(piece: PieceId): Cell[][] {
  if (piece === "O") {
    const shape = SPAWN_SHAPES.O;
    return [shape, shape, shape, shape];
  }
  const box = BOX_SIZE[piece];
  const states: Cell[][] = [SPAWN_SHAPES[piece]];
  for (let i = 0; i < 3; i++) states.push(rotateCw(states[states.length - 1], box));
  return states;
}

export const ROTATION_STATES: Record<PieceId, Cell[][]> = PIECE_IDS.reduce(
  (acc, p) => ({ ...acc, [p]: buildStates(p) }),
  {} as Record<PieceId, Cell[][]>
);

type KickOffset = readonly [number, number];
type KickTable = Record<string, KickOffset[]>;

// Converted from the published SRS offsets ("+y is up") into this
// project's "+y is down" convention: drow = -dy_published.
const JLSTZ_KICKS: KickTable = {
  "0-1": [[-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "1-0": [[1, 0], [1, 1], [0, -2], [1, -2]],
  "1-2": [[1, 0], [1, 1], [0, -2], [1, -2]],
  "2-1": [[-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "2-3": [[1, 0], [1, -1], [0, 2], [1, 2]],
  "3-2": [[-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "3-0": [[-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "0-3": [[1, 0], [1, -1], [0, 2], [1, 2]],
};

const I_KICKS: KickTable = {
  "0-1": [[-2, 0], [1, 0], [-2, 1], [1, -2]],
  "1-0": [[2, 0], [-1, 0], [2, -1], [-1, 2]],
  "1-2": [[-1, 0], [2, 0], [-1, -2], [2, 1]],
  "2-1": [[1, 0], [-2, 0], [1, 2], [-2, -1]],
  "2-3": [[2, 0], [-1, 0], [2, -1], [-1, 2]],
  "3-2": [[-2, 0], [1, 0], [-2, 1], [1, -2]],
  "3-0": [[1, 0], [-2, 0], [1, 2], [-2, -1]],
  "0-3": [[-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export function kicksFor(piece: PieceId, from: number, to: number): KickOffset[] {
  if (piece === "O") return [];
  const table = piece === "I" ? I_KICKS : JLSTZ_KICKS;
  return table[`${from}-${to}`] ?? [];
}

export interface SpawnPos {
  col: number;
  row: number;
}

export function spawnPosition(piece: PieceId, boardWidth: number, bufferRows: number): SpawnPos {
  const box = BOX_SIZE[piece];
  return { col: Math.floor((boardWidth - box) / 2), row: bufferRows - 2 };
}
