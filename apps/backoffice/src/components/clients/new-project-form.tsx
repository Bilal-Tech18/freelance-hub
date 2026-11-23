"use client";

import { useActionState } from "react";
import { createProjectAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
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

export function NewProjectForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(createProjectAction, undefined);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-2">
        <Label htmlFor="project-name">Nom du projet</Label>
        <Input id="project-name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea id="project-description" name="description" rows={3} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-url">URL (staging / prod)</Label>
        <Input id="project-url" name="url" type="url" placeholder="https://…" />
      </div>
      <div className="grid gap-2">
        <Label>Nature d&apos;activité</Label>
        <Select name="activity" defaultValue="SERVICE_BNC">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SERVICE_BNC">Prestations (BNC)</SelectItem>
            <SelectItem value="GOODS">Vente de marchandises</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer le projet"}
      </Button>
    </form>
  );
}
