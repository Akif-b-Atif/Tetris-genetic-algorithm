import { describe, it, expect } from "vitest";
import { Board, TOTAL_ROWS, WIDTH } from "../board";
import { extractFeatures } from "../../bot/features";

function setColumnHeight(board: Board, col: number, height: number) {
  for (let r = TOTAL_ROWS - height; r < TOTAL_ROWS; r++) board.grid[r][col] = 1;
}

describe("height_variance feature", () => {
  it("is zero on a flat board", () => {
    const board = new Board();
    for (let c = 0; c < WIDTH; c++) setColumnHeight(board, c, 5);
    const f = extractFeatures(board);
    expect(f.heightVariance).toBe(0);
  });

  it("matches a hand-computed value", () => {
    // 9 columns at height 4, one column empty: mean = 3.6,
    // variance = (9 * 0.4^2 + 1 * 3.6^2) / 10 = 14.4 / 10 = 1.44
    const board = new Board();
    for (let c = 0; c < WIDTH - 1; c++) setColumnHeight(board, c, 4);
    const f = extractFeatures(board);
    expect(f.heightVariance).toBeCloseTo(1.44, 9);
  });

  it("catches a gradual one-sided slope that bumpiness understates", () => {
    const board = new Board();
    const heights = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    heights.forEach((h, c) => setColumnHeight(board, c, h));
    const f = extractFeatures(board);
    expect(f.bumpiness).toBe(9); // each adjacent step is 1, so bumpiness stays small
    expect(f.heightVariance).toBeGreaterThan(8); // but the board is clearly lopsided
  });
});
