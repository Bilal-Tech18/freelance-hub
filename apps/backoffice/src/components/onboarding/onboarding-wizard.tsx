"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import {
  saveOnboardingDraftAction,
  submitOnboardingAction,
  updateMyClientInfoAction,
} from "@/lib/actions/onboarding";
import {
  fulfillCredentialRequestAction,
  skipCredentialRequestAction,
} from "@/lib/actions/credentials";
import {
  ONBOARDING_SECTIONS,
  type OnboardingAnswers,
} from "@/lib/onboarding-schema";
import { providerLabel } from "@/lib/credentials";
import { CredentialFields } from "@/components/vault/credential-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClientInfo = {
  billingType: "COMPANY" | "INDIVIDUAL";
  legalName: string | null;
  contactName: string | null;
  billingEmail: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vatNumber: string | null;
  legalForm: string | null;
};

type CredRequest = {
  id: string;
  provider: string;
  label: string;
  instructions: string | null;
  required: boolean;
  status: "PENDING" | "PROVIDED" | "SKIPPED";
};

const STEPS = ["Vos informations", "Votre projet", "Accès & comptes", "Finalisation"];

export function OnboardingWizard({
  projectId,
  projectName,
  clientInfo,
  answers,
  credentialRequests,
  submitted,
}: {
  projectId: string;
  projectName: string;
  clientInfo: ClientInfo;
  answers: Partial<OnboardingAnswers>;
  credentialRequests: CredRequest[];
  submitted: boolean;
}) {
  const router = useRouter();
  // Après soumission, on ouvre directement sur "Accès & comptes" (l'étape la plus
  // souvent à compléter), mais toutes les étapes restent accessibles.
  const [step, setStep] = useState(submitted ? 2 : 0);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const pendingCreds = credentialRequests.filter((r) => r.status !== "PROVIDED").length;

  return (
    <div className="space-y-6">
      {submitted && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 text-sm">
          ✅ Questionnaire déjà envoyé pour {projectName}. Vous pouvez revenir
          compléter ou mettre à jour n&apos;importe quelle étape à tout moment
          {pendingCreds > 0 && (
            <> — il reste <b>{pendingCreds} accès</b> à fournir</>
          )}
          .
        </div>
      )}
      <Stepper step={step} onSelect={setStep} />

      {step === 0 && (
        <StepInfo clientInfo={clientInfo} onNext={next} />
      )}
      {step === 1 && (
        <StepBrief projectId={projectId} answers={answers} onNext={next} onPrev={prev} />
      )}
      {step === 2 && (
        <StepCredentials
          requests={credentialRequests}
          onNext={next}
          onPrev={prev}
          onChange={() => router.refresh()}
        />
      )}
      {step === 3 && <StepFinalize projectId={projectId} onPrev={prev} />}
    </div>
  );
}

function Stepper({
  step,
  onSelect,
}: {
  step: number;
  onSelect: (i: number) => void;
}) {
  return (
    <>
      {/* Desktop */}
      <ol className="hidden sm:flex items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={active ? "font-medium" : "text-muted-foreground"}>
                  {label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
            </li>
          );
        })}
      </ol>
      {/* Mobile */}
      <div className="sm:hidden">
        <p className="text-xs text-muted-foreground">
          Étape {step + 1} / {STEPS.length}
        </p>
        <p className="font-medium">{STEPS[step]}</p>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}

function useAdvanceOnSaved(
  state: { saved?: boolean; error?: string } | undefined,
  pending: boolean,
  onSaved: () => void
) {
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) {
      if (state?.saved) onSaved();
      else if (state?.error) toast.error(state.error);
    }
    was.current = pending;
  }, [pending, state, onSaved]);
}

