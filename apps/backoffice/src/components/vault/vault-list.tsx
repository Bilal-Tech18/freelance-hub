"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createVaultEntryAction,
  deleteVaultEntryAction,
  revealVaultEntryAction,
  updateVaultEntryAction,
} from "@/lib/actions/vault";
import { PROVIDER_LIST, providerFields, providerLabel } from "@/lib/credentials";
import { CredentialFields } from "@/components/vault/credential-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Eye, KeyRound, Plus, Trash2 } from "lucide-react";

export type VaultItem = {
  id: string;
  provider: string;
  label: string;
  clientName?: string;
  projectName: string | null;
  updatedAt: string;
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function RevealBlock({ id, provider }: { id: string; provider: string }) {
  const [state, action, pending] = useActionState(revealVaultEntryAction, undefined);
  const fields = providerFields(provider);

  return (
    <div className="space-y-2">
      {!state?.fields ? (
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            <Eye className="size-4 mr-1" /> {pending ? "…" : "Révéler"}
          </Button>
          {state?.error && (
            <span className="ml-2 text-sm text-destructive">{state.error}</span>
          )}
        </form>
      ) : (
        <dl className="space-y-1.5">
          {fields.map((f) => {
            const val = state.fields?.[f.key];
            if (!val) return null;
            return (
              <div key={f.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="flex items-center gap-2">
                  <code className="font-mono text-xs break-all">{val}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(val);
                      toast.success("Copié");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Copier"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </span>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [, action, pending] = useActionState(deleteVaultEntryAction, undefined);
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirm(true)}
        aria-label="Supprimer"
      >
        <Trash2 className="size-4" />
      </Button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "…" : "Confirmer"}
      </Button>
    </form>
  );
}

function CreateForm({
  clientId,
  clients,
  onDone,
}: {
  clientId?: string;
  clients?: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createVaultEntryAction, undefined);
  const [provider, setProvider] = useState("RENDER");
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state?.saved) {
        toast.success("Accès chiffré et enregistré");
        onDone();
      } else if (state?.error) toast.error(state.error);
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nouvelle entrée</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          {clientId ? (
            <input type="hidden" name="clientId" value={clientId} />
          ) : (
            <div className="grid gap-1.5">
              <Label>Client</Label>
              <Select name="clientId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-1.5">
              <Label>Service</Label>
              <input type="hidden" name="provider" value={provider} />
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_LIST.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="v-label">Intitulé</Label>
              <Input id="v-label" name="label" placeholder="Ex : Compte Render prod" required />
            </div>
          </div>
          <CredentialFields provider={provider} />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Enregistrer (chiffré)"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EditForm({
  item,
  onDone,
}: {
  item: VaultItem;
  onDone: () => void;
}) {
  const [reveal, revealAction, revealPending] = useActionState(revealVaultEntryAction, undefined);
  const [state, action, pending] = useActionState(updateVaultEntryAction, undefined);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state?.saved) {
        toast.success("Accès mis à jour");
        onDone();
      } else if (state?.error) toast.error(state.error);
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  if (!reveal?.fields) {
    return (
      <form action={revealAction}>
        <input type="hidden" name="id" value={item.id} />
        <Button type="submit" variant="outline" size="sm" disabled={revealPending}>
          {revealPending ? "…" : "Charger pour modifier"}
        </Button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="provider" value={item.provider} />
      <div className="grid gap-1.5">
        <Label htmlFor={`e-label-${item.id}`}>Intitulé</Label>
        <Input id={`e-label-${item.id}`} name="label" defaultValue={item.label} required />
      </div>
      <CredentialFields provider={item.provider} values={reveal.fields} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Enregistrer"}
      </Button>
    </form>
  );
}

function EntryCard({
  item,
  showClient,
  editing,
  onToggleEdit,
  onEditDone,
  readOnly,
}: {
  item: VaultItem;
  showClient?: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  onEditDone: () => void;
  readOnly?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">
            {item.label}{" "}
            <span className="font-normal text-muted-foreground">
              · {providerLabel(item.provider)}
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {showClient && item.clientName ? `${item.clientName} · ` : ""}
            {item.projectName ? `${item.projectName} · ` : ""}
            maj {dateFmt.format(new Date(item.updatedAt))}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onToggleEdit}>
              Modifier
            </Button>
            <DeleteButton id={item.id} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editing && !readOnly ? (
          <EditForm item={item} onDone={onEditDone} />
        ) : (
          <RevealBlock id={item.id} provider={item.provider} />
        )}
      </CardContent>
    </Card>
  );
}

/** Groupe client → entrées triées par projet (sans projet en premier) puis intitulé. */
function groupByClient(items: VaultItem[]): [string, VaultItem[]][] {
  const map = new Map<string, VaultItem[]>();
  for (const item of items) {
    const key = item.clientName ?? "Sans client";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        (a.projectName ?? "").localeCompare(b.projectName ?? "", "fr") ||
        a.label.localeCompare(b.label, "fr")
    );
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
}

export function VaultList({
  items,
  showClient,
  clientId,
  clients,
  readOnly,
}: {
  items: VaultItem[];
  showClient?: boolean;
  clientId?: string;
  clients?: { id: string; name: string }[];
  /** Lecture seule (mainteneur) : révéler/copier uniquement. */
  readOnly?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const renderItem = (item: VaultItem) => (
    <EntryCard
      key={item.id}
      item={item}
      showClient={false}
      editing={editing === item.id}
      onToggleEdit={() => setEditing((e) => (e === item.id ? null : item.id))}
      onEditDone={() => setEditing(null)}
      readOnly={readOnly}
    />
  );

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating((v) => !v)} variant={creating ? "secondary" : "default"}>
            <Plus className="size-4 mr-1" /> Ajouter un accès
          </Button>
        </div>
      )}

      {creating && !readOnly && (
        <CreateForm clientId={clientId} clients={clients} onDone={() => setCreating(false)} />
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <KeyRound className="size-8 mx-auto mb-2 opacity-40" />
            Aucun accès enregistré pour l&apos;instant.
          </CardContent>
        </Card>
      ) : showClient ? (
        <div className="space-y-6">
          {groupByClient(items).map(([clientName, list]) => (
            <section key={clientName} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {clientName}
                <span className="ml-2 font-normal normal-case">
                  {list.length} accès
                </span>
              </h2>
              <div className="grid gap-3">{list.map(renderItem)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">{items.map(renderItem)}</div>
      )}
    </div>
  );
}
