import { useEffect, useRef, useState, CSSProperties } from "react";
import { Game } from "../engine/game";
import { HumanControl } from "../engine/humanControl";
import BoardCanvas from "./BoardCanvas";
import SidePanel from "./SidePanel";

const HANDLED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "x", "z", "c", "Shift"]);

export default function PlayMode() {
  const [, forceRender] = useState(0);
  const controlRef = useRef<HumanControl>(new HumanControl(new Game()));
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);

  const rerender = () => forceRender((n) => n + 1);

  const newGame = () => {
    controlRef.current = new HumanControl(new Game());
    gameOverRef.current = false;
    setGameOver(false);
    rerender();
  };

  // Real-time gravity/lock-delay loop. Runs every animation frame and
  // hands the actual elapsed time to advance(), rather than assuming a
  // fixed interval -- this is what makes a piece resting on the floor
  // actually lock after its grace period, even with no further input.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const delta = now - last;
      last = now;
      if (!gameOverRef.current) {
        const control = controlRef.current;
        const locked = control.advance(delta);
        if (locked || control.game.gameOver) {
          gameOverRef.current = true;
          setGameOver(true);
        }
        rerender();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!HANDLED_KEYS.has(e.key)) return;
      // Stop the browser from scrolling the page on arrow keys / space,
      // without blocking any key that isn't actually used here.
      e.preventDefault();
      if (gameOverRef.current) return;

      const control = controlRef.current;
      switch (e.key) {
        case "ArrowLeft":
          control.moveLeft();
          break;
        case "ArrowRight":
          control.moveRight();
          break;
        case "ArrowDown":
          control.softDrop();
          break;
        case "ArrowUp":
        case "x":
          control.rotate(true);
          break;
        case "z":
          control.rotate(false);
          break;
        case " ":
          control.hardDrop();
          break;
        case "c":
        case "Shift":
          control.hold();
          break;
      }
      if (control.game.gameOver) {
        gameOverRef.current = true;
        setGameOver(true);
      }
      rerender();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const control = controlRef.current;
  const game = control.game;

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <div style={{ position: "relative" }}>
        <BoardCanvas
          board={game.board}
          active={{
            piece: game.current,
            state: control.state,
            col: control.col,
            row: control.row,
            ghostRow: control.ghostRow(),
          }}
        />
        {gameOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(11,15,30,0.85)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              borderRadius: "var(--radius)",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--danger)", fontSize: 14, letterSpacing: "0.08em" }}>
              TOPPED OUT
            </div>
            <button onClick={newGame} style={buttonStyle}>
              New game
            </button>
          </div>
        )}
      </div>
      <SidePanel game={game} />
      <div style={{ maxWidth: 220, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Controls
        </div>
        <div>← → move</div>
        <div>↓ soft drop</div>
        <div>space hard drop</div>
        <div>↑ / x rotate cw</div>
        <div>z rotate ccw</div>
        <div>shift / c hold</div>
        <button onClick={newGame} style={{ ...buttonStyle, marginTop: 16 }}>
          Restart
        </button>
      </div>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  background: "var(--accent-dim)",
  color: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius)",
  padding: "8px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  cursor: "pointer",
  letterSpacing: "0.04em",
};
