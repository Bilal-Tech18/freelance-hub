import type { CSSProperties } from "react";

// Recharts impose un tooltip blanc et un curseur gris fixes : on les cale sur
// les tokens du thème pour rester lisible en clair comme en sombre.
export const tooltipTheme = {
  contentStyle: {
    backgroundColor: "var(--popover)",
    borderColor: "var(--border)",
    borderRadius: "0.5rem",
    color: "var(--popover-foreground)",
  } satisfies CSSProperties,
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 500 } satisfies CSSProperties,
  cursor: { fill: "var(--muted)", stroke: "var(--border)" },
};
