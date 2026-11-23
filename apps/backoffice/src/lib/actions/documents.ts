"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { itemsSchema } from "@/lib/documents";
import {
  cancelDocument,
  convertQuoteToInvoice,
  createDraft,
  deleteDraft,
  issueDocument,
  markInvoicePaid,
  restoreDocument,
  setQuoteStatus,
  unmarkInvoicePaid,
  updateDraft,
} from "@/lib/services/documents";

export type ActionState = { error?: string } | undefined;

const draftSchema = z.object({
  type: z.enum(["INVOICE", "QUOTE"]),
  clientId: z.string().min(1, "Client requis"),
  projectId: z.string().optional(),
  versionId: z.string().optional(),
  activity: z.enum(["SERVICE_BNC", "GOODS"]).default("SERVICE_BNC"),
  vatRate: z.coerce.number().min(0).max(100),
  notes: z.string().max(2000).optional(),
});

function parseItems(formData: FormData) {
  const raw = formData.get("items");
  if (!raw) return null;
  try {
    return itemsSchema.parse(JSON.parse(String(raw)));
  } catch {
    return null;
  }
}

export async function createDocumentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = draftSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const items = parseItems(formData);
  if (!items) return { error: "Ajoutez au moins une ligne valide." };

  const doc = await createDraft({
    type: parsed.data.type,
    clientId: parsed.data.clientId,
    projectId: parsed.data.projectId || null,
    versionId: parsed.data.versionId || null,
    activity: parsed.data.activity,
    vatRate: parsed.data.vatRate,
    items,
    notes: parsed.data.notes,
  });
  redirect(`/admin/documents/${doc.id}`);
}

const updateSchema = draftSchema.omit({ type: true }).extend({
  id: z.string().min(1),
});

export async function updateDocumentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const items = parseItems(formData);
  if (!items) return { error: "Ajoutez au moins une ligne valide." };

  const res = await updateDraft(parsed.data.id, {
    clientId: parsed.data.clientId,
    projectId: parsed.data.projectId || null,
    versionId: parsed.data.versionId || null,
    activity: parsed.data.activity,
    vatRate: parsed.data.vatRate,
    items,
    notes: parsed.data.notes,
  });
  if ("error" in res && res.error) return { error: res.error.message };
  revalidatePath(`/admin/documents/${parsed.data.id}`);
  return undefined;
}

async function simpleDocAction(
  formData: FormData,
  fn: (id: string) => Promise<{ error?: { message: string } } | unknown>
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Document manquant." };
  const res = (await fn(id)) as { error?: { message: string } };
  if (res && "error" in res && res.error) return { error: res.error.message };
  revalidatePath(`/admin/documents/${id}`);
  revalidatePath("/admin/documents");
  return undefined;
}

export async function issueDocumentAction(_p: ActionState, formData: FormData) {
  return simpleDocAction(formData, issueDocument);
}

export async function markPaidAction(_p: ActionState, formData: FormData) {
  // Date de paiement optionnelle (yyyy-MM-dd) choisie par l'admin
  const raw = String(formData.get("paidAt") ?? "");
  const paidAt = raw ? new Date(`${raw}T12:00:00`) : undefined;
  // Encaissement déjà saisi à rattacher (facture acquittée émise après coup).
  const paymentId = String(formData.get("paymentId") ?? "") || undefined;
  return simpleDocAction(formData, (id) => markInvoicePaid(id, paidAt, paymentId));
}

export async function unmarkPaidAction(_p: ActionState, formData: FormData) {
  return simpleDocAction(formData, unmarkInvoicePaid);
}

export async function restoreDocumentAction(_p: ActionState, formData: FormData) {
  return simpleDocAction(formData, restoreDocument);
}

export async function acceptQuoteAction(_p: ActionState, formData: FormData) {
  return simpleDocAction(formData, (id) => setQuoteStatus(id, "ACCEPTED"));
}

export async function refuseQuoteAction(_p: ActionState, formData: FormData) {
  return simpleDocAction(formData, (id) => setQuoteStatus(id, "REFUSED"));
}

export async function cancelDocumentAction(_p: ActionState, formData: FormData) {
  return simpleDocAction(formData, cancelDocument);
}

export async function convertQuoteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Devis manquant." };
  const res = await convertQuoteToInvoice(id);
  if ("error" in res && res.error) return { error: res.error.message };
  redirect(`/admin/documents/${res.document.id}`);
}

export async function deleteDocumentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Document manquant." };
  const res = await deleteDraft(id);
  if ("error" in res && res.error) return { error: res.error.message };
  redirect("/admin/documents");
}
