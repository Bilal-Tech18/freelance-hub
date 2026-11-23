"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bascule clair/sombre. Les deux icônes sont rendues et affichées via CSS
 * (`dark:`) : le markup ne dépend pas du thème, donc pas de mismatch
 * d'hydratation ni de flash au chargement.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Basculer le mode nuit"
      className={cn(
        "inline-flex items-center justify-center transition-colors",
        className
      )}
    >
      <Sun className="size-4 hidden dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  );
}
