"""
Scores a candidate resulting board with a simple linear combination of
its features. Line clears are one-hot encoded (clear_single ..
clear_tetris) rather than folded into a single 0-4 "lines cleared"
feature, specifically so the genetic algorithm can discover that a
four-line clear is worth disproportionately more than four single
clears -- a single linear weight on a 0-4 count could never express
that on its own.
"""

from .features import FEATURE_NAMES

CLEAR_NAMES = ["clear_single", "clear_double", "clear_triple", "clear_tetris"]
WEIGHT_NAMES = FEATURE_NAMES + CLEAR_NAMES


def evaluate(features, lines_cleared: int, weights) -> float:
    score = 0.0
    fv = features.as_vector()
    for i, value in enumerate(fv):
        score += weights[i] * value
    if 1 <= lines_cleared <= 4:
        score += weights[len(FEATURE_NAMES) + (lines_cleared - 1)]
    return score
