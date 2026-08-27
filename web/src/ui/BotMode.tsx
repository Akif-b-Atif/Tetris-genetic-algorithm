import { useEffect, useRef, useState } from "react";
import { Game } from "../engine/game";
import { findBestMove, Candidate } from "../bot/search";
import { WEIGHT_NAMES, FEATURE_SCALE_VERSION } from "../bot/evaluate";
import { featuresAsVector } from "../bot/features";
import BoardCanvas from "./BoardCanvas";
import SidePanel from "./SidePanel";
import Panel from "./Panel";

interface WeightsFile {
  weightNames: string[];
  featureScaleVersion?: string;
  weights: number[];
  fitness: number;
  trainedAt: string;
}

const SPEED_OPTIONS = [
  { label: "1x", ms: 450 },
  { label: "3x", ms: 150 },
  { label: "10x", ms: 40 },
];

export default function BotMode() {
  const [weightsFile, setWeightsFile] = useState<WeightsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceRender] = useState(0);
  const gameRef = useRef<Game>(new Game());
  const [lastCandidate, setLastCandidate] = useState<Candidate | null>(null);
  const [autoplay, setAutoplay] = useState(true);
  const [speed, setSpeed] = useState(SPEED_OPTIONS[0]);

  useEffect(() => {
    fetch("./data/best_weights.json")
      .then((r) => {
        if (!r.ok) throw new Error("no trained weights found");
        return r.json();
      })
      .then(setWeightsFile)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const rerender = () => forceRender((n) => n + 1);

  const step = () => {
    const game = gameRef.current;
    if (!weightsFile || game.gameOver) return;
    const candidate = findBestMove(game, weightsFile.weights);
    if (!candidate) return;
    game.apply(candidate.placement);
    setLastCandidate(candidate);
    rerender();
  };

  const newGame = () => {
    gameRef.current = new Game();
    setLastCandidate(null);
    rerender();
  };

  useEffect(() => {
    if (!autoplay || !weightsFile) return;
    const id = setInterval(step, speed.ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, weightsFile, speed]);

  const game = gameRef.current;

  if (error) {
    return (
      <Panel title="No trained weights yet">
        <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
          This screen loads <code>public/data/best_weights.json</code>, produced by running the
          Python trainer in <code>bot-trainer/</code>. Run <code>python train.py</code> there and
          copy its output into <code>web/public/data/</code> to see the bot play.
        </p>
      </Panel>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <div>
        <BoardCanvas board={game.board} />
        {game.gameOver && (
          <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--danger)" }}>
            topped out after {game.piecesPlaced} pieces
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setAutoplay((a) => !a)} style={buttonStyle}>
            {autoplay ? "Pause" : "Play"}
          </button>
          <button onClick={step} style={buttonStyle} disabled={game.gameOver}>
            Step
          </button>
          <button onClick={newGame} style={buttonStyle}>
            New game
          </button>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setSpeed(opt)}
              style={{
                ...buttonStyle,
                background: opt.label === speed.label ? "var(--accent-dim)" : "transparent",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <SidePanel game={game} />
      <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 12 }}>
        {weightsFile && (() => {
          const lengthMismatch = weightsFile.weights.length !== WEIGHT_NAMES.length;
          const scaleMismatch = weightsFile.featureScaleVersion !== FEATURE_SCALE_VERSION;
          if (!lengthMismatch && !scaleMismatch) return null;
          return (
            <Panel eyebrow="Stale weights file">
              <p style={{ color: "var(--amber)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                {lengthMismatch && (
                  <>
                    This weight vector has {weightsFile.weights.length} values but the current
                    feature set expects {WEIGHT_NAMES.length} -- every weight from the point of
                    mismatch onward is now applied to the wrong feature, not just missing.{" "}
                  </>
                )}
                {scaleMismatch && (
                  <>
                    This file predates feature normalization ({FEATURE_SCALE_VERSION}), so its
                    weights were tuned against raw, unnormalized feature values and will produce
                    very different (and likely much weaker) play under the current evaluation
                    function.{" "}
                  </>
                )}
                Retrain in <code>bot-trainer/</code> to get correct values for the current
                feature set.
              </p>
            </Panel>
          );
        })()}
        <Panel eyebrow="Evolved weights" title={weightsFile ? `fitness ${weightsFile.fitness.toFixed(0)}` : "loading"}>
          {weightsFile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {WEIGHT_NAMES.map((name, i) => (
                <WeightBar key={name} name={name} value={weightsFile.weights[i] ?? 0} />
              ))}
            </div>
          )}
        </Panel>
        {lastCandidate && (
          <Panel eyebrow="Last move" title={`score ${lastCandidate.score.toFixed(1)}`}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
              {featuresAsVector(lastCandidate.features).map((v, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{WEIGHT_NAMES[i]}</span>
                  {/* Fixed decimal places + a fixed-width, right-aligned
                      column: some features (like height_variance) are
                      raw floating-point divisions that can print as a
                      short integer-looking value one frame and a long
                      run of decimals the next, which otherwise makes
                      this column visibly jump around at high autoplay
                      speeds. */}
                  <span style={{ minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {v.toFixed(2)}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--amber)" }}>
                <span>lines cleared</span>
                <span style={{ minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {lastCandidate.linesCleared}
                </span>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function WeightBar({ name, value }: { name: string; value: number }) {
  const magnitude = Math.min(Math.abs(value), 3) / 3;
  const positive = value >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)" }}>
      <div style={{ width: 110, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name}
      </div>
      <div style={{ flex: 1, height: 6, background: "var(--bg-inset)", borderRadius: 3, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: positive ? "50%" : `${50 - magnitude * 50}%`,
            width: `${magnitude * 50}%`,
            background: positive ? "var(--accent)" : "var(--danger)",
            borderRadius: 3,
          }}
        />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line)" }} />
      </div>
      <div style={{ width: 40, textAlign: "right", color: "var(--text-faint)" }}>{value.toFixed(2)}</div>
    </div>
  );
}

const buttonStyle = {
  background: "transparent",
  color: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius)",
  padding: "7px 12px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  cursor: "pointer",
  letterSpacing: "0.04em",
} as const;
