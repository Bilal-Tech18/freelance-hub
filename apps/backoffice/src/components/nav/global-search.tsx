"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { globalSearchAction, type SearchResult } from "@/lib/actions/search";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";

const OPEN_EVENT = "open-global-search";

/** Déclencheur sidebar (desktop) : faux champ « Rechercher… ⌘K ». */
export function GlobalSearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="mx-3 mb-1 flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-2 text-sm text-emerald-100/60 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Search className="size-4" />
      Rechercher…
      <kbd className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">
        ⌘K
      </kbd>
    </button>
  );
}

/** Déclencheur compact (header mobile). */
export function GlobalSearchIconButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="ml-auto"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      aria-label="Rechercher"
    >
      <Search className="size-5" />
    </Button>
  );
}

/**
 * Palette de recherche globale (clients, projets, tickets, documents).
 * Ouverture : ⌘K / Ctrl+K, ou les déclencheurs ci-dessus.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Recherche débouncée ; l'id de requête écarte les réponses obsolètes.
  // (loading/results sont mis à jour dans onChange, jamais en synchrone ici.)
  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const found = await globalSearchAction(query).catch(() => []);
      if (requestId.current === id) {
        setResults(found);
        setActive(0);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      requestId.current++;
      setResults([]);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, { result: SearchResult; index: number }[]>();
    results.forEach((result, index) => {
      const list = groups.get(result.group) ?? [];
      list.push({ result, index });
      groups.set(result.group, list);
    });
    return groups;
  }, [results]);

  function go(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-24 translate-y-0 gap-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Recherche globale</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="size-4 shrink-0 text-muted-foreground" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Client, projet, ticket (#12), facture…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Tapez au moins 2 caractères.
            </p>
          ) : results.length === 0 && !loading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aucun résultat pour « {query} ».
            </p>
          ) : (
            Array.from(grouped.entries()).map(([group, entries]) => (
              <div key={group} className="mb-1">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {group}
                </p>
                {entries.map(({ result, index }) => (
                  <button
                    key={result.href}
                    type="button"
                    onClick={() => go(result)}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
                      index === active ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <span className="truncate font-medium">{result.label}</span>
                    <span className="shrink-0 truncate text-xs text-muted-foreground">
                      {result.sub}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
