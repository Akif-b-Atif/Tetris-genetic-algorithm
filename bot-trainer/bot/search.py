"""
Exhaustive search over every legal final placement of the current
piece (and, as a separate branch, of the piece that would become
current after holding). Each candidate is scored with the linear
evaluation function and the highest-scoring one is returned.

This is small enough (at most 4 rotations x 10 columns per piece,
doubled for the hold branch) to search completely -- no pruning or
heuristic cutoffs are needed for a single ply.
"""

from dataclasses import dataclass
from typing import Optional

from engine.board import WIDTH, TOTAL_ROWS
from engine.pieces import ROTATION_STATES, spawn_position
from engine.board import BUFFER_ROWS
from engine.game import Placement
from .features import extract_features
from .evaluate import evaluate


@dataclass
class Candidate:
    placement: Placement
    score: float
    lines_cleared: int


def _legal_placements_for(board, piece_id):
    """Yield (state, col, drop_row) for every legal resting placement
    of `piece_id` on `board`, deduplicated by resulting cell set so
    pieces with rotational symmetry (O, S, Z) aren't scored twice."""
    seen = set()
    pos = spawn_position(piece_id, WIDTH, BUFFER_ROWS)
    for state in range(4):
        shape = ROTATION_STATES[piece_id][state]
        min_dc = min(dc for dc, _ in shape)
        max_dc = max(dc for dc, _ in shape)
        for col in range(-min_dc, WIDTH - max_dc):
            if board.collides(piece_id, state, col, pos.row):
                continue
            drop_row = board.hard_drop_row(piece_id, state, col, pos.row)
            key = frozenset((col + dc, drop_row + dr) for dc, dr in shape)
            if key in seen:
                continue
            seen.add(key)
            yield state, col, drop_row


def _best_for_piece(board, piece_id, weights, piece_index):
    best = None
    for state, col, drop_row in _legal_placements_for(board, piece_id):
        trial = board.clone()
        trial.place(piece_id, state, col, drop_row, piece_index)
        cleared = trial.clear_lines()
        features = extract_features(trial)
        score = evaluate(features, cleared, weights)
        if best is None or score > best.score:
            best = Candidate(Placement(state=state, col=col, use_hold=False), score, cleared)
    return best


def find_best_move(game, weights, piece_index_of) -> Optional[Candidate]:
    """Search both the no-hold branch (place the current piece) and the
    hold branch (swap, then place whatever becomes current), returning
    whichever scores higher overall."""
    best = _best_for_piece(game.board, game.current, weights, piece_index_of(game.current))

    hold_piece = game.hold if game.hold is not None else game.next_pieces(1)[0]
    if not game.hold_used and hold_piece != game.current:
        hold_best = _best_for_piece(game.board, hold_piece, weights, piece_index_of(hold_piece))
        if hold_best is not None and (best is None or hold_best.score > best.score):
            hold_best.placement.use_hold = True
            best = hold_best
    return best
