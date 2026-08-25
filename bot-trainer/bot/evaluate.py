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
from engine.board import WIDTH, TOTAL_ROWS

CLEAR_NAMES = ["clear_single", "clear_double", "clear_triple", "clear_tetris"]
WEIGHT_NAMES = FEATURE_NAMES + CLEAR_NAMES

FEATURE_SCALE_VERSION = "v2-normalized"

# Rough theoretical upper bound for each raw feature, derived from the
# board's own dimensions, used to rescale every board-shape feature
# into a comparable range (very roughly 0-1 for realistic boards)
# before it's weighted. This matters because the genetic algorithm's
# initial weights and mutation step size are the same absolute scale
# for every feature (see ga/individual.py), but the raw features
# themselves are not: aggregate_height, holes, and the transition
# counts routinely reach into the tens or hundreds, while the one-hot
# line-clear features are always exactly 0 or 1. Without normalizing,
# a weight on a line-clear feature has vastly less real influence on
# which move gets picked than a weight of the same magnitude on a
# board-shape feature -- there's nothing keeping its sign or magnitude
# meaningful, since it barely moves the score either way. That
# starves evolution of any real pressure to get line-clear weights
# right, which is exactly the "why is clear_tetris negative" symptom
# this was added to fix. See docs/DESIGN.md for more.
_BOARD_CELLS = WIDTH * TOTAL_ROWS
_FEATURE_SCALE = {
    "aggregate_height": _BOARD_CELLS,
    "max_height": TOTAL_ROWS,
    "bumpiness": (WIDTH - 1) * TOTAL_ROWS,
    "height_variance": (TOTAL_ROWS ** 2) / 4,
    "holes": _BOARD_CELLS,
    "row_transitions": _BOARD_CELLS,
    "column_transitions": _BOARD_CELLS,
    "well_sum": _BOARD_CELLS,
}
_SCALE_VECTOR = [_FEATURE_SCALE[name] for name in FEATURE_NAMES]


def evaluate(features, lines_cleared: int, weights) -> float:
    """Weights shorter than WEIGHT_NAMES (e.g. an older saved weight
    vector from before a feature was added) are treated as 0 for any
    missing trailing weight, so a stale file can't crash with an
    out-of-bounds read. Note this only prevents a crash -- if a
    feature was inserted in the middle of FEATURE_NAMES rather than
    appended at the end, every weight from that point on will be
    silently applied to the wrong feature, not just missing. Retrain
    after any feature-set change, and after any change to
    FEATURE_SCALE_VERSION."""
    def w(i):
        return weights[i] if i < len(weights) else 0.0

    score = 0.0
    fv = features.as_vector()
    for i, value in enumerate(fv):
        score += w(i) * (value / _SCALE_VECTOR[i])
    if 1 <= lines_cleared <= 4:
        score += w(len(FEATURE_NAMES) + (lines_cleared - 1))
    return score
