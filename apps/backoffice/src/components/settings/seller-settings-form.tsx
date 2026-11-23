"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { updateSettingsAction } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  sellerName: string | null;
  sellerLegalForm: string | null;
  sellerAddressLine1: string | null;
  sellerAddressLine2: string | null;
  sellerPostalCode: string | null;
  sellerCity: string | null;
  sellerCountry: string | null;
  sellerEmail: string | null;
  sellerPhone: string | null;
  siret: string | null;
  vatNumber: string | null;
  apeCode: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  invoicePrefix: string;
  quotePrefix: string;
  defaultVatRate: number;
  paymentTermsDays: number;
  quoteValidityDays: number;
  vatExempt: boolean;
  legalMentions: string | null;
};

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} />
    </div>
  );
}

export function SellerSettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state?.saved) toast.success("Réglages enregistrés");
      if (state?.error) toast.error(state.error);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ton entreprise (émetteur)</CardTitle>
          <CardDescription>
            Ces informations figurent sur tes factures et devis
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field name="sellerName" label="Raison sociale / Nom" defaultValue={settings.sellerName} />
          <Field name="sellerLegalForm" label="Forme juridique (EI, SASU…)" defaultValue={settings.sellerLegalForm} />
          <Field name="sellerAddressLine1" label="Adresse" defaultValue={settings.sellerAddressLine1} className="sm:col-span-2" />
          <Field name="sellerAddressLine2" label="Complément d'adresse" defaultValue={settings.sellerAddressLine2} className="sm:col-span-2" />
          <Field name="sellerPostalCode" label="Code postal" defaultValue={settings.sellerPostalCode} />
          <Field name="sellerCity" label="Ville" defaultValue={settings.sellerCity} />
          <Field name="sellerCountry" label="Pays" defaultValue={settings.sellerCountry} />
          <Field name="sellerEmail" label="Email" type="email" defaultValue={settings.sellerEmail} />
          <Field name="sellerPhone" label="Téléphone" defaultValue={settings.sellerPhone} />
          <Field name="siret" label="SIRET" defaultValue={settings.siret} />
          <Field name="vatNumber" label="N° TVA intracom." defaultValue={settings.vatNumber} />
          <Field name="apeCode" label="Code APE/NAF" defaultValue={settings.apeCode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coordonnées bancaires</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field name="bankName" label="Banque" defaultValue={settings.bankName} />
          <Field name="iban" label="IBAN" defaultValue={settings.iban} />
          <Field name="bic" label="BIC" defaultValue={settings.bic} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres de facturation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field name="invoicePrefix" label="Préfixe factures" defaultValue={settings.invoicePrefix} />
          <Field name="quotePrefix" label="Préfixe devis" defaultValue={settings.quotePrefix} />
          <Field name="defaultVatRate" label="Taux TVA par défaut (%)" type="number" defaultValue={settings.defaultVatRate} />
          <Field name="paymentTermsDays" label="Délai de paiement (jours)" type="number" defaultValue={settings.paymentTermsDays} />
          <Field name="quoteValidityDays" label="Validité devis (jours)" type="number" defaultValue={settings.quoteValidityDays} />
          <label className="flex items-center gap-2 text-sm mt-6">
            <input
              type="checkbox"
              name="vatExempt"
              defaultChecked={settings.vatExempt}
              className="rounded border-input"
            />
            Franchise en base de TVA (art. 293 B — pas de TVA facturée)
          </label>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="legalMentions">Mentions légales additionnelles</Label>
            <Textarea
              id="legalMentions"
              name="legalMentions"
              rows={2}
              defaultValue={settings.legalMentions ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer les réglages"}
      </Button>
    </form>
  );
}
