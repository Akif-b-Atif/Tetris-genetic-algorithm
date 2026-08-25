import { describe, it, expect } from "vitest";
import { Board, TOTAL_ROWS } from "../board";
import { extractFeatures } from "../../bot/features";
import { evaluate, WEIGHT_NAMES } from "../../bot/evaluate";
import { FEATURE_NAMES } from "../../bot/features";

function setColumnHeight(board: Board, col: number, height: number) {
  for (let r = TOTAL_ROWS - height; r < TOTAL_ROWS; r++) board.grid[r][col] = 1;
}

describe("feature normalization", () => {
  it("brings board-shape features to a scale comparable with line-clear features", () => {
    // Same moderately built-up, moderately messy board as the Python
    // engine's equivalent test, cross-checked to agree.
    const board = new Board();
    [6, 5, 7, 4, 5, 6, 5, 4, 6, 5].forEach((h, c) => setColumnHeight(board, c, h));
    board.grid[TOTAL_ROWS - 3][2] = 0; // punch one hole in

    const f = extractFeatures(board);

    FEATURE_NAMES.forEach((name, i) => {
      const unitWeights = new Array(WEIGHT_NAMES.length).fill(0);
      unitWeights[i] = 1;
      const contribution = evaluate(f, 0, unitWeights);
      expect(
        Math.abs(contribution),
        `unit weight on '${name}' contributed ${contribution}, expected roughly comparable to a line-clear feature's max contribution of 1`
      ).toBeLessThan(5);
    });
  });
});
