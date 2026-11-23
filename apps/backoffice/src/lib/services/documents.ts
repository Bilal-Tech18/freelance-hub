import "server-only";

import type { Client, Setting } from "@prisma/client";
import { db } from "@/lib/db";
import { computeTotals, docDayKey, formatDocNumber, type LineItem } from "@/lib/documents";
import { getSettings } from "@/lib/services/settings";

export type DocumentServiceError = { code: "NOT_FOUND" | "INVALID"; message: string };

export function sellerSnapshot(s: Setting) {
  return {
    name: s.sellerName ?? "",
    legalForm: s.sellerLegalForm ?? "",
    addressLine1: s.sellerAddressLine1 ?? "",
    addressLine2: s.sellerAddressLine2 ?? "",
    postalCode: s.sellerPostalCode ?? "",
    city: s.sellerCity ?? "",
    country: s.sellerCountry ?? "France",
    email: s.sellerEmail ?? "",
    phone: s.sellerPhone ?? "",
    siret: s.siret ?? "",
    vatNumber: s.vatNumber ?? "",
    apeCode: s.apeCode ?? "",
    iban: s.iban ?? "",
    bic: s.bic ?? "",
    bankName: s.bankName ?? "",
    vatExempt: s.vatExempt,
    legalMentions: s.legalMentions ?? "",
  };
}

export function clientSnapshot(c: Client) {
  const displayName =
    c.billingType === "COMPANY"
      ? c.legalName || c.name
      : c.contactName || c.name;
  return {
    billingType: c.billingType,
    displayName,
    contactName: c.contactName ?? "",
    email: c.billingEmail || c.contactEmail || "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    postalCode: c.postalCode ?? "",
    city: c.city ?? "",
    country: c.country ?? "France",
    siret: c.siret ?? "",
    siren: c.siren ?? "",
    vatNumber: c.vatNumber ?? "",
    legalForm: c.legalForm ?? "",
  };
}

type CreateInput = {
  type: "INVOICE" | "QUOTE";
  clientId: string;
  projectId?: string | null;
  versionId?: string | null;
  activity?: "SERVICE_BNC" | "GOODS";
  vatRate: number;
  items: LineItem[];
  notes?: string;
};

/** La version n'est gardée que si elle appartient bien au projet du document. */
async function resolveVersionId(projectId?: string | null, versionId?: string | null) {
  if (!projectId || !versionId) return null;
  const v = await db.projectVersion.findUnique({
    where: { id: versionId },
    select: { projectId: true },
  });
  return v?.projectId === projectId ? versionId : null;
}

export async function createDraft(input: CreateInput) {
  const totals = computeTotals(input.items, input.vatRate);
  return db.document.create({
    data: {
      type: input.type,
      clientId: input.clientId,
      projectId: input.projectId || null,
      versionId: await resolveVersionId(input.projectId, input.versionId),
      activity: input.activity ?? "SERVICE_BNC",
      vatRate: input.vatRate,
      items: input.items,
      notes: input.notes,
      ...totals,
    },
  });
}

type UpdateInput = {
  clientId: string;
  projectId?: string | null;
  versionId?: string | null;
  activity?: "SERVICE_BNC" | "GOODS";
  vatRate: number;
  items: LineItem[];
  notes?: string;
};

export async function updateDraft(id: string, input: UpdateInput) {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return { error: { code: "NOT_FOUND", message: "Document introuvable." } as DocumentServiceError };
  if (doc.status !== "DRAFT")
    return { error: { code: "INVALID", message: "Seuls les brouillons sont modifiables." } as DocumentServiceError };

  const totals = computeTotals(input.items, input.vatRate);
  const updated = await db.document.update({
    where: { id },
    data: {
      clientId: input.clientId,
      projectId: input.projectId || null,
      versionId: await resolveVersionId(input.projectId, input.versionId),
      activity: input.activity ?? "SERVICE_BNC",
      vatRate: input.vatRate,
      items: input.items,
      notes: input.notes,
      ...totals,
    },
  });
  return { document: updated };
}

