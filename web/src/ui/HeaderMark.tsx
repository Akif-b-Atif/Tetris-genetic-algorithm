import { useEffect, useState } from "react";

const BLOCKS = [
  { color: "#4fd8ea", col: 0 },
  { color: "#ffd93d", col: 1 },
  { color: "#c77dff", col: 2 },
  { color: "#7cff6b", col: 3 },
  { color: "#ff6b6b", col: 4 },
  { color: "#5e8cff", col: 5 },
  { color: "#ffb454", col: 6 },
];

export default function HeaderMark() {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 50);
    return () => clearTimeout(t);
  }, []);

  const size = 14;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: size * 2, gap: 3 }} aria-hidden="true">
      {BLOCKS.map((b, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            background: b.color,
            borderRadius: 2,
            transform: settled ? "translateY(0)" : "translateY(-28px)",
            opacity: settled ? 1 : 0,
            transition: `transform 420ms cubic-bezier(.2,.8,.2,1) ${i * 45}ms, opacity 200ms ${i * 45}ms`,
          }}
        />
      ))}
    </div>
  );
}
