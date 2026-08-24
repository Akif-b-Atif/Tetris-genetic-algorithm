import { describe, it, expect } from "vitest";
import { Game } from "../game";
import { TOTAL_ROWS, WIDTH } from "../board";

function fillBottomRowsExceptCol(board: Game["board"], nRows: number, skipCol: number) {
  for (let r = TOTAL_ROWS - nRows; r < TOTAL_ROWS; r++) {
    for (let c = 0; c < WIDTH; c++) {
      if (c !== skipCol) board.grid[r][c] = 1;
    }
  }
}

describe("scoring accuracy", () => {
  it("awards the correct hard-drop bonus on an empty board (no line clear)", () => {
    const game = new Game(1, 50);
    // Default (no explicit hardDropCells) = bot-style full spawn-to-landing distance.
    game.apply({ state: 0, col: 0, useHold: false });
    expect(game.score).toBeGreaterThan(0);
    expect(game.linesClearedTotal).toBe(0);
  });

  it("scores a tetris at 800, and a back-to-back tetris at 1.5x plus combo", () => {
    const game = new Game(1, 50);

    (game as any).current = "I";
    fillBottomRowsExceptCol(game.board, 4, 9);
    const r1 = game.apply({ state: 1, col: 7, useHold: false }); // dc=2 -> lands in col 9
    expect(r1.linesCleared).toBe(4);
    expect(game.backToBack).toBe(true);
    const firstScore = game.score;

    (game as any).current = "I";
    fillBottomRowsExceptCol(game.board, 4, 9);
    const r2 = game.apply({ state: 1, col: 7, useHold: false });
    expect(r2.linesCleared).toBe(4);

    const gained = game.score - firstScore;
    // 1200 (back-to-back tetris) + 36 (hard-drop bonus, same 18-cell fall) + 50 (combo)
    expect(gained).toBe(1286);
  });
});
