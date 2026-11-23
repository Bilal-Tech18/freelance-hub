// Palette personnalisée de l'espace maintenance : 4 couleurs stockées sur
// User.palette, déclinées en variables CSS (clair + sombre) par-dessus la DA
// par défaut. Module pur (pas de "server-only") : utilisé par le layout
// serveur et par le formulaire de paramètres.

export type Palette = { c1: string; c2: string; c3: string; c4: string };

/** Palette par défaut de Nelly (prune → rose → crème). */
export const DEFAULT_MAINTENANCE_PALETTE: Palette = {
  c1: "#601D49",
  c2: "#BD5579",
  c3: "#EA9D9D",
  c4: "#FFEBB8",
};

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Relit User.palette (Json) en Palette valide, sinon palette par défaut. */
export function parsePalette(raw: unknown): Palette {
  if (raw && typeof raw === "object") {
    const p = raw as Record<string, unknown>;
    const keys = ["c1", "c2", "c3", "c4"] as const;
    if (keys.every((k) => typeof p[k] === "string" && HEX_RE.test(p[k] as string))) {
      return { c1: p.c1, c2: p.c2, c3: p.c3, c4: p.c4 } as Palette;
    }
  }
  return DEFAULT_MAINTENANCE_PALETTE;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mélange a → b (ratio 0 = a, 1 = b). */
export function mix(a: string, b: string, ratio: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([
    ar + (br - ar) * ratio,
    ag + (bg - ag) * ratio,
    ab + (bb - ab) * ratio,
  ]);
}

/** Luminance approx. pour choisir un texte lisible sur une couleur. */
function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

/**
 * Décline la palette en overrides des variables du thème (globals.css).
 * c1 = couleur forte (primaire / sidebar), c2 = accent vif, c3 = teinte douce,
 * c4 = surbrillance claire.
 */
export function buildMaintenanceThemeCss(p: Palette): string {
  const white = "#ffffff";
  const black = "#000000";
  const c1Fg = isDark(p.c1) ? white : black;

  const light = {
    "--primary": p.c1,
    "--primary-foreground": c1Fg,
    "--secondary": mix(p.c4, white, 0.5),
    "--secondary-foreground": mix(p.c1, black, 0.2),
    "--accent": mix(p.c3, white, 0.65),
    "--accent-foreground": mix(p.c1, black, 0.1),
    "--muted": mix(p.c3, white, 0.82),
    "--muted-foreground": mix(p.c1, white, 0.25),
    "--border": mix(p.c3, white, 0.6),
    "--input": mix(p.c3, white, 0.45),
    "--ring": p.c2,
    "--chart-1": p.c1,
    "--chart-2": p.c2,
    "--chart-3": p.c3,
    "--chart-4": mix(p.c4, black, 0.15),
    "--sidebar": mix(p.c1, black, 0.35),
    "--sidebar-foreground": mix(p.c3, white, 0.35),
    "--sidebar-primary": p.c2,
    "--sidebar-primary-foreground": white,
    "--sidebar-accent": mix(p.c1, white, 0.12),
    "--sidebar-accent-foreground": white,
    "--sidebar-border": mix(p.c1, black, 0.15),
    "--sidebar-ring": p.c2,
  };

  const dark = {
    "--background": mix(p.c1, black, 0.82),
    "--foreground": mix(p.c3, white, 0.6),
    "--card": mix(p.c1, black, 0.68),
    "--card-foreground": mix(p.c3, white, 0.6),
    "--popover": mix(p.c1, black, 0.68),
    "--popover-foreground": mix(p.c3, white, 0.6),
    "--primary": p.c3,
    "--primary-foreground": mix(p.c1, black, 0.5),
    "--secondary": mix(p.c1, black, 0.45),
    "--secondary-foreground": mix(p.c3, white, 0.6),
    "--muted": mix(p.c1, black, 0.6),
    "--muted-foreground": mix(p.c3, white, 0.2),
    "--accent": mix(p.c1, black, 0.4),
    "--accent-foreground": white,
    "--border": mix(p.c1, black, 0.35),
    "--input": mix(p.c1, black, 0.25),
    "--ring": p.c3,
    "--chart-1": p.c2,
    "--chart-2": p.c3,
    "--chart-3": p.c4,
    "--chart-4": mix(p.c2, white, 0.3),
    "--sidebar": mix(p.c1, black, 0.88),
    "--sidebar-foreground": mix(p.c3, white, 0.35),
    "--sidebar-primary": p.c3,
    "--sidebar-primary-foreground": mix(p.c1, black, 0.5),
    "--sidebar-accent": mix(p.c1, black, 0.55),
    "--sidebar-accent-foreground": white,
    "--sidebar-border": mix(p.c1, black, 0.6),
    "--sidebar-ring": p.c3,
  };

  const vars = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");

  return `:root { ${vars(light)} } .dark { ${vars(dark)} }`;
}
