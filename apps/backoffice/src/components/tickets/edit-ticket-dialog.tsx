"use client";

import { useActionState, useState } from "react";
import type { TicketPriority, TicketType } from "@prisma/client";
import { editTicketAction, type EditActionState } from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TYPE_LABELS, PRIORITY_LABELS } from "@/lib/ticket-labels";
import { Pencil } from "lucide-react";

/**
 * Dialogue de modification d'un ticket par son auteur, proposé tant que
 * le ticket a le statut « Nouveau » (règle re-vérifiée côté service).
 */
export function EditTicketDialog({
  ticket,
}: {
  ticket: {
    id: string;
    title: string;
    description: string;
    type: TicketType;
    priority: TicketPriority;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    // Fermeture du dialogue à la réussite, sans passer par un effet.
    async (prev: EditActionState, formData: FormData) => {
      const result = await editTicketAction(prev, formData);
      if (result?.ok) setOpen(false);
      return result;
    },
    undefined
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4 mr-1" /> Modifier le ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le ticket</DialogTitle>
          <DialogDescription>
            Possible tant que le ticket n&apos;a pas été pris en charge.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="ticketId" value={ticket.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type de retour</Label>
              <Select name="type" defaultValue={ticket.type} required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priorité</Label>
              <Select name="priority" defaultValue={ticket.priority} required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-title">Titre</Label>
            <Input
              id="edit-title"
              name="title"
              required
              minLength={3}
              maxLength={200}
              defaultValue={ticket.title}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              name="description"
              required
              minLength={10}
              rows={6}
              defaultValue={ticket.description}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
