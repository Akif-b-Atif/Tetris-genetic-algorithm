import { FEATURE_NAMES, Features, featuresAsVector } from "./features";

export const CLEAR_NAMES = ["clear_single", "clear_double", "clear_triple", "clear_tetris"] as const;
export const WEIGHT_NAMES = [...FEATURE_NAMES, ...CLEAR_NAMES];

/** Weights shorter than WEIGHT_NAMES (e.g. an older saved weight vector
 * from before a feature was added) are treated as 0 for any missing
 * trailing weight, so a stale file can't crash with an out-of-bounds
 * read. Note this only prevents a crash -- if a feature was inserted
 * in the middle of FEATURE_NAMES rather than appended at the end,
 * every weight from that point on will be silently applied to the
 * wrong feature, not just missing. Retrain after any feature-set
 * change. */
function weightAt(weights: number[], i: number): number {
  return i < weights.length ? weights[i] : 0;
}

export function evaluate(features: Features, linesCleared: number, weights: number[]): number {
  let score = 0;
  const fv = featuresAsVector(features);
  for (let i = 0; i < fv.length; i++) score += weightAt(weights, i) * fv[i];
  if (linesCleared >= 1 && linesCleared <= 4) {
    score += weightAt(weights, FEATURE_NAMES.length + (linesCleared - 1));
  }
  return score;
}
