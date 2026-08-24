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


def _set_column_height(board, col, height):
    for r in range(TOTAL_ROWS - height, TOTAL_ROWS):
        board.grid[r][col] = 1


def test_height_variance_flat_board_is_zero():
    board = Board()
    for c in range(WIDTH):
        _set_column_height(board, c, 5)
    f = extract_features(board)
    assert f.height_variance == 0, f"expected 0 variance on a flat board, got {f.height_variance}"
    print("test_height_variance_flat_board_is_zero passed")


def test_height_variance_matches_hand_computed_value():
    # 9 columns at height 4, one column empty: mean = 3.6,
    # variance = (9 * 0.4^2 + 1 * 3.6^2) / 10 = 14.4 / 10 = 1.44
    board = Board()
    for c in range(WIDTH - 1):
        _set_column_height(board, c, 4)
    f = extract_features(board)
    expected = 1.44
    assert abs(f.height_variance - expected) < 1e-9, f"expected variance {expected}, got {f.height_variance}"
    print("test_height_variance_matches_hand_computed_value passed")


def test_height_variance_catches_gradual_slope_that_bumpiness_understates():
    # A one-sided, gradually-sloping "pillar" board: bumpiness only sees
    # small step-to-step differences and stays low, but the board is
    # still badly lopsided -- variance should be clearly high here.
    board = Board()
    heights = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    for c, h in enumerate(heights):
        _set_column_height(board, c, h)
    f = extract_features(board)
    assert f.bumpiness == 9, f"expected bumpiness 9 for a uniform 1-per-column slope, got {f.bumpiness}"
    assert f.height_variance > 8, f"expected clearly nonzero variance for a lopsided board, got {f.height_variance}"
    print("test_height_variance_catches_gradual_slope_that_bumpiness_understates passed")


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

    weights = [-0.5, -0.4, -0.3, -0.3, -0.8, -0.2, -0.2, 0.1, 1, 2, 4, 10]
    while not game.game_over:
        candidate = find_best_move(game, weights, lambda p: PIECE_INDEX[p])
        assert candidate is not None, "search should always find a legal placement on an empty-ish board"
        game.apply(candidate.placement)
    assert game.pieces_placed == 25, f"expected exactly 25 pieces placed, got {game.pieces_placed}"
    print("test_full_headless_game_runs_to_cap passed")


if __name__ == "__main__":
    test_holes_count()
    test_bumpiness_flat_board_is_zero()
    test_height_variance_flat_board_is_zero()
    test_height_variance_matches_hand_computed_value()
    test_height_variance_catches_gradual_slope_that_bumpiness_understates()
    test_line_clear_collapses_rows()
    test_full_headless_game_runs_to_cap()
    print("all tests passed")