/** Émet le document : numéro séquentiel, snapshots figés, échéances. */
export async function issueDocument(id: string) {
  const settings = await getSettings();
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!doc) return { error: { code: "NOT_FOUND", message: "Document introuvable." } as DocumentServiceError };
    if (doc.status !== "DRAFT")
      return { error: { code: "INVALID", message: "Document déjà émis." } as DocumentServiceError };

    const now = new Date();
    // Série du jour d'émission (UTC) : rang suivant dans la journée.
    const { year, minSeq, maxSeq } = docDayKey(now);
    const last = await tx.document.findFirst({
      where: { type: doc.type, year, seq: { gte: minSeq, lte: maxSeq } },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    const seq = last?.seq != null ? last.seq + 1 : minSeq;
    if (seq > maxSeq)
      return { error: { code: "INVALID", message: "Limite de documents émis pour aujourd'hui atteinte." } as DocumentServiceError };
    const prefix = doc.type === "INVOICE" ? settings.invoicePrefix : settings.quotePrefix;

    const dueDate =
      doc.type === "INVOICE"
        ? new Date(now.getTime() + settings.paymentTermsDays * 86400000)
        : null;
    const validUntil =
      doc.type === "QUOTE"
        ? new Date(now.getTime() + settings.quoteValidityDays * 86400000)
        : null;

    const updated = await tx.document.update({
      where: { id },
      data: {
        status: "ISSUED",
        number: formatDocNumber(prefix, year, seq),
        year,
        seq,
        issueDate: now,
        dueDate,
        validUntil,
        sellerSnapshot: sellerSnapshot(settings),
        clientSnapshot: clientSnapshot(doc.client),
      },
    });
    return { document: updated };
  });
}

/**
 * Facture payée -> encaissement DÉCLARÉ auto (si projet lié).
 * `existingPaymentId` : facture acquittée émise après coup — on la rattache à
 * l'encaissement déjà saisi au lieu d'en créer un second (double comptage).
 */
export async function markInvoicePaid(
  id: string,
  paidAt?: Date,
  existingPaymentId?: string
) {
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id } });
    if (!doc) return { error: { code: "NOT_FOUND", message: "Document introuvable." } as DocumentServiceError };
    if (doc.type !== "INVOICE")
      return { error: { code: "INVALID", message: "Seules les factures peuvent être payées." } as DocumentServiceError };
    if (doc.status === "PAID") return { document: doc };
    if (doc.status !== "ISSUED")
      return { error: { code: "INVALID", message: "La facture doit être émise avant d'être payée." } as DocumentServiceError };

    // Date de paiement fournie par l'admin (défaut : aujourd'hui)
    const paidDate =
      paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : new Date();
    let paymentId: string | null = null;
    if (existingPaymentId) {
      const existing = await tx.payment.findUnique({
        where: { id: existingPaymentId },
        include: { document: { select: { id: true } } },
      });
      if (!existing || !doc.projectId || existing.projectId !== doc.projectId)
        return { error: { code: "INVALID", message: "Encaissement introuvable pour ce projet." } as DocumentServiceError };
      if (existing.document)
        return { error: { code: "INVALID", message: "Cet encaissement est déjà lié à une autre facture." } as DocumentServiceError };
      // Ne complète que ce qui manque : l'encaissement saisi fait foi.
      await tx.payment.update({
        where: { id: existing.id },
        data: {
          versionId: existing.versionId ?? doc.versionId,
          vatRate: existing.vatRate ?? doc.vatRate,
        },
      });
      const updated = await tx.document.update({
        where: { id },
        data: { status: "PAID", paidAt: existing.paidAt, paymentId: existing.id, paymentReused: true },
      });
      return { document: updated };
    }
    if (doc.projectId) {
      const payment = await tx.payment.create({
        data: {
          projectId: doc.projectId,
          amount: doc.total,
          // Le taux de la facture, pas celui du projet : une facture exonérée
          // sur un projet à 20 % doit entrer en CA pour son HT réel.
          vatRate: doc.vatRate,
          method: `Facture ${doc.number ?? ""}`.trim(),
          paidAt: paidDate,
          versionId: doc.versionId,
        },
      });
      paymentId = payment.id;
    }
    const updated = await tx.document.update({
      where: { id },
      data: { status: "PAID", paidAt: paidDate, paymentId },
    });
    return { document: updated };
  });
}

