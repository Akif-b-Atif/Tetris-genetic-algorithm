import { describe, it, expect } from "vitest";
import { Board, TOTAL_ROWS } from "../board";
import { extractFeatures, featuresAsVector } from "../../bot/features";
import { evaluate, WEIGHT_NAMES } from "../../bot/evaluate";

// This board and the expected values below were produced by running
// the equivalent construction through the Python engine
// (bot-trainer/bot/features.py + evaluate.py) and copying its exact
// printed output -- this is a real cross-language golden-value check,
// not just "the code looks the same". If either engine's math ever
// drifts, this test catches it.
function setCol(board: Board, col: number, cellsFromBottom: number[]) {
  cellsFromBottom.forEach((v, i) => {
    if (v) board.grid[TOTAL_ROWS - 1 - i][col] = 1;
  });
}

describe("cross-language parity (Python bot-trainer vs TS web)", () => {
  it("produces identical feature values and evaluation score for a hand-built board", () => {
    const board = new Board();
    setCol(board, 0, [1, 1, 1, 0, 1]);
    setCol(board, 1, [1, 1, 1]);
    setCol(board, 2, [1, 1, 1, 1, 1, 1]);
    setCol(board, 3, [1, 1]);
    setCol(board, 4, []);
    setCol(board, 5, [1, 1, 1, 1]);
    setCol(board, 6, [1]);
    setCol(board, 7, [1, 1, 1, 1, 1]);
    setCol(board, 8, [1, 1]);
    setCol(board, 9, [1, 1, 1, 1, 1, 1, 1]);

    expect(board.columnHeights()).toEqual([5, 3, 6, 2, 0, 4, 1, 5, 2, 7]);

    const f = extractFeatures(board);
    expect(f.aggregateHeight).toBe(35);
    expect(f.maxHeight).toBe(7);
    expect(f.bumpiness).toBe(30);
    expect(f.heightVariance).toBeCloseTo(4.65, 9);
    expect(f.holes).toBe(1);
    expect(f.rowTransitions).toBe(98);
    expect(f.columnTransitions).toBe(21);
    expect(f.wellSum).toBe(10);

    const weights = [0.1, -0.2, 0.15, -0.25, -0.9, -0.05, -0.07, 0.3, 1.0, 2.0, 4.0, 10.0];
    expect(WEIGHT_NAMES.length).toBe(weights.length);
    const score = evaluate(f, 2, weights);
    expect(score).toBeCloseTo(3.167499999999999, 9);
  });
});
