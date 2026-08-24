import { Board, WIDTH, TOTAL_ROWS } from "../engine/board";

export interface Features {
  aggregateHeight: number;
  maxHeight: number;
  bumpiness: number;
  heightVariance: number;
  holes: number;
  rowTransitions: number;
  columnTransitions: number;
  wellSum: number;
}

export const FEATURE_NAMES = [
  "aggregate_height",
  "max_height",
  "bumpiness",
  "height_variance",
  "holes",
  "row_transitions",
  "column_transitions",
  "well_sum",
] as const;

export function featuresAsVector(f: Features): number[] {
  return [
    f.aggregateHeight,
    f.maxHeight,
    f.bumpiness,
    f.heightVariance,
    f.holes,
    f.rowTransitions,
    f.columnTransitions,
    f.wellSum,
  ];
}

export function extractFeatures(board: Board): Features {
  const heights = board.columnHeights();
  const aggregateHeight = heights.reduce((a, b) => a + b, 0);
  const maxHeight = Math.max(...heights);
  let bumpiness = 0;
  for (let i = 0; i < WIDTH - 1; i++) bumpiness += Math.abs(heights[i] - heights[i + 1]);

  // Population variance of column heights. Distinct from bumpiness:
  // bumpiness only sees adjacent-column differences, so a board that
  // slopes gradually from tall on one side to empty on the other (a
  // "leaning tower" or pillars-on-one-side pattern) can rack up a low
  // bumpiness score, since each individual step is small, even though
  // the board as a whole is badly lopsided. Variance measures that
  // global imbalance directly.
  const meanHeight = heights.reduce((a, b) => a + b, 0) / WIDTH;
  const heightVariance = heights.reduce((acc, h) => acc + (h - meanHeight) ** 2, 0) / WIDTH;

  let holes = 0;
  for (let c = 0; c < WIDTH; c++) {
    let seenBlock = false;
    for (let r = 0; r < TOTAL_ROWS; r++) {
      const filled = board.grid[r][c] !== 0;
      if (filled) seenBlock = true;
      else if (seenBlock) holes++;
    }
  }

  let rowTransitions = 0;
  for (let r = 0; r < TOTAL_ROWS; r++) {
    let prev = 1;
    for (let c = 0; c < WIDTH; c++) {
      const cur = board.grid[r][c] ? 1 : 0;
      if (cur !== prev) rowTransitions++;
      prev = cur;
    }
    if (prev !== 1) rowTransitions++;
  }

  let columnTransitions = 0;
  for (let c = 0; c < WIDTH; c++) {
    let prev = 1;
    for (let r = 0; r < TOTAL_ROWS; r++) {
      const cur = board.grid[r][c] ? 1 : 0;
      if (cur !== prev) columnTransitions++;
      prev = cur;
    }
  }

  let wellSum = 0;
  for (let c = 0; c < WIDTH; c++) {
    const left = c > 0 ? heights[c - 1] : TOTAL_ROWS;
    const right = c < WIDTH - 1 ? heights[c + 1] : TOTAL_ROWS;
    const depth = Math.min(left, right) - heights[c];
    if (depth > 0) wellSum += depth;
  }

  return { aggregateHeight, maxHeight, bumpiness, heightVariance, holes, rowTransitions, columnTransitions, wellSum };
}
