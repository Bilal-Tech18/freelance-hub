"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";

export type DataTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean; // défaut : true
  className?: string;
};

export type DataTableRow = {
  id: string;
  href?: string;
  /** Contenu affiché, par clé de colonne. */
  cells: Record<string, React.ReactNode>;
  /** Valeurs brutes pour le tri (nombre ou chaîne), par clé de colonne. */
  sortValues: Record<string, string | number>;
  /** Texte concaténé pour la barre de recherche. */
  searchText: string;
  /** Valeurs pour les filtres par select, par clé de filtre. */
  filterValues?: Record<string, string>;
};

export type DataTableFilter = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

const ALL = "__all";

type PersistedState = {
  query: string;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  filterState: Record<string, string>;
};

/**
 * Tableau générique : recherche plein texte, filtres par select et tri
 * par colonne (clic sur l'en-tête : croissant → décroissant).
 * Les cellules sont rendues côté serveur et passées telles quelles.
 */
export function DataTable({
  columns,
  rows,
  filters = [],
  searchPlaceholder = "Rechercher…",
  initialSort,
  emptyMessage = "Aucun résultat.",
  storageKey,
}: {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  filters?: DataTableFilter[];
  searchPlaceholder?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyMessage?: string;
  /** Persiste recherche/filtres/tri en sessionStorage sous cette clé. */
  storageKey?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSort?.dir ?? "asc");
  const [filterState, setFilterState] = useState<Record<string, string>>({});

  // Restauration unique au montage : l'état vit en mémoire et serait sinon
  // perdu à chaque navigation (ouvrir une fiche puis revenir à la liste).
  // sessionStorage n'est lisible qu'après l'hydratation, d'où l'effet.
  useEffect(() => {
    if (!storageKey) return;
    const raw = sessionStorage.getItem(`datatable:${storageKey}`);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<PersistedState>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restauration one-shot, un seul re-rendu
      if (typeof saved.query === "string") setQuery(saved.query);
      if (saved.sortKey !== undefined) setSortKey(saved.sortKey);
      if (saved.sortDir === "asc" || saved.sortDir === "desc") setSortDir(saved.sortDir);
      if (saved.filterState) setFilterState(saved.filterState);
    } catch {
      sessionStorage.removeItem(`datatable:${storageKey}`);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const state: PersistedState = { query, sortKey, sortDir, filterState };
    sessionStorage.setItem(`datatable:${storageKey}`, JSON.stringify(state));
  }, [storageKey, query, sortKey, sortDir, filterState]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) out = out.filter((r) => r.searchText.toLowerCase().includes(q));
    for (const [key, value] of Object.entries(filterState)) {
      if (value && value !== ALL) {
        out = out.filter((r) => r.filterValues?.[key] === value);
      }
    }
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const va = a.sortValues[sortKey];
        const vb = b.sortValues[sortKey];
        if (typeof va === "number" && typeof vb === "number") {
          return (va - vb) * dir;
        }
        return String(va ?? "").localeCompare(String(vb ?? ""), "fr") * dir;
      });
    }
    return out;
  }, [rows, query, filterState, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-64 pl-8"
          />
        </div>
        {filters.map((f) => (
          <Select
            key={f.key}
            value={filterState[f.key] ?? ALL}
            onValueChange={(v) =>
              setFilterState((s) => ({ ...s, [f.key]: v }))
            }
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{f.label} : tous</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {(query || Object.values(filterState).some((v) => v && v !== ALL)) && (
          <span className="text-xs text-muted-foreground">
            {visible.length} / {rows.length}
          </span>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => {
              const sortable = col.sortable !== false;
              const active = sortKey === col.key;
              return (
                <TableHead
                  key={col.key}
                  className={cn(col.align === "right" && "text-right", col.className)}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        active && "text-foreground font-semibold"
                      )}
                    >
                      {col.label}
                      {active ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            visible.map((row) => (
              <TableRow
                key={row.id}
                onClick={row.href ? () => router.push(row.href!) : undefined}
                className={row.href ? "cursor-pointer hover:bg-muted/50" : undefined}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(col.align === "right" && "text-right", col.className)}
                  >
                    {row.cells[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
