import type { DocumentType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { getSettings } from "@/lib/services/settings";
import { getProjectOptions } from "@/lib/services/finance";
import { DocumentEditor } from "@/components/documents/document-editor";
import { BackButton } from "@/components/nav/back-button";
import { DOC_TYPE_LABELS } from "@/lib/documents";

export const metadata = { title: "Nouveau document" };

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; client?: string; project?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const type: DocumentType = sp.type === "QUOTE" ? "QUOTE" : "INVOICE";

  const [clients, projects, settings] = await Promise.all([
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getProjectOptions(),
    getSettings(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton href="/admin/documents" label="Facturation" />
      <h1 className="text-2xl font-semibold">
        Nouveau {DOC_TYPE_LABELS[type].toLowerCase()}
      </h1>
      <DocumentEditor
        mode="create"
        type={type}
        clients={clients}
        projects={projects}
        defaultVatRate={Number(settings.defaultVatRate)}
        defaultClientId={clients.some((c) => c.id === sp.client) ? sp.client : undefined}
        defaultProjectId={projects.some((p) => p.id === sp.project) ? sp.project : undefined}
      />
    </div>
  );
}
