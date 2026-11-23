import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { MilestoneManager } from "@/components/milestones/milestone-manager";
import { computeProgress } from "@/components/milestones/timeline";
import { ProjectProgressControl } from "@/components/projects/project-progress-control";
import { CredentialRequestsManager } from "@/components/vault/credential-requests-manager";
import { BillingCard } from "@/components/finance/billing-card";
import { computeProjectFinancials } from "@/lib/finance";
import { toPaymentInputs } from "@/lib/services/finance";
import { BackButton } from "@/components/nav/back-button";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { MaintainerAssignment } from "@/components/projects/maintainer-assignment";
import {
  ONBOARDING_SECTIONS,
  type OnboardingAnswers,
} from "@/lib/onboarding-schema";
import { StatusBadge } from "@/components/tickets/badges";
import { ProjectStatusSelect } from "@/components/projects/project-status-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      tickets: { orderBy: { createdAt: "desc" }, take: 20 },
      milestones: { orderBy: { order: "asc" } },
      onboarding: true,
      payments: { orderBy: { paidAt: "desc" } },
      versions: {
        orderBy: { createdAt: "asc" },
        include: { document: { select: { number: true } } },
      },
      credentialRequests: { orderBy: { order: "asc" } },
      assignments: { select: { userId: true } },
      documents: {
        where: { type: "QUOTE", status: { in: ["DRAFT", "ISSUED", "ACCEPTED"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, number: true, subtotal: true, status: true },
      },
    },
  });
  if (!project) notFound();

  const maintainers = await db.user.findMany({
    where: { role: "MAINTAINER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  const assignedIds = new Set(project.assignments.map((a) => a.userId));

  const amountHt = project.amountHt != null ? Number(project.amountHt) : null;
  const vatRate = Number(project.vatRate);
  const financials = computeProjectFinancials(
    amountHt,
    vatRate,
    toPaymentInputs(project.payments)
  );

  return (
    <div className="space-y-6">
      <BackButton href="/admin/projects" label="Projets" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <ProjectStatusSelect projectId={project.id} status={project.status} />
        </div>
        <DeleteProjectButton projectId={project.id} projectName={project.name} />
      </div>
      <p className="text-muted-foreground">
        Client :{" "}
        <Link
          href={`/admin/clients/${project.clientId}`}
          className="hover:underline"
        >
          {project.client.name}
        </Link>
        {project.url && (
          <>
            {" · "}
            <a href={project.url} target="_blank" className="hover:underline">
              {project.url}
            </a>
          </>
        )}
      </p>

      <BillingCard
        projectId={project.id}
        clientId={project.clientId}
        amountHt={amountHt}
        vatRate={vatRate}
        financials={financials}
        payments={project.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          paidAt: p.paidAt.toISOString(),
          note: p.note,
          versionId: p.versionId,
          vatRate: p.vatRate == null ? null : Number(p.vatRate),
        }))}
        versions={project.versions.map((v) => ({
          id: v.id,
          label: v.label,
          amountHt: Number(v.amountHt),
          note: v.note,
          documentId: v.documentId,
          documentNumber: v.document?.number ?? null,
        }))}
        quotes={project.documents.map((d) => ({
          id: d.id,
          number: d.number,
          subtotal: Number(d.subtotal),
          status: d.status,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>
            Les mainteneurs assignés voient les tickets et le Vault (lecture
            seule) de ce projet dans leur espace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MaintainerAssignment
            projectId={project.id}
            maintainers={maintainers.map((m) => ({
              ...m,
              assigned: assignedIds.has(m.id),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jalons du projet</CardTitle>
          <CardDescription>
            Visibles par le client sur sa timeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProjectProgressControl
            projectId={project.id}
            computed={computeProgress(project.milestones)}
            override={project.progressOverride}
          />
          <MilestoneManager
            projectId={project.id}
            milestones={project.milestones}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accès demandés au client</CardTitle>
          <CardDescription>
            Sélectionne les comptes dont tu as besoin. Le client les fournit
            pendant l&apos;onboarding — stockés chiffrés dans le Vault.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialRequestsManager
            projectId={project.id}
            requests={project.credentialRequests.map((r) => ({
              id: r.id,
              provider: r.provider,
              label: r.label,
              required: r.required,
              status: r.status,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questionnaire d&apos;onboarding</CardTitle>
          <CardDescription>
            {project.onboarding?.status === "SUBMITTED"
              ? "Soumis par le client"
              : project.onboarding?.status === "REVIEWED"
                ? "Relu"
                : "En attente de réponse du client"}
          </CardDescription>
        </CardHeader>
        {project.onboarding && project.onboarding.status !== "PENDING" && (
          <CardContent className="space-y-4">
            {ONBOARDING_SECTIONS.map((section) => {
              const answers = project.onboarding!.answers as Partial<OnboardingAnswers>;
              const filled = section.fields.filter((f) => answers[f.name]?.trim());
              if (filled.length === 0) return null;
              return (
                <div key={section.id}>
                  <h3 className="text-sm font-semibold mb-2">{section.title}</h3>
                  <dl className="space-y-2">
                    {filled.map((f) => (
                      <div key={f.name}>
                        <dt className="text-xs text-muted-foreground">{f.label}</dt>
                        <dd className="text-sm whitespace-pre-wrap">
                          {answers[f.name]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets récents</CardTitle>
        </CardHeader>
        <CardContent>
          {project.tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun ticket.</p>
          ) : (
            <ul className="space-y-2">
              {project.tickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/admin/tickets/${t.id}`}
                    className="hover:underline"
                  >
                    #{t.number} — {t.title}
                  </Link>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
