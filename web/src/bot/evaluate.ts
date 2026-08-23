import { FEATURE_NAMES, Features, featuresAsVector } from "./features";

export const CLEAR_NAMES = ["clear_single", "clear_double", "clear_triple", "clear_tetris"] as const;
export const WEIGHT_NAMES = [...FEATURE_NAMES, ...CLEAR_NAMES];

export function evaluate(features: Features, linesCleared: number, weights: number[]): number {
  let score = 0;
  const fv = featuresAsVector(features);
  for (let i = 0; i < fv.length; i++) score += weights[i] * fv[i];
  if (linesCleared >= 1 && linesCleared <= 4) {
    score += weights[FEATURE_NAMES.length + (linesCleared - 1)];
  }
  return score;
}
