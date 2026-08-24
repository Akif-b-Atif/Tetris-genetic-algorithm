"""
Reduces a board to the small set of numeric features the evaluation
function scores. This is the bot's entire "vocabulary" -- everything
downstream (evaluation, fitness) is built on these numbers.
"""

from dataclasses import dataclass
from engine.board import WIDTH, TOTAL_ROWS


@dataclass
class Features:
    aggregate_height: float
    max_height: float
    bumpiness: float
    height_variance: float
    holes: float
    row_transitions: float
    column_transitions: float
    well_sum: float

    def as_vector(self):
        return [
            self.aggregate_height,
            self.max_height,
            self.bumpiness,
            self.height_variance,
            self.holes,
            self.row_transitions,
            self.column_transitions,
            self.well_sum,
        ]


FEATURE_NAMES = [
    "aggregate_height",
    "max_height",
    "bumpiness",
    "height_variance",
    "holes",
    "row_transitions",
    "column_transitions",
    "well_sum",
]


def extract_features(board) -> Features:
    heights = board.column_heights()
    aggregate_height = sum(heights)
    max_height = max(heights)
    bumpiness = sum(abs(heights[i] - heights[i + 1]) for i in range(WIDTH - 1))

    # Population variance of column heights. Distinct from bumpiness:
    # bumpiness only sees adjacent-column differences, so a board that
    # slopes gradually from tall on one side to empty on the other (a
    # "leaning tower" or pillars-on-one-side pattern) can rack up a low
    # bumpiness score, since each individual step is small, even though
    # the board as a whole is badly lopsided. Variance measures that
    # global imbalance directly.
    mean_height = sum(heights) / WIDTH
    height_variance = sum((h - mean_height) ** 2 for h in heights) / WIDTH

    holes = 0
    for c in range(WIDTH):
        seen_block = False
        for r in range(TOTAL_ROWS):
            filled = bool(board.grid[r][c])
            if filled:
                seen_block = True
            elif seen_block:
                holes += 1

    row_transitions = 0
    for r in range(TOTAL_ROWS):
        prev = 1  # virtual wall counts as filled
        for c in range(WIDTH):
            cur = 1 if board.grid[r][c] else 0
            if cur != prev:
                row_transitions += 1
            prev = cur
        if prev != 1:
            row_transitions += 1

    column_transitions = 0
    for c in range(WIDTH):
        prev = 1
        for r in range(TOTAL_ROWS):
            cur = 1 if board.grid[r][c] else 0
            if cur != prev:
                column_transitions += 1
            prev = cur

    well_sum = 0
    for c in range(WIDTH):
        left = heights[c - 1] if c > 0 else TOTAL_ROWS
        right = heights[c + 1] if c < WIDTH - 1 else TOTAL_ROWS
        depth = min(left, right) - heights[c]
        if depth > 0:
            well_sum += depth

    return Features(
        aggregate_height=aggregate_height,
        max_height=max_height,
        bumpiness=bumpiness,
        height_variance=height_variance,
        holes=holes,
        row_transitions=row_transitions,
        column_transitions=column_transitions,
        well_sum=well_sum,
    )
