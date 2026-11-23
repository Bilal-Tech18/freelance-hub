"use client";

import { useRef, useState, useTransition } from "react";
import type { TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { toast } from "sonner";
import { bulkUpdateTicketStatusAction } from "@/lib/actions/tickets";
import {
  InternalBadge,
  OverdueBadge,
  PriorityBadge,
  TypeBadge,
  STATUS_DOT,
} from "@/components/tickets/badges";
import { TicketStatusSelect } from "@/components/tickets/ticket-status-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClickableRow } from "@/components/ui/clickable-row";
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
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/ticket-labels";
import { cn } from "@/lib/utils";

export type AdminTicketRow = {
  id: string;
  number: number;
  title: string;
  commentCount: number;
  clientProject: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  dueDate: string | null;
  overdue: boolean;
  internal: boolean;
};

/**
 * Table admin des tickets : navigation par ligne, statut modifiable par ligne,
 * et sélection multiple (checkboxes) pour changer le statut en lot.
 */
export function AdminTicketsTable({
  tickets,
  basePath = "/admin/tickets",
}: {
  tickets: AdminTicketRow[];
  /** Préfixe des liens de détail (ex. /maintenance/tickets). */
  basePath?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TicketStatus | "">("");
  const [pending, startTransition] = useTransition();
  // Ancre pour la sélection par plage (Shift + clic) : dernier index cliqué,
  // et shiftKey capturé au clic car onCheckedChange ne fournit pas l'événement.
  const anchorIndexRef = useRef<number | null>(null);
  const shiftKeyRef = useRef(false);

  const allSelected = tickets.length > 0 && selected.size === tickets.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(tickets.map((t) => t.id)));
    anchorIndexRef.current = null;
  }

  function toggleOne(id: string, index: number) {
    const anchor = anchorIndexRef.current;
    const isRange = shiftKeyRef.current && anchor !== null && anchor !== index;
    shiftKeyRef.current = false;
    anchorIndexRef.current = index;
    setSelected((prev) => {
      const next = new Set(prev);
      if (isRange) {
        // La plage prend l'état résultant de la case cliquée.
        const check = !prev.has(id);
        const [start, end] = anchor < index ? [anchor, index] : [index, anchor];
        for (let i = start; i <= end; i++) {
          if (check) next.add(tickets[i].id);
          else next.delete(tickets[i].id);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function applyBulk() {
    if (!bulkStatus || selected.size === 0) return;
    startTransition(async () => {
      const result = await bulkUpdateTicketStatusAction({
        ticketIds: [...selected],
        status: bulkStatus,
      });
      if (result.error) toast.error(result.error);
      if (result.updated > 0) {
        toast.success(
          result.updated === 1
            ? "1 ticket mis à jour."
            : `${result.updated} tickets mis à jour.`
        );
      }
      setSelected(new Set());
      setBulkStatus("");
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium">
            {selected.size === 1
              ? "1 ticket sélectionné"
              : `${selected.size} tickets sélectionnés`}
          </span>
          <Select
            value={bulkStatus}
            onValueChange={(v) => setBulkStatus(v as TicketStatus)}
          >
            <SelectTrigger size="sm" className="w-48" disabled={pending}>
              <SelectValue placeholder="Nouveau statut…" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className={cn("size-1.5 rounded-full", STATUS_DOT[s])} />
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={applyBulk} disabled={!bulkStatus || pending}>
            {pending ? "Mise à jour…" : "Appliquer"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            disabled={pending}
          >
            Annuler
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  allSelected ? true : selected.size > 0 ? "indeterminate" : false
                }
                onCheckedChange={toggleAll}
                aria-label="Tout sélectionner"
              />
            </TableHead>
            <TableHead>#</TableHead>
            <TableHead>Titre</TableHead>
            <TableHead>Client / Projet</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Priorité</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="hidden 2xl:table-cell">Créé</TableHead>
            <TableHead>Deadline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((t, index) => (
            <ClickableRow
              key={t.id}
              href={`${basePath}/${t.id}`}
              className={cn(
                t.overdue && "bg-destructive/5",
                selected.has(t.id) && "bg-accent/60"
              )}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected.has(t.id)}
                  onClick={(e) => {
                    shiftKeyRef.current = e.shiftKey;
                  }}
                  onMouseDown={(e) => {
                    // Évite la sélection de texte lors d'un Shift + clic.
                    if (e.shiftKey) e.preventDefault();
                  }}
                  onCheckedChange={() => toggleOne(t.id, index)}
                  aria-label={`Sélectionner le ticket #${t.number}`}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                #{t.number}
              </TableCell>
              {/* Seules les colonnes texte passent à la ligne : sans ça, le tableau
                  déborde dès 1440 px et le statut finit masqué par le scroll. */}
              <TableCell className="min-w-48 whitespace-normal">
                <span className="font-medium">{t.title}</span>
                {t.internal && (
                  <span className="ml-2 inline-flex align-middle">
                    <InternalBadge />
                  </span>
                )}
                {t.commentCount > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    💬 {t.commentCount}
                  </span>
                )}
              </TableCell>
              <TableCell className="min-w-40 whitespace-normal text-sm text-muted-foreground">
                {t.clientProject}
              </TableCell>
              <TableCell>
                <TypeBadge type={t.type} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={t.priority} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <TicketStatusSelect
                    key={`${t.id}-${t.status}`}
                    ticketId={t.id}
                    status={t.status}
                  />
                  {t.overdue && <OverdueBadge />}
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                {t.createdAt}
              </TableCell>
              <TableCell
                className={
                  t.overdue
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }
              >
                {t.dueDate ?? "—"}
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
