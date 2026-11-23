import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { getSettings } from "@/lib/services/settings";
import { getProjectOptions } from "@/lib/services/finance";
import { DocumentEditor } from "@/components/documents/document-editor";
import { DocumentActions } from "@/components/documents/document-actions";
import { BackButton } from "@/components/nav/back-button";
import { formatEUR } from "@/lib/finance";
import {
  DOC_STATUS_CLASS,
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  isDocOverdue,
  OVERDUE_CLASS,
  OVERDUE_LABEL,
  type DocumentStatus,
  type LineItem,
} from "@/lib/documents";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      version: { select: { label: true } },
      convertedTo: { select: { id: true, number: true } },
    },
  });
  if (!doc) notFound();

  const typeLabel = DOC_TYPE_LABELS[doc.type];

  // Brouillon → éditeur complet
  if (doc.status === "DRAFT") {
    const [clients, projects, settings] = await Promise.all([
      db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      getProjectOptions(),
      getSettings(),
    ]);
    return (
      <div className="max-w-3xl space-y-6">
        <BackButton href="/admin/documents" label="Facturation" />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{typeLabel} — brouillon</h1>
          <DocumentActions id={doc.id} type={doc.type} status="DRAFT" converted={false} />
        </div>
        <p className="text-sm text-muted-foreground">
          « Émettre » attribue le numéro et fige le document — aucun email
          n&apos;est envoyé : téléchargez le PDF et envoyez-le vous-même.
        </p>
        <DocumentEditor
          mode="edit"
          id={doc.id}
          type={doc.type}
          clients={clients}
          projects={projects}
          defaultVatRate={Number(settings.defaultVatRate)}
          initial={{
            clientId: doc.clientId,
            projectId: doc.projectId,
            versionId: doc.versionId,
            activity: doc.activity,
            vatRate: Number(doc.vatRate),
            items: (doc.items as unknown as LineItem[]) ?? [],
            notes: doc.notes,
          }}
        />
      </div>
    );
  }

  const items = (doc.items as unknown as LineItem[]) ?? [];

  // Encaissements du projet pas encore liés à une facture : une facture
  // acquittée émise après coup s'y rattache au lieu d'en créer un doublon.
  const paymentCandidates =
    doc.type === "INVOICE" && doc.status === "ISSUED" && doc.projectId
      ? (
          await db.payment.findMany({
            where: {
              projectId: doc.projectId,
              document: { is: null },
              ...(doc.versionId
                ? { OR: [{ versionId: doc.versionId }, { versionId: null }] }
                : {}),
            },
            include: { version: { select: { label: true } } },
            orderBy: { paidAt: "desc" },
          })
        ).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidAt: p.paidAt.toISOString(),
          label: [p.version?.label, p.method].filter(Boolean).join(" · "),
        }))
      : [];

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton href="/admin/documents" label="Facturation" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {typeLabel} {doc.number}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOC_STATUS_CLASS[doc.status as DocumentStatus]}`}
          >
            {DOC_STATUS_LABELS[doc.status as DocumentStatus]}
          </span>
          {isDocOverdue(doc) && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${OVERDUE_CLASS}`}
            >
              {OVERDUE_LABEL}
            </span>
          )}
        </div>
        <DocumentActions
          id={doc.id}
          type={doc.type}
          status={doc.status}
          converted={Boolean(doc.convertedTo)}
          total={Number(doc.total)}
          paymentCandidates={paymentCandidates}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Client :{" "}
        <Link href={`/admin/clients/${doc.client.id}`} className="hover:underline">
          {doc.client.name}
        </Link>
        {doc.project && (
          <>
            {" · Projet : "}
            <Link href={`/admin/projects/${doc.project.id}`} className="hover:underline">
              {doc.project.name}
            </Link>
            {doc.version && <> ({doc.version.label})</>}
          </>
        )}
        {doc.issueDate && <> · Émis le {dateFmt.format(doc.issueDate)}</>}
        {doc.type === "INVOICE" && doc.dueDate && (
          <> · Échéance {dateFmt.format(doc.dueDate)}</>
        )}
        {doc.type === "QUOTE" && doc.validUntil && (
          <> · Valable jusqu&apos;au {dateFmt.format(doc.validUntil)}</>
        )}
      </p>

      {doc.convertedTo && (
        <p className="text-sm">
          Converti en facture{" "}
          <Link
            href={`/admin/documents/${doc.convertedTo.id}`}
            className="font-medium hover:underline"
          >
            {doc.convertedTo.number ?? "brouillon"}
          </Link>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lignes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">PU HT</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{formatEUR(it.unitPrice)}</TableCell>
                  <TableCell className="text-right">
                    {formatEUR(it.quantity * it.unitPrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span>{formatEUR(Number(doc.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                TVA ({Number(doc.vatRate)}%)
              </span>
              <span>{formatEUR(Number(doc.vatAmount))}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total TTC</span>
              <span>{formatEUR(Number(doc.total))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {doc.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{doc.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
