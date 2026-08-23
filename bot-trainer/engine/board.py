"""
Board grid and the low-level operations every other layer builds on:
collision testing, placing a piece, and clearing completed lines.
"""

from .pieces import ROTATION_STATES, BOX_SIZE

VISIBLE_ROWS = 20
BUFFER_ROWS = 20
TOTAL_ROWS = VISIBLE_ROWS + BUFFER_ROWS
WIDTH = 10


class Board:
    def __init__(self):
        self.grid = [[0] * WIDTH for _ in range(TOTAL_ROWS)]

    def clone(self):
        b = Board()
        b.grid = [row[:] for row in self.grid]
        return b

    def cell(self, col, row):
        if row < 0 or row >= TOTAL_ROWS or col < 0 or col >= WIDTH:
            return 1  # out of bounds counts as occupied
        return self.grid[row][col]

    def collides(self, piece_id, state, col, row):
        for (dc, dr) in ROTATION_STATES[piece_id][state]:
            c, r = col + dc, row + dr
            if c < 0 or c >= WIDTH or r >= TOTAL_ROWS:
                return True
            if r >= 0 and self.grid[r][c]:
                return True
        return False

    def hard_drop_row(self, piece_id, state, col, row):
        """Simulate gravity: return the lowest legal row for this
        (piece, rotation state, column), starting the search from `row`.
        This is the single drop routine reused by both real hard-drops
        and the bot's search, so the two can never drift out of sync.
        """
        r = row
        while not self.collides(piece_id, state, col, r + 1):
            r += 1
        return r

    def place(self, piece_id, state, col, row, piece_index):
        for (dc, dr) in ROTATION_STATES[piece_id][state]:
            c, r = col + dc, row + dr
            if 0 <= r < TOTAL_ROWS:
                self.grid[r][c] = piece_index

    def clear_lines(self):
        remaining = [row for row in self.grid if any(cell == 0 for cell in row)]
        cleared = TOTAL_ROWS - len(remaining)
        while len(remaining) < TOTAL_ROWS:
            remaining.insert(0, [0] * WIDTH)
        self.grid = remaining
        return cleared

    def column_heights(self):
        heights = [0] * WIDTH
        for c in range(WIDTH):
            for r in range(TOTAL_ROWS):
                if self.grid[r][c]:
                    heights[c] = TOTAL_ROWS - r
                    break
        return heights

    def is_topped_out(self):
        # Anything filled at or above the spawn buffer's top edge.
        return any(self.grid[0][c] for c in range(WIDTH))
