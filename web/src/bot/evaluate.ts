import { FEATURE_NAMES, Features, featuresAsVector } from "./features";
import { WIDTH, TOTAL_ROWS } from "../engine/board";

export const CLEAR_NAMES = ["clear_single", "clear_double", "clear_triple", "clear_tetris"] as const;
export const WEIGHT_NAMES = [...FEATURE_NAMES, ...CLEAR_NAMES];

export const FEATURE_SCALE_VERSION = "v2-normalized";

// Rough theoretical upper bound for each raw feature, derived from the
// board's own dimensions, used to rescale every board-shape feature
// into a comparable range (very roughly 0-1 for realistic boards)
// before it's weighted. This matters because the genetic algorithm's
// initial weights and mutation step size are the same absolute scale
// for every feature (see bot-trainer/ga/individual.py, the only place
// weights are actually evolved), but the raw features themselves are
// not: aggregate_height, holes, and the transition counts routinely
// reach into the tens or hundreds, while the one-hot line-clear
// features are always exactly 0 or 1. Without normalizing, a weight
// on a line-clear feature has vastly less real influence on which
// move gets picked than a weight of the same magnitude on a
// board-shape feature -- there's nothing keeping its sign or
// magnitude meaningful, since it barely moves the score either way.
// See docs/DESIGN.md for more.
const BOARD_CELLS = WIDTH * TOTAL_ROWS;
const FEATURE_SCALE: Record<string, number> = {
  aggregate_height: BOARD_CELLS,
  max_height: TOTAL_ROWS,
  bumpiness: (WIDTH - 1) * TOTAL_ROWS,
  height_variance: (TOTAL_ROWS ** 2) / 4,
  holes: BOARD_CELLS,
  row_transitions: BOARD_CELLS,
  column_transitions: BOARD_CELLS,
  well_sum: BOARD_CELLS,
};
const SCALE_VECTOR = FEATURE_NAMES.map((name) => FEATURE_SCALE[name]);

/** Weights shorter than WEIGHT_NAMES (e.g. an older saved weight vector
 * from before a feature was added) are treated as 0 for any missing
 * trailing weight, so a stale file can't crash with an out-of-bounds
 * read. Note this only prevents a crash -- if a feature was inserted
 * in the middle of FEATURE_NAMES rather than appended at the end,
 * every weight from that point on will be silently applied to the
 * wrong feature, not just missing. Retrain after any feature-set
 * change, and after any change to FEATURE_SCALE_VERSION. */
function weightAt(weights: number[], i: number): number {
  return i < weights.length ? weights[i] : 0;
}

export function evaluate(features: Features, linesCleared: number, weights: number[]): number {
  let score = 0;
  const fv = featuresAsVector(features);
  for (let i = 0; i < fv.length; i++) score += weightAt(weights, i) * (fv[i] / SCALE_VECTOR[i]);
  if (linesCleared >= 1 && linesCleared <= 4) {
    score += weightAt(weights, FEATURE_NAMES.length + (linesCleared - 1));
  }
  return score;
}
