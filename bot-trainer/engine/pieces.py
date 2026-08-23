"""
Tetromino definitions and Super Rotation System (SRS) data.

Board convention used throughout this project: row 0 is the top of the
grid, row index increases downward, column 0 is the left wall. All
rotation and kick offsets below are expressed in that convention.

Each piece is defined by its four rotation states (0=spawn, R, 2, L),
where each state is a list of (col, row) cell offsets inside a bounding
box. Rotation states for J, L, S, T and Z live in a 3x3 box; I lives in
a 4x4 box; O is position-invariant and uses a single 2x2 shape.
"""

from dataclasses import dataclass

PIECE_IDS = ["I", "O", "T", "S", "Z", "J", "L"]

# Spawn-orientation cell coordinates (col, row), per the SRS spec.
_SPAWN_SHAPES = {
    "J": [(0, 0), (0, 1), (1, 1), (2, 1)],
    "L": [(2, 0), (0, 1), (1, 1), (2, 1)],
    "S": [(1, 0), (2, 0), (0, 1), (1, 1)],
    "Z": [(0, 0), (1, 0), (1, 1), (2, 1)],
    "T": [(1, 0), (0, 1), (1, 1), (2, 1)],
    "I": [(0, 1), (1, 1), (2, 1), (3, 1)],
    "O": [(0, 0), (1, 0), (0, 1), (1, 1)],
}

_BOX_SIZE = {"I": 4, "O": 2, "J": 3, "L": 3, "S": 3, "T": 3, "Z": 3}


def _rotate_cw(cells, box):
    # Standard SRS bounding-box rotation, adapted for a row-increases-
    # downward coordinate system: (x, y) -> (box-1-y, x)
    return [(box - 1 - y, x) for (x, y) in cells]


def _build_states(piece_id):
    if piece_id == "O":
        shape = _SPAWN_SHAPES["O"]
        return [shape, shape, shape, shape]
    box = _BOX_SIZE[piece_id]
    states = [_SPAWN_SHAPES[piece_id]]
    for _ in range(3):
        states.append(_rotate_cw(states[-1], box))
    return states


ROTATION_STATES = {p: _build_states(p) for p in PIECE_IDS}
BOX_SIZE = _BOX_SIZE
BOX_SIZE["O"] = 2

# Wall kick tables: (from_state, to_state) -> list of (dcol, drow) tests,
# tried in order, first non-colliding one wins. Test (0, 0) is implicit
# and always tried first by the caller. Values below are the published
# SRS offsets converted from the guideline's "+y is up" convention into
# this project's "+y is down" convention (drow = -dy_published).
_JLSTZ_KICKS = {
    (0, 1): [(-1, 0), (-1, -1), (0, 2), (-1, 2)],
    (1, 0): [(1, 0), (1, 1), (0, -2), (1, -2)],
    (1, 2): [(1, 0), (1, 1), (0, -2), (1, -2)],
    (2, 1): [(-1, 0), (-1, -1), (0, 2), (-1, 2)],
    (2, 3): [(1, 0), (1, -1), (0, 2), (1, 2)],
    (3, 2): [(-1, 0), (-1, 1), (0, -2), (-1, -2)],
    (3, 0): [(-1, 0), (-1, 1), (0, -2), (-1, -2)],
    (0, 3): [(1, 0), (1, -1), (0, 2), (1, 2)],
}

_I_KICKS = {
    (0, 1): [(-2, 0), (1, 0), (-2, 1), (1, -2)],
    (1, 0): [(2, 0), (-1, 0), (2, -1), (-1, 2)],
    (1, 2): [(-1, 0), (2, 0), (-1, -2), (2, 1)],
    (2, 1): [(1, 0), (-2, 0), (1, 2), (-2, -1)],
    (2, 3): [(2, 0), (-1, 0), (2, -1), (-1, 2)],
    (3, 2): [(-2, 0), (1, 0), (-2, 1), (1, -2)],
    (3, 0): [(1, 0), (-2, 0), (1, 2), (-2, -1)],
    (0, 3): [(-1, 0), (2, 0), (-1, -2), (2, 1)],
}


def kicks_for(piece_id, from_state, to_state):
    if piece_id == "O":
        return []
    table = _I_KICKS if piece_id == "I" else _JLSTZ_KICKS
    return table.get((from_state, to_state), [])


@dataclass(frozen=True)
class SpawnPos:
    col: int
    row: int


def spawn_position(piece_id, board_width, buffer_rows):
    box = BOX_SIZE[piece_id]
    col = (board_width - box) // 2
    row = buffer_rows - 2
    return SpawnPos(col=col, row=row)
