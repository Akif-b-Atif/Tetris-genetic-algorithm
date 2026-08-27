import { describe, it, expect } from "vitest";
import { Game } from "../game";
import { HumanControl } from "../humanControl";
import { TOTAL_ROWS } from "../board";

describe("regression: tucking a piece under an overhang", () => {
  it("locks where the piece actually is, not where a straight drop from spawn would land", () => {
    const game = new Game(3, 50);
    (game as any).current = "I";

    // A single suspended block: the underside of an overhang directly
    // above board column 3. A vertical I dropped straight down that
    // column from spawn cannot pass it.
    const overhangRow = 29;
    game.board.grid[overhangRow][3] = 1;
    // A landing ledge in the adjacent, fully open column 2, well below
    // the overhang's row, so the piece can come to rest there first.
    game.board.grid[35][2] = 1;

    const control = new HumanControl(game);
    control.rotate(true); // vertical orientation: fixed column offset +2 from control.col

    control.col = 0; // occupies board column 2
    control.row = 5;
    while (!control.isOnGround()) control.row += 1;
    const restRow = control.row;
    expect(restRow).toBeGreaterThan(overhangRow); // resting well below the overhang's row

    // Slide sideways into board column 3, already below the overhang.
    control.moveRight();
    expect(control.col).toBe(1); // occupies board column 3
    expect(control.row).toBe(restRow); // unchanged by the slide

    // The true floor beneath is open; the piece should keep falling
    // all the way down, not lock immediately where it's standing.
    control.hardDrop();

    const bottom = TOTAL_ROWS - 1;
    expect(game.board.grid[bottom][3]).not.toBe(0); // reached the true floor
    expect(game.board.grid[overhangRow - 1][3]).toBe(0); // did NOT stack on the overhang
  });

  it("rejects an explicit row that isn't actually resting on anything", () => {
    const game = new Game(4, 50);
    (game as any).current = "O"; // empty board, floating placement
    expect(() => game.apply({ state: 0, col: 0, row: 0, useHold: false })).toThrow(
      /not resting on a surface/
    );
  });
});
