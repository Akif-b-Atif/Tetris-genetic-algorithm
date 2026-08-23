import { useEffect, useRef, useState, CSSProperties } from "react";
import { Game } from "../engine/game";
import { HumanControl } from "../engine/humanControl";
import BoardCanvas from "./BoardCanvas";
import SidePanel from "./SidePanel";

const GRAVITY_MS = 700;

export default function PlayMode() {
  const [, forceRender] = useState(0);
  const controlRef = useRef<HumanControl>(new HumanControl(new Game()));
  const [gameOver, setGameOver] = useState(false);

  const rerender = () => forceRender((n) => n + 1);

  const newGame = () => {
    controlRef.current = new HumanControl(new Game());
    setGameOver(false);
    rerender();
  };

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      const control = controlRef.current;
      const locked = control.tick();
      if (locked || control.game.gameOver) setGameOver(true);
      rerender();
    }, GRAVITY_MS);
    return () => clearInterval(interval);
  }, [gameOver]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver) return;
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
          e.preventDefault();
          control.hardDrop();
          break;
        case "c":
        case "Shift":
          control.hold();
          break;
        default:
          return;
      }
      if (control.game.gameOver) setGameOver(true);
      rerender();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameOver]);

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