function StepInfo({
  clientInfo,
  onNext,
}: {
  clientInfo: ClientInfo;
  onNext: () => void;
}) {
  const [state, action, pending] = useActionState(updateMyClientInfoAction, undefined);
  const [type, setType] = useState(clientInfo.billingType);
  useAdvanceOnSaved(state, pending, () => {
    toast.success("Informations enregistrées");
    onNext();
  });
  const isCompany = type === "COMPANY";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vos informations</CardTitle>
        <CardDescription>
          Pour établir devis et factures. Vous pourrez compléter plus tard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Vous êtes</Label>
            <Select
              name="billingType"
              defaultValue={clientInfo.billingType}
              onValueChange={(v) => setType(v as "COMPANY" | "INDIVIDUAL")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Une entreprise</SelectItem>
                <SelectItem value="INDIVIDUAL">Un particulier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="billingEmail">Email</Label>
            <Input id="billingEmail" name="billingEmail" type="email" defaultValue={clientInfo.billingEmail ?? ""} />
          </div>
          {isCompany ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="legalName">Raison sociale</Label>
                <Input id="legalName" name="legalName" defaultValue={clientInfo.legalName ?? ""} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="legalForm">Forme juridique</Label>
                <Input id="legalForm" name="legalForm" placeholder="SARL, SAS…" defaultValue={clientInfo.legalForm ?? ""} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contactName">Contact</Label>
                <Input id="contactName" name="contactName" defaultValue={clientInfo.contactName ?? ""} />
              </div>
            </>
          ) : (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="contactName">Nom complet</Label>
              <Input id="contactName" name="contactName" defaultValue={clientInfo.contactName ?? ""} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Téléphone</Label>
            <PhoneInput name="phone" defaultValue={clientInfo.phone} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="addressLine1">Adresse</Label>
            <Input id="addressLine1" name="addressLine1" defaultValue={clientInfo.addressLine1 ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="postalCode">Code postal</Label>
            <Input id="postalCode" name="postalCode" defaultValue={clientInfo.postalCode ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" name="city" defaultValue={clientInfo.city ?? ""} />
          </div>
          {isCompany && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="siret">SIRET</Label>
                <Input id="siret" name="siret" defaultValue={clientInfo.siret ?? ""} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vatNumber">N° TVA</Label>
                <Input id="vatNumber" name="vatNumber" defaultValue={clientInfo.vatNumber ?? ""} />
              </div>
            </>
          )}
          <input type="hidden" name="country" value={clientInfo.country ?? "France"} />

          <div className="sm:col-span-2 flex items-center justify-between pt-2">
            <Button type="button" variant="ghost" onClick={onNext}>
              <SkipForward className="size-4 mr-1" /> Passer
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "…" : "Enregistrer et continuer"}
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StepBrief({
  projectId,
  answers,
  onNext,
  onPrev,
}: {
  projectId: string;
  answers: Partial<OnboardingAnswers>;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [state, action, pending] = useActionState(saveOnboardingDraftAction, undefined);
  useAdvanceOnSaved(state, pending, () => {
    toast.success("Brouillon enregistré");
    onNext();
  });

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="projectId" value={projectId} />
      {ONBOARDING_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-4">
            {section.fields.map((field) => (
              <div key={field.name} className="grid gap-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.name}
                    name={field.name}
                    rows={3}
                    placeholder={field.placeholder}
                    defaultValue={answers[field.name] ?? ""}
                  />
                ) : (
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder}
                    defaultValue={answers[field.name] ?? ""}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onPrev}>
          <ChevronLeft className="size-4 mr-1" /> Retour
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onNext}>
            <SkipForward className="size-4 mr-1" /> Passer
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Enregistrer et continuer"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function StepCredentials({
  requests,
  onNext,
  onPrev,
  onChange,
}: {
  requests: CredRequest[];
  onNext: () => void;
  onPrev: () => void;
  onChange: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle>Accès & comptes</CardTitle>
          <CardDescription>
            Les accès dont j&apos;ai besoin pour votre projet. Ils sont chiffrés
            et visibles uniquement par vous et moi. Vous pouvez passer un accès
            et le fournir plus tard.
          </CardDescription>
        </CardHeader>
      </Card>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun accès demandé pour l&apos;instant.
        </p>
      ) : (
        requests.map((r) => (
          <CredentialRequestItem key={r.id} request={r} onChange={onChange} />
        ))
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onPrev}>
          <ChevronLeft className="size-4 mr-1" /> Retour
        </Button>
        <Button type="button" onClick={onNext}>
          Continuer <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function CredentialRequestItem({
  request,
  onChange,
}: {
  request: CredRequest;
  onChange: () => void;
}) {
  const [state, action, pending] = useActionState(fulfillCredentialRequestAction, undefined);
  const [, skipAction] = useActionState(skipCredentialRequestAction, undefined);
  const [open, setOpen] = useState(request.status === "PENDING");
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) {
      if (state?.saved) {
        toast.success(`${request.label} enregistré`);
        setOpen(false);
        onChange();
      } else if (state?.error) toast.error(state.error);
    }
    was.current = pending;
  }, [pending, state, request.label, onChange]);

  const statusBadge =
    request.status === "PROVIDED" ? (
      <span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 dark:bg-emerald-950 dark:text-emerald-300">
        Fourni
      </span>
    ) : request.status === "SKIPPED" ? (
      <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 dark:bg-amber-950 dark:text-amber-300">
        Passé
      </span>
    ) : request.required ? (
      <span className="text-xs rounded-full bg-red-100 text-red-700 px-2 py-0.5 dark:bg-red-950 dark:text-red-300">
        Requis
      </span>
    ) : (
      <span className="text-xs rounded-full bg-muted text-muted-foreground px-2 py-0.5">
        Optionnel
      </span>
    );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">
            {request.label}{" "}
            <span className="text-muted-foreground font-normal">
              · {providerLabel(request.provider)}
            </span>
          </CardTitle>
          {request.instructions && (
            <CardDescription>{request.instructions}</CardDescription>
          )}
        </div>
        {statusBadge}
      </CardHeader>
      {open ? (
        <CardContent>
          <form action={action} className="space-y-3">
            <input type="hidden" name="requestId" value={request.id} />
            <CredentialFields provider={request.provider} />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "…" : "Enregistrer cet accès"}
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("requestId", request.id);
                  skipAction(fd);
                  onChange();
                }}
              >
                Je fournirai plus tard
              </button>
            </div>
          </form>
        </CardContent>
      ) : (
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {request.status === "PROVIDED" ? "Modifier" : "Renseigner"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

function StepFinalize({
  projectId,
  onPrev,
}: {
  projectId: string;
  onPrev: () => void;
}) {
  const [state, action, pending] = useActionState(submitOnboardingAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finalisation</CardTitle>
        <CardDescription>
          Une fois envoyé, je reçois vos réponses. Vous pourrez toujours me faire
          des retours via les tickets.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={onPrev}>
              <ChevronLeft className="size-4 mr-1" /> Retour
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Envoi…" : "Envoyer mon questionnaire"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
