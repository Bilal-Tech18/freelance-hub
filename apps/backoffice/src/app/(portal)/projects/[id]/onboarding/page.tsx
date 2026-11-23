import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, getScopedProjectWhere } from "@/lib/authz";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { BackButton } from "@/components/nav/back-button";
import type { OnboardingAnswers } from "@/lib/onboarding-schema";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ...getScopedProjectWhere(user) },
    include: {
      client: true,
      onboarding: true,
      credentialRequests: { orderBy: { order: "asc" } },
    },
  });
  if (!project) notFound();

  const onboarding =
    project.onboarding ??
    (await db.onboardingResponse.create({ data: { projectId: project.id } }));

  const c = project.client;

  return (
    <div className="space-y-6 max-w-2xl">
      <BackButton href={`/projects/${project.id}`} label="Retour au projet" />
      <div>
        <h1 className="text-2xl font-semibold">Bienvenue 👋</h1>
        <p className="text-muted-foreground">
          Quelques informations pour démarrer <strong>{project.name}</strong>.
          Vous pouvez passer une étape et y revenir plus tard.
        </p>
      </div>
      <OnboardingWizard
        projectId={project.id}
        projectName={project.name}
        clientInfo={{
          billingType: c.billingType,
          legalName: c.legalName,
          contactName: c.contactName,
          billingEmail: c.billingEmail,
          phone: c.phone,
          addressLine1: c.addressLine1,
          addressLine2: c.addressLine2,
          postalCode: c.postalCode,
          city: c.city,
          country: c.country,
          siret: c.siret,
          vatNumber: c.vatNumber,
          legalForm: c.legalForm,
        }}
        answers={onboarding.answers as Partial<OnboardingAnswers>}
        credentialRequests={project.credentialRequests.map((r) => ({
          id: r.id,
          provider: r.provider,
          label: r.label,
          instructions: r.instructions,
          required: r.required,
          status: r.status,
        }))}
        submitted={onboarding.status === "SUBMITTED" || onboarding.status === "REVIEWED"}
      />
    </div>
  );
}
