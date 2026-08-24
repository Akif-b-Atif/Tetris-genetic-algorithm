"""
Headless game state machine. This intentionally has no notion of real
time, soft drop, or lock delay -- a bot always computes a target final
placement and hard-drops directly into it (see design docs), so those
concepts only matter for a human-playable UI, not for this engine.
"""

from dataclasses import dataclass, field
from typing import Optional

from .board import Board, BUFFER_ROWS, WIDTH
from .bag import SevenBag
from .pieces import spawn_position, ROTATION_STATES

PIECE_INDEX = {p: i + 1 for i, p in enumerate(["I", "O", "T", "S", "Z", "J", "L"])}

LINE_SCORE = {0: 0, 1: 100, 2: 300, 3: 500, 4: 800}


@dataclass
class Placement:
    """A fully-specified move: rotate the current (or held) piece to
    `state` and drop it at `col`. `use_hold` swaps the held piece in
    before placing. `hard_drop_cells`, if given, is the drop distance
    (in cells, 2 points each) to credit -- omit it to default to the
    full spawn-to-landing distance, which is correct here since this
    engine is only ever driven by the bot, which always conceptually
    hard-drops immediately on spawn (see docs/DESIGN.md)."""
    state: int
    col: int
    use_hold: bool = False
    hard_drop_cells: Optional[int] = None


@dataclass
class StepResult:
    lines_cleared: int
    piece_placed: str
    game_over: bool
    topped_out: bool


class Game:
    def __init__(self, rng_seed=None, piece_cap=None):
        import random

        self.board = Board()
        self.bag = SevenBag(random.Random(rng_seed))
        self.queue = [self.bag.next() for _ in range(6)]
        self.current = self.queue.pop(0)
        self.queue.append(self.bag.next())
        self.hold = None
        self.hold_used = False
        self.score = 0
        self.lines_cleared_total = 0
        self.pieces_placed = 0
        self.combo = -1
        self.back_to_back = False
        self.game_over = False
        self.piece_cap = piece_cap

    def next_pieces(self, n=1):
        return self.queue[:n]

    def _refill_queue(self):
        while len(self.queue) < 6:
            self.queue.append(self.bag.next())

    def _spawn_collides(self, piece_id):
        pos = spawn_position(piece_id, WIDTH, BUFFER_ROWS)
        return self.board.collides(piece_id, 0, pos.col, pos.row)

    def apply(self, placement: Placement) -> StepResult:
        """Apply a fully-specified placement for the current piece
        (optionally swapping in the held piece first), matching the
        rules a human player would be bound by -- hold can only be
        used once between locks.
        """
        if self.game_over:
            raise RuntimeError("game already over")

        if placement.use_hold:
            if self.hold_used:
                raise ValueError("hold already used this piece")
            incoming = self.hold if self.hold is not None else self.queue.pop(0)
            self.hold = self.current
            self.current = incoming
            self.hold_used = True
            self._refill_queue()

        piece_id = self.current
        pos = spawn_position(piece_id, WIDTH, BUFFER_ROWS)
        drop_row = self.board.hard_drop_row(piece_id, placement.state, placement.col, pos.row)
        if self.board.collides(piece_id, placement.state, placement.col, drop_row):
            raise ValueError("illegal placement")

        self.board.place(piece_id, placement.state, placement.col, drop_row, PIECE_INDEX[piece_id])
        cleared = self.board.clear_lines()

        self.pieces_placed += 1
        self.lines_cleared_total += cleared

        # Line-clear score, with the Guideline's back-to-back bonus: a
        # tetris immediately following another tetris scores 1.5x. A
        # non-clearing placement doesn't break back-to-back status;
        # only clearing 1-3 lines ("a normal clear") does.
        line_score = LINE_SCORE[cleared]
        if cleared == 4:
            if self.back_to_back:
                line_score = int(line_score * 1.5)
            self.back_to_back = True
        elif cleared > 0:
            self.back_to_back = False
        self.score += line_score

        if cleared > 0:
            self.combo += 1
            self.score += max(0, self.combo) * 50
        else:
            self.combo = -1

        # Hard-drop bonus: 2 points per cell of drop distance. Defaults
        # to the full spawn-to-landing distance when not specified.
        full_distance = drop_row - pos.row
        hard_drop_cells = placement.hard_drop_cells if placement.hard_drop_cells is not None else full_distance
        self.score += max(0, hard_drop_cells) * 2

        self.current = self.queue.pop(0)
        self._refill_queue()
        self.hold_used = False

        topped_out = self.board.is_topped_out() or self._spawn_collides(self.current)
        capped = self.piece_cap is not None and self.pieces_placed >= self.piece_cap
        self.game_over = topped_out or capped
        return StepResult(cleared, piece_id, self.game_over, topped_out)
