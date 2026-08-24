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
    """Weights shorter than WEIGHT_NAMES (e.g. an older saved weight
    vector from before a feature was added) are treated as 0 for any
    missing trailing weight, so a stale file can't crash with an
    out-of-bounds read. Note this only prevents a crash -- if a
    feature was inserted in the middle of FEATURE_NAMES rather than
    appended at the end, every weight from that point on will be
    silently applied to the wrong feature, not just missing. Retrain
    after any feature-set change."""
    def w(i):
        return weights[i] if i < len(weights) else 0.0

    score = 0.0
    fv = features.as_vector()
    for i, value in enumerate(fv):
        score += w(i) * value
    if 1 <= lines_cleared <= 4:
        score += w(len(FEATURE_NAMES) + (lines_cleared - 1))
    return score
