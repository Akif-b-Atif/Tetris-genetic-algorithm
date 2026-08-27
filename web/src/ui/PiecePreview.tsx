import { ROTATION_STATES, PieceId } from "../engine/pieces";
import { PIECE_COLORS } from "./pieceColors";

interface Props {
  piece: PieceId | null;
  size?: number;
  dim?: boolean;
}

export default function PiecePreview({ piece, size = 18, dim = false }: Props) {
  // Every tetromino's bounding box is at most 4 cells wide (I, flat)
  // and 2 cells tall (everything but I and O). Sizing the wrapper to
  // that fixed maximum -- rather than to each piece's own bounding
  // box -- means a slot's footprint never changes as the piece inside
  // it changes, so a column of these (e.g. the "Next" queue) doesn't
  // visibly grow and shrink as pieces cycle through it.
  const boxW = size * 4;
  const boxH = size * 2;

  if (!piece) {
    return <div style={{ width: boxW, height: boxH }} />;
  }
  const cells = ROTATION_STATES[piece][0];
  const minC = Math.min(...cells.map((c) => c[0]));
  const maxC = Math.max(...cells.map((c) => c[0]));
  const minR = Math.min(...cells.map((c) => c[1]));
  const maxR = Math.max(...cells.map((c) => c[1]));
  const w = maxC - minC + 1;
  const h = maxR - minR + 1;

  return (
    <div style={{ width: boxW, height: boxH, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg
        width={w * size}
        height={h * size}
        viewBox={`0 0 ${w * size} ${h * size}`}
        style={{ opacity: dim ? 0.4 : 1 }}
      >
        {cells.map(([c, r], i) => (
          <rect
            key={i}
            x={(c - minC) * size + 1}
            y={(r - minR) * size + 1}
            width={size - 2}
            height={size - 2}
            rx={2}
            fill={PIECE_COLORS[piece]}
          />
        ))}
      </svg>
    </div>
  );
}
