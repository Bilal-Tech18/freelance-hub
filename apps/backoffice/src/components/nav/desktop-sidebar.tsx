"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin:sidebar-collapsed";

/**
 * Sidebar desktop repliable : bouton de fermeture dans l'en-tête, bouton
 * flottant pour la rouvrir, état persisté dans localStorage.
 */
export function DesktopSidebar({
  brand,
  children,
  className,
}: {
  brand: React.ReactNode;
  children: React.ReactNode;
  /** Permet de surcharger le fond (ex. espace maintenance thémé). */
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem(STORAGE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col overflow-hidden text-sidebar-foreground bg-[linear-gradient(180deg,#0a1f18,#0f3b2c)] transition-[width] duration-200",
          collapsed ? "w-0" : "w-60",
          className
        )}
      >
        {/* Largeur fixe interne pour éviter l'écrasement du contenu pendant la transition. */}
        <div className="flex h-full w-60 shrink-0 flex-col" inert={collapsed}>
          <div className="flex items-center gap-2 px-4 py-3.5">
            {brand}
            <div className="ml-auto flex items-center gap-0.5">
              <ThemeToggle className="rounded-md p-1.5 text-emerald-200/60 hover:bg-white/5 hover:text-white" />
              <button
                type="button"
                onClick={toggle}
                aria-label="Masquer la barre latérale"
                className="rounded-md p-1.5 text-emerald-200/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </div>
          </div>
          {children}
        </div>
      </aside>
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Afficher la barre latérale"
          className="fixed left-3 top-3 z-40 hidden md:flex items-center justify-center rounded-md border bg-background p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}
    </>
  );
}
