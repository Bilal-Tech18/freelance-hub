"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/ticket-labels";

const ALL = "__all__";

const SORT_LABELS: Record<string, string> = {
  createdAt: "Date de création",
  dueDate: "Deadline",
  priority: "Priorité",
  updatedAt: "Dernière activité",
};

function FilterSelect({
  param,
  placeholder,
  options,
  value,
  onChange,
}: {
  param: string;
  placeholder: string;
  options: [string, string][];
  value: string;
  onChange: (param: string, value: string) => void;
}) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(param, v)}>
      <SelectTrigger className="w-[160px]" size="sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TicketFiltersBar({
  projects,
  clients,
}: {
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restoredRef = useRef(false);

  // Filtres persistants (par onglet) : en arrivant sur la liste sans paramètres
  // — retour depuis une fiche, lien de navigation — les derniers filtres sont
  // restaurés. Vider les filtres (« Réinitialiser » ou un à un) les oublie.
  useEffect(() => {
    const key = `ticket-filters:${pathname}`;
    const qs = searchParams.toString();
    if (!restoredRef.current) {
      restoredRef.current = true;
      if (!qs) {
        const saved = sessionStorage.getItem(key);
        if (saved) {
          router.replace(`${pathname}?${saved}`);
          return;
        }
      }
    }
    if (qs) sessionStorage.setItem(key, qs);
    else sessionStorage.removeItem(key);
  }, [pathname, searchParams, router]);

  function setParam(param: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === ALL || !value) params.delete(param);
    else params.set(param, value);
    // Le filtre Statut est incompatible avec le mode « Tickets fermés ».
    if (param === "status") params.delete("closed");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Affiche uniquement les tickets fermés (masqués par défaut) ;
  // incompatible avec le filtre Statut, qu'on retire à l'activation.
  function toggleClosed() {
    const params = new URLSearchParams(searchParams);
    if (params.get("closed") === "true") {
      params.delete("closed");
    } else {
      params.set("closed", "true");
      params.delete("status");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const showClosed = searchParams.get("closed") === "true";
  const hasFilters = ["status", "priority", "type", "project", "client", "overdue", "closed"].some(
    (p) => searchParams.has(p)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        param="status"
        placeholder="Statut"
        options={Object.entries(STATUS_LABELS)}
        value={searchParams.get("status") ?? ""}
        onChange={setParam}
      />
      <FilterSelect
        param="priority"
        placeholder="Priorité"
        options={Object.entries(PRIORITY_LABELS)}
        value={searchParams.get("priority") ?? ""}
        onChange={setParam}
      />
      <FilterSelect
        param="type"
        placeholder="Type"
        options={Object.entries(TYPE_LABELS)}
        value={searchParams.get("type") ?? ""}
        onChange={setParam}
      />
      <FilterSelect
        param="client"
        placeholder="Client"
        options={clients.map((c) => [c.id, c.name])}
        value={searchParams.get("client") ?? ""}
        onChange={setParam}
      />
      <FilterSelect
        param="project"
        placeholder="Projet"
        options={projects.map((p) => [p.id, p.name])}
        value={searchParams.get("project") ?? ""}
        onChange={setParam}
      />
      <FilterSelect
        param="sort"
        placeholder="Trier par"
        options={Object.entries(SORT_LABELS)}
        value={searchParams.get("sort") ?? ""}
        onChange={setParam}
      />
      <Button
        variant={searchParams.get("overdue") === "true" ? "destructive" : "outline"}
        size="sm"
        onClick={() =>
          setParam("overdue", searchParams.get("overdue") === "true" ? "" : "true")
        }
      >
        En retard
      </Button>
      <Button
        variant={showClosed ? "secondary" : "outline"}
        size="sm"
        onClick={toggleClosed}
      >
        Tickets fermés
      </Button>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Réinitialiser
        </Button>
      )}
    </div>
  );
}
