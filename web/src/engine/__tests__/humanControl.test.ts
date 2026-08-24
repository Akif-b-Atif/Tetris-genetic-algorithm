import { describe, it, expect } from "vitest";
import { Game } from "../game";
import { HumanControl } from "../humanControl";

describe("HumanControl lock delay", () => {
  it("locks a grounded piece after the delay elapses even with zero further input", () => {
    const control = new HumanControl(new Game(1));
    // Drive the piece to the floor purely through gravity ticks.
    for (let i = 0; i < 200; i++) {
      control.advance(control.gravityMs);
      if (control.isOnGround()) break;
    }
    expect(control.isOnGround()).toBe(true);

    const piecesBefore = control.game.piecesPlaced;
    // No moves at all -- just let time pass past the lock delay.
    const locked = control.advance(control.lockDelayMs + 1);

    expect(locked).toBe(true);
    expect(control.game.piecesPlaced).toBe(piecesBefore + 1);
  });

  it("does not lock a piece that is still airborne", () => {
    const control = new HumanControl(new Game(2));
    const locked = control.advance(10);
    expect(locked).toBe(false);
    expect(control.game.piecesPlaced).toBe(0);
  });

  it("advance()'s 'locked' return does not itself mean the game is over -- ordinary locks must not falsely end the game", () => {
    const control = new HumanControl(new Game(11));
    for (let i = 0; i < 5; i++) {
      control.hardDrop();
      expect(control.game.gameOver).toBe(false);
    }
    expect(control.game.piecesPlaced).toBe(5);
  });
});
