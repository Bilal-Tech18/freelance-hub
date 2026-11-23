import { getSessionUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { sellerSnapshot, clientSnapshot } from "@/lib/services/documents";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { DOC_TYPE_LABELS, type LineItem } from "@/lib/documents";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!doc) return new Response("Not found", { status: 404 });

  const settings = await getSettings();
  const seller =
    (doc.sellerSnapshot as Record<string, string | boolean> | null) ??
    sellerSnapshot(settings);
  const client =
    (doc.clientSnapshot as Record<string, string | boolean> | null) ??
    clientSnapshot(doc.client);

  const buffer = await renderDocumentPdf({
    type: doc.type,
    number: doc.number ?? "BROUILLON",
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    validUntil: doc.validUntil,
    // Seule une facture au statut PAID porte l'acquit : une facture annulée
    // peut avoir gardé une date de paiement.
    paidAt: doc.status === "PAID" ? doc.paidAt : null,
    vatRate: Number(doc.vatRate),
    items: (doc.items as unknown as LineItem[]) ?? [],
    subtotal: Number(doc.subtotal),
    vatAmount: Number(doc.vatAmount),
    total: Number(doc.total),
    notes: doc.notes,
    seller,
    client,
  });

  const filename = `${DOC_TYPE_LABELS[doc.type]}-${doc.number ?? doc.id}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
