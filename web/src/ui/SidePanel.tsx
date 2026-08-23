import { Game } from "../engine/game";
import Panel from "./Panel";
import PiecePreview from "./PiecePreview";

export default function SidePanel({ game }: { game: Game }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 168 }}>
      <Panel eyebrow="Hold">
        <div style={{ display: "flex", justifyContent: "center", minHeight: 40, alignItems: "center" }}>
          <PiecePreview piece={game.hold} dim={game.holdUsed} />
        </div>
      </Panel>
      <Panel eyebrow="Next">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {game.nextPieces(5).map((p, i) => (
            <PiecePreview key={i} piece={p} size={i === 0 ? 18 : 14} dim={i > 0} />
          ))}
        </div>
      </Panel>
      <Panel eyebrow="Score">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--amber)" }}>
          {game.score.toLocaleString()}
        </div>
      </Panel>
      <Panel eyebrow="Lines">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{game.linesClearedTotal}</div>
      </Panel>
      <Panel eyebrow="Pieces">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{game.piecesPlaced}</div>
      </Panel>
    </div>
  );
}
