import { ReactNode } from "react";

export default function Panel({
  title,
  children,
  eyebrow,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        padding: "16px",
      }}
    >
      {eyebrow && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            marginBottom: 4,
          }}
        >
          {eyebrow}
        </div>
      )}
      {title && (
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: "var(--text)" }}>{title}</div>
      )}
      {children}
    </div>
  );
}
