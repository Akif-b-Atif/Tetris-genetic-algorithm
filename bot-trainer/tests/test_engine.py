"""
Minimal correctness checks for the engine and feature extractor,
built against hand-constructed board states with known expected
values. Run with: python tests/test_engine.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.board import Board, WIDTH, TOTAL_ROWS
from engine.game import Game, Placement
from bot.features import extract_features


def test_holes_count():
    board = Board()
    bottom = TOTAL_ROWS - 1
    # Fill the bottom row except column 3, then cap column 3 above it,
    # producing exactly one hole.
    for c in range(WIDTH):
        if c != 3:
            board.grid[bottom][c] = 1
    board.grid[bottom - 1][3] = 1
    f = extract_features(board)
    assert f.holes == 1, f"expected 1 hole, got {f.holes}"
    print("test_holes_count passed")


def test_bumpiness_flat_board_is_zero():
    board = Board()
    bottom = TOTAL_ROWS - 1
    for c in range(WIDTH):
        board.grid[bottom][c] = 1
    f = extract_features(board)
    assert f.bumpiness == 0, f"expected 0 bumpiness on a flat row, got {f.bumpiness}"
    assert f.aggregate_height == WIDTH, f"expected aggregate height {WIDTH}, got {f.aggregate_height}"
    print("test_bumpiness_flat_board_is_zero passed")


def test_line_clear_collapses_rows():
    board = Board()
    bottom = TOTAL_ROWS - 1
    for c in range(WIDTH):
        board.grid[bottom][c] = 1
    board.grid[bottom - 1][0] = 1
    cleared = board.clear_lines()
    assert cleared == 1, f"expected 1 line cleared, got {cleared}"
    assert board.grid[bottom][0] == 1, "surviving row should have shifted down"
    print("test_line_clear_collapses_rows passed")


def test_full_headless_game_runs_to_cap():
    game = Game(rng_seed=42, piece_cap=25)
    from bot.search import find_best_move
    from engine.game import PIECE_INDEX

    weights = [-0.5, -0.4, -0.3, -0.8, -0.2, -0.2, 0.1, 1, 2, 4, 10]
    while not game.game_over:
        candidate = find_best_move(game, weights, lambda p: PIECE_INDEX[p])
        assert candidate is not None, "search should always find a legal placement on an empty-ish board"
        game.apply(candidate.placement)
    assert game.pieces_placed == 25, f"expected exactly 25 pieces placed, got {game.pieces_placed}"
    print("test_full_headless_game_runs_to_cap passed")


if __name__ == "__main__":
    test_holes_count()
    test_bumpiness_flat_board_is_zero()
    test_line_clear_collapses_rows()
    test_full_headless_game_runs_to_cap()
    print("all tests passed")
