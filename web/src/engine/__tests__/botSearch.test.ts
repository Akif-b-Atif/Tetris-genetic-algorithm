import { describe, it, expect } from "vitest";
import { Game } from "../game";
import { findBestMove } from "../../bot/search";

describe("bot search over a full game", () => {
  it("places many pieces and the board actually accumulates filled cells", () => {
    const weights = [-0.5, -0.4, -0.3, -0.3, -0.8, -0.2, -0.2, 0.1, 1, 2, 4, 10];
    const game = new Game(3, 120);
    let steps = 0;
    while (!game.gameOver && steps < 120) {
      const candidate = findBestMove(game, weights);
      expect(candidate).not.toBeNull();
      game.apply(candidate!.placement);
      steps += 1;
    }
    expect(game.piecesPlaced).toBeGreaterThan(0);
    const filledCells = game.board.grid.flat().filter((c) => c !== 0).length;
    expect(filledCells).toBeGreaterThan(0);
  });
});
