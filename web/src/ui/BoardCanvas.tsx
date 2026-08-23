import { useEffect, useRef } from "react";
import { Board, VISIBLE_ROWS, WIDTH, TOTAL_ROWS, BUFFER_ROWS } from "../engine/board";
import { ROTATION_STATES, PieceId } from "../engine/pieces";
import { colorForIndex, PIECE_COLORS } from "./pieceColors";

export interface ActivePiece {
  piece: PieceId;
  state: number;
  col: number;
  row: number;
  ghostRow: number;
}

interface Props {
  board: Board;
  active?: ActivePiece | null;
  cellSize?: number;
}

export default function BoardCanvas({ board, active, cellSize = 26 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // board.grid is mutated in place as the game progresses, so the Board
  // instance itself never changes identity between renders. Deriving a
  // cheap content signature (instead of depending on `board` directly)
  // is what makes this effect actually re-run every time a piece locks
  // or clears lines -- otherwise the canvas would silently stop
  // updating after the first draw, which is exactly what happened when
  // this only depended on object identity.
  const gridSignature = board.grid.map((row) => row.join("")).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = WIDTH * cellSize;
    const h = VISIBLE_ROWS * cellSize;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = "#0e1426";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#1a2138";
    ctx.lineWidth = 1;
    for (let c = 0; c <= WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize + 0.5, 0);
      ctx.lineTo(c * cellSize + 0.5, h);
      ctx.stroke();
    }
    for (let r = 0; r <= VISIBLE_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellSize + 0.5);
      ctx.lineTo(w, r * cellSize + 0.5);
      ctx.stroke();
    }

    const drawCell = (col: number, visibleRow: number, color: string, alpha = 1) => {
      if (visibleRow < 0 || visibleRow >= VISIBLE_ROWS) return;
      const x = col * cellSize;
      const y = visibleRow * cellSize;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      ctx.globalAlpha = 1;
    };

    for (let r = BUFFER_ROWS; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < WIDTH; c++) {
        const value = board.grid[r][c];
        if (value) drawCell(c, r - BUFFER_ROWS, colorForIndex(value));
      }
    }

    if (active) {
      const color = PIECE_COLORS[active.piece];
      for (const [dc, dr] of ROTATION_STATES[active.piece][active.state]) {
        drawCell(active.col + dc, active.ghostRow + dr - BUFFER_ROWS, color, 0.18);
      }
      for (const [dc, dr] of ROTATION_STATES[active.piece][active.state]) {
        drawCell(active.col + dc, active.row + dr - BUFFER_ROWS, color, 1);
      }
    }
  }, [gridSignature, active, cellSize]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        borderRadius: "var(--radius)",
        border: "1px solid var(--line)",
        display: "block",
      }}
    />
  );
}
