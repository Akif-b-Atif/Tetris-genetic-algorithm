import { Board, WIDTH } from "../engine/board";
import { ROTATION_STATES, spawnPosition, PieceId } from "../engine/pieces";
import { BUFFER_ROWS } from "../engine/board";
import { Game, Placement, PIECE_INDEX } from "../engine/game";
import { extractFeatures, Features } from "./features";
import { evaluate } from "./evaluate";

export interface Candidate {
  placement: Placement;
  score: number;
  linesCleared: number;
  features: Features;
}

function* legalPlacementsFor(board: Board, piece: PieceId) {
  const seen = new Set<string>();
  const pos = spawnPosition(piece, WIDTH, BUFFER_ROWS);
  for (let state = 0; state < 4; state++) {
    const shape = ROTATION_STATES[piece][state];
    const minDc = Math.min(...shape.map(([dc]) => dc));
    const maxDc = Math.max(...shape.map(([dc]) => dc));
    for (let col = -minDc; col < WIDTH - maxDc; col++) {
      if (board.collides(piece, state, col, pos.row)) continue;
      const dropRow = board.hardDropRow(piece, state, col, pos.row);
      const key = shape
        .map(([dc, dr]) => `${col + dc},${dropRow + dr}`)
        .sort()
        .join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      yield { state, col, dropRow };
    }
  }
}

function bestForPiece(board: Board, piece: PieceId, weights: number[]): Candidate | null {
  let best: Candidate | null = null;
  for (const { state, col, dropRow } of legalPlacementsFor(board, piece)) {
    const trial = board.clone();
    trial.place(piece, state, col, dropRow, PIECE_INDEX[piece]);
    const cleared = trial.clearLines();
    const features = extractFeatures(trial);
    const score = evaluate(features, cleared, weights);
    if (best === null || score > best.score) {
      best = { placement: { state, col, useHold: false }, score, linesCleared: cleared, features };
    }
  }
  return best;
}

/** Search both the no-hold branch and the hold branch, returning
 * whichever scores higher overall. */
export function findBestMove(game: Game, weights: number[]): Candidate | null {
  const best = bestForPiece(game.board, game.current, weights);

  const holdPiece = game.hold ?? game.nextPieces(1)[0];
  if (!game.holdUsed && holdPiece !== game.current) {
    const holdBest = bestForPiece(game.board, holdPiece, weights);
    if (holdBest !== null && (best === null || holdBest.score > best.score)) {
      holdBest.placement.useHold = true;
      return holdBest;
    }
  }
  return best;
}

/** Same search, but returns every candidate (sorted, best first) so
 * the UI can show runner-up placements alongside the winner. */
export function findRankedMoves(game: Game, weights: number[], limit = 3): Candidate[] {
  const out: Candidate[] = [];
  for (const useHold of [false, true]) {
    if (useHold && (game.holdUsed || (game.hold ?? game.nextPieces(1)[0]) === game.current)) continue;
    const piece = useHold ? game.hold ?? game.nextPieces(1)[0] : game.current;
    for (const { state, col, dropRow } of legalPlacementsFor(game.board, piece)) {
      const trial = game.board.clone();
      trial.place(piece, state, col, dropRow, PIECE_INDEX[piece]);
      const cleared = trial.clearLines();
      const features = extractFeatures(trial);
      const score = evaluate(features, cleared, weights);
      out.push({ placement: { state, col, useHold }, score, linesCleared: cleared, features });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
