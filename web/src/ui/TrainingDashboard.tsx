import { useEffect, useState } from "react";
import Panel from "./Panel";

interface GenerationStat {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  bestWeights: number[];
}

interface HistoryFile {
  weightNames: string[];
  generations: GenerationStat[];
}

export default function TrainingDashboard() {
  const [history, setHistory] = useState<HistoryFile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("./data/training_history.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setHistory)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <Panel title="No training history yet">
        <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
          Run <code>python train.py</code> inside <code>bot-trainer/</code> and copy the resulting{" "}
          <code>training_history.json</code> into <code>web/public/data/</code> to populate this
          dashboard.
        </p>
      </Panel>
    );
  }

  if (!history) return null;

  const gens = history.generations;
  const maxFitness = Math.max(...gens.map((g) => g.bestFitness), 1);
  const minFitness = Math.min(...gens.map((g) => g.worstFitness), 0);
  const w = 640;
  const h = 260;
  const padL = 44;
  const padB = 24;
  const padT = 12;
  const plotW = w - padL - 12;
  const plotH = h - padT - padB;

  const x = (i: number) => padL + (i / Math.max(gens.length - 1, 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - minFitness) / (maxFitness - minFitness || 1)) * plotH;

  const bestPath = gens.map((g, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(g.bestFitness)}`).join(" ");
  const avgPath = gens.map((g, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(g.averageFitness)}`).join(" ");

  const final = gens[gens.length - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel eyebrow={`${gens.length} generations`} title="Fitness over training">
        <svg width={w} height={h}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = minFitness + t * (maxFitness - minFitness);
            return (
              <g key={t}>
                <line x1={padL} x2={w - 12} y1={y(val)} y2={y(val)} stroke="var(--line-soft)" strokeWidth={1} />
                <text x={padL - 8} y={y(val) + 4} fontSize={10} fill="var(--text-faint)" textAnchor="end" fontFamily="var(--font-mono)">
                  {Math.round(val)}
                </text>
              </g>
            );
          })}
          <path d={avgPath} fill="none" stroke="var(--text-faint)" strokeWidth={1.5} strokeDasharray="4 3" />
          <path d={bestPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
          {gens.map((g, i) => (
            <circle key={i} cx={x(i)} cy={y(g.bestFitness)} r={2.5} fill="var(--accent)" />
          ))}
        </svg>
        <div style={{ display: "flex", gap: 16, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 4 }}>
          <span>
            <Swatch color="var(--accent)" /> best per generation
          </span>
          <span>
            <Swatch color="var(--text-faint)" dashed /> population average
          </span>
        </div>
      </Panel>

      <Panel eyebrow="Result" title={`best fitness reached: ${final.bestFitness.toFixed(0)}`}>
        <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>
          The strongest weight vector from generation {final.generation} is bundled as the default
          bot in <em>Bot match</em>. Feature and line-clear weights below are read directly from
          that individual's genome.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {history.weightNames.map((name, i) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              <span style={{ color: "var(--text-muted)" }}>{name}</span>
              <span style={{ color: final.bestWeights[i] >= 0 ? "var(--accent)" : "var(--danger)" }}>
                {final.bestWeights[i].toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: dashed ? 0 : 2,
        borderTop: dashed ? `1.5px dashed ${color}` : `2px solid ${color}`,
        marginRight: 6,
        verticalAlign: "middle",
      }}
    />
  );
}
