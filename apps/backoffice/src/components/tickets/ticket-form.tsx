"use client";

import { useActionState, useState } from "react";
import { createTicketAction } from "@/lib/actions/tickets";
import { AttachmentUploader, type UploadedFile } from "@/components/tickets/attachment-uploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export function TicketForm({
  projects,
  clients,
  defaultProjectId,
}: {
  projects: { id: string; name: string; clientId?: string; clientName?: string }[];
  /** Fourni côté admin : affiche un select client qui filtre les projets. */
  clients?: { id: string; name: string }[];
  defaultProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(createTicketAction, undefined);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [clientId, setClientId] = useState<string>(
    () => projects.find((p) => p.id === defaultProjectId)?.clientId ?? ""
  );
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [internal, setInternal] = useState(false);

  const visibleProjects = clientId
    ? projects.filter((p) => p.clientId === clientId)
    : projects;

  function onClientChange(nextClientId: string) {
    setClientId(nextClientId);
    if (projects.find((p) => p.id === projectId)?.clientId !== nextClientId) {
      setProjectId("");
    }
  }

  return (
    <form action={formAction} className="grid gap-4 max-w-xl">
      <input type="hidden" name="attachments" value={JSON.stringify(files)} />

      {clients && (
        <div className="grid gap-2">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={onClientChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choisissez un client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label>Projet</Label>
        <Select name="projectId" value={projectId} onValueChange={setProjectId} required>
          <SelectTrigger>
            <SelectValue placeholder="Choisissez un projet" />
          </SelectTrigger>
          <SelectContent>
            {visibleProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {clients && !clientId && p.clientName
                  ? `${p.clientName} · ${p.name}`
                  : p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Type de retour</Label>
          <Select name="type" defaultValue="BUG" required>
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
          <Select name="priority" defaultValue="MEDIUM" required>
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
        <Label htmlFor="title">Titre</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          placeholder="Ex : Le bouton de paiement ne répond pas sur mobile"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          required
          minLength={10}
          rows={6}
          placeholder="Décrivez le problème : que se passe-t-il, sur quelle page, comment le reproduire ?"
        />
      </div>

      <AttachmentUploader value={files} onChange={setFiles} />

      {/* Ticket interne : proposé uniquement dans le formulaire admin */}
      {clients && (
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="hidden" name="internal" value={internal ? "1" : "0"} />
          <Checkbox
            checked={internal}
            onCheckedChange={(v) => setInternal(v === true)}
            className="mt-0.5"
          />
          <span>
            Ticket interne
            <span className="block text-muted-foreground">
              Invisible pour le client, aucune notification envoyée.
            </span>
          </span>
        </label>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Créer le ticket"}
      </Button>
    </form>
  );
}
