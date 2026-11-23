"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { updateClientBillingAction } from "@/lib/actions/billing";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Billing = {
  billingType: "COMPANY" | "INDIVIDUAL";
  legalName: string | null;
  contactName: string | null;
  billingEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  siren: string | null;
  vatNumber: string | null;
  legalForm: string | null;
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
  defaultValue?: string | null;
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

export function BillingInfoForm({
  clientId,
  billing,
}: {
  clientId: string;
  billing: Billing;
}) {
  const [state, formAction, pending] = useActionState(updateClientBillingAction, undefined);
  const [type, setType] = useState(billing.billingType);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state?.saved) toast.success("Coordonnées enregistrées");
      if (state?.error) toast.error(state.error);
    }
    wasPending.current = pending;
  }, [pending, state]);

  const isCompany = type === "COMPANY";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coordonnées de facturation</CardTitle>
        <CardDescription>Utilisées pour générer factures et devis</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select
              name="billingType"
              defaultValue={billing.billingType}
              onValueChange={(v) => setType(v as "COMPANY" | "INDIVIDUAL")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Entreprise</SelectItem>
                <SelectItem value="INDIVIDUAL">Particulier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field name="billingEmail" label="Email de facturation" type="email" defaultValue={billing.billingEmail} />

          {isCompany ? (
            <>
              <Field name="legalName" label="Raison sociale" defaultValue={billing.legalName} />
              <Field name="legalForm" label="Forme juridique" defaultValue={billing.legalForm} />
              <Field name="contactName" label="Personne de contact" defaultValue={billing.contactName} />
            </>
          ) : (
            <Field name="contactName" label="Nom complet" defaultValue={billing.contactName} className="sm:col-span-2" />
          )}

          <Field name="addressLine1" label="Adresse" defaultValue={billing.addressLine1} className="sm:col-span-2" />
          <Field name="addressLine2" label="Complément" defaultValue={billing.addressLine2} className="sm:col-span-2" />
          <Field name="postalCode" label="Code postal" defaultValue={billing.postalCode} />
          <Field name="city" label="Ville" defaultValue={billing.city} />
          <Field name="country" label="Pays" defaultValue={billing.country} />

          {isCompany && (
            <>
              <Field name="siret" label="SIRET" defaultValue={billing.siret} />
              <Field name="siren" label="SIREN" defaultValue={billing.siren} />
              <Field name="vatNumber" label="N° TVA intracom." defaultValue={billing.vatNumber} />
            </>
          )}

          {!isCompany && (
            <>
              <input type="hidden" name="legalName" value="" />
              <input type="hidden" name="legalForm" value="" />
              <input type="hidden" name="siret" value="" />
              <input type="hidden" name="siren" value="" />
              <input type="hidden" name="vatNumber" value="" />
            </>
          )}

          {state?.error && (
            <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