/** Annule le paiement par erreur : PAID -> ISSUED, encaissement auto supprimé. */
export async function unmarkInvoicePaid(id: string) {
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id } });
    if (!doc) return { error: { code: "NOT_FOUND", message: "Document introuvable." } as DocumentServiceError };
    if (doc.status !== "PAID")
      return { error: { code: "INVALID", message: "Cette facture n'est pas marquée payée." } as DocumentServiceError };

    if (doc.paymentId) {
      await tx.document.update({ where: { id }, data: { paymentId: null, paymentReused: false } });
      // Un encaissement saisi avant la facture reste : il a vraiment eu lieu.
      if (!doc.paymentReused)
        await tx.payment.delete({ where: { id: doc.paymentId } }).catch(() => {});
    }
    const updated = await tx.document.update({
      where: { id },
      data: { status: "ISSUED", paidAt: null },
    });
    return { document: updated };
  });
}

/** Rétablit un document annulé (vers Émis s'il a un numéro, sinon Brouillon). */
export async function restoreDocument(id: string) {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return { error: { code: "NOT_FOUND", message: "Document introuvable." } as DocumentServiceError };
  if (doc.status !== "CANCELLED")
    return { error: { code: "INVALID", message: "Seuls les documents annulés peuvent être rétablis." } as DocumentServiceError };
  const updated = await db.document.update({
    where: { id },
    data: { status: doc.number ? "ISSUED" : "DRAFT" },
  });
  return { document: updated };
}

export async function setQuoteStatus(id: string, status: "ACCEPTED" | "REFUSED") {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return { error: { code: "NOT_FOUND", message: "Document introuvable." } as DocumentServiceError };
  if (doc.type !== "QUOTE")
    return { error: { code: "INVALID", message: "Réservé aux devis." } as DocumentServiceError };
  const updated = await db.document.update({
    where: { id },
    data: { status, acceptedAt: status === "ACCEPTED" ? new Date() : null },
  });
  return { document: updated };
}

/** Crée une facture (brouillon) à partir d'un devis. */
export async function convertQuoteToInvoice(id: string) {
  return db.$transaction(async (tx) => {
    const quote = await tx.document.findUnique({ where: { id } });
    if (!quote) return { error: { code: "NOT_FOUND", message: "Devis introuvable." } as DocumentServiceError };
    if (quote.type !== "QUOTE")
      return { error: { code: "INVALID", message: "Ce document n'est pas un devis." } as DocumentServiceError };
    if (quote.convertedToId)
      return { error: { code: "INVALID", message: "Devis déjà converti." } as DocumentServiceError };

    const invoice = await tx.document.create({
      data: {
        type: "INVOICE",
        clientId: quote.clientId,
        projectId: quote.projectId,
        vatRate: quote.vatRate,
        items: quote.items ?? [],
        notes: quote.notes,
        subtotal: quote.subtotal,
        vatAmount: quote.vatAmount,
        total: quote.total,
      },
    });
    await tx.document.update({
      where: { id },
      data: { convertedToId: invoice.id },
    });
    return { document: invoice };
  });
}

/** Annule un document et supprime l'encaissement auto éventuel. */
export async function cancelDocument(id: string) {
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id } });
    if (!doc) return { error: { code: "NOT_FOUND", message: "Document introuvable." } as DocumentServiceError };
    if (doc.paymentId) {
      await tx.document.update({ where: { id }, data: { paymentId: null, paymentReused: false } });
      // Un encaissement saisi avant la facture reste : il a vraiment eu lieu.
      if (!doc.paymentReused)
        await tx.payment.delete({ where: { id: doc.paymentId } }).catch(() => {});
    }
    const updated = await tx.document.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return { document: updated };
  });
}

export async function deleteDraft(id: string) {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return { error: { code: "NOT_FOUND", message: "Document introuvable." } as DocumentServiceError };
  if (doc.status !== "DRAFT" && doc.status !== "CANCELLED")
    return {
      error: {
        code: "INVALID",
        message: "Seuls les brouillons et documents annulés peuvent être supprimés. Annulez d'abord le document.",
      } as DocumentServiceError,
    };
  await db.document.delete({ where: { id } });
  return { ok: true };
}
