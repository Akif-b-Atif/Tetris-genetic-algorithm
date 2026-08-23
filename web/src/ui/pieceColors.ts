import { PieceId } from "../engine/pieces";

export const PIECE_COLORS: Record<PieceId, string> = {
  I: "#4fd8ea",
  O: "#ffd93d",
  T: "#c77dff",
  S: "#7cff6b",
  Z: "#ff6b6b",
  J: "#5e8cff",
  L: "#ffb454",
};

export const INDEX_TO_PIECE: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];

export function colorForIndex(index: number): string {
  if (index === 0) return "transparent";
  return PIECE_COLORS[INDEX_TO_PIECE[index - 1]];
}
