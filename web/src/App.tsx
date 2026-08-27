import { useState } from "react";
import PlayMode from "./ui/PlayMode";
import BotMode from "./ui/BotMode";
import TrainingDashboard from "./ui/TrainingDashboard";
import HeaderMark from "./ui/HeaderMark";

type Tab = "play" | "bot" | "training";

const TABS: { id: Tab; label: string }[] = [
  { id: "play", label: "Play" },
  { id: "bot", label: "Bot match" },
  { id: "training", label: "Training lab" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("play");

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 32px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <HeaderMark />
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 26,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Tetris & the evolutionary bot
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, margin: "6px 0 0 0", maxWidth: 560, lineHeight: 1.5 }}>
            A guideline-compliant Tetris implementation, paired with a bot that scores every legal
            placement with a hand-designed evaluation function whose weights were evolved offline
            by a genetic algorithm.
          </p>
        </div>
        <nav style={{ display: "flex", gap: 6, background: "var(--bg-raised)", padding: 4, borderRadius: 8, border: "1px solid var(--line)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? "var(--accent-dim)" : "transparent",
                color: tab === t.id ? "var(--accent)" : "var(--text-muted)",
                border: "none",
                borderRadius: 6,
                padding: "8px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "play" && <PlayMode />}
        {tab === "bot" && <BotMode />}
        {tab === "training" && <TrainingDashboard />}
      </main>

      <footer style={{ marginTop: 32, paddingTop: 14, borderTop: "1px solid var(--line)", color: "var(--text-faint)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        Game engine and bot inference run entirely in the browser. Weights were trained offline
        with the Python genetic-algorithm trainer in <code>bot-trainer/</code>.
      </footer>
    </div>
  );
}
