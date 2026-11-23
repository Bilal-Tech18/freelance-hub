import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { InviteForm } from "@/components/clients/invite-form";
import { NewProjectForm } from "@/components/clients/new-project-form";
import { BillingInfoForm } from "@/components/clients/billing-info-form";
import { ClientInfoForm } from "@/components/clients/client-info-form";
import { ReferralCard } from "@/components/referrers/referral-card";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { BackButton } from "@/components/nav/back-button";
import { ProjectStatusBadge } from "@/components/tickets/badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [client, referrers] = await Promise.all([
    db.client.findUnique({
      where: { id },
      include: {
        users: { orderBy: { createdAt: "asc" } },
        projects: { orderBy: { createdAt: "desc" } },
        invitations: {
          where: { acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.referrer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <BackButton href="/admin/clients" label="Clients" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          {client.contactEmail && (
            <p className="text-muted-foreground">{client.contactEmail}</p>
          )}
        </div>
        <DeleteClientButton clientId={client.id} clientName={client.name} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun projet.</p>
            ) : (
              <ul className="space-y-2">
                {client.projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <ProjectStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">Nouveau projet</p>
              <NewProjectForm clientId={client.id} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Accès client</CardTitle>
              <CardDescription>
                Invitez les personnes qui suivront les projets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.users.length > 0 && (
                <ul className="space-y-1">
                  {client.users.map((u) => (
                    <li key={u.id} className="text-sm">
                      <span className="font-medium">{u.name}</span>{" "}
                      <span className="text-muted-foreground">({u.email})</span>
                    </li>
                  ))}
                </ul>
              )}
              {client.invitations.length > 0 && (
                <ul className="space-y-1">
                  {client.invitations.map((i) => (
                    <li key={i.id} className="text-sm text-muted-foreground">
                      {i.email} — invitation en attente
                    </li>
                  ))}
                </ul>
              )}
              <InviteForm clientId={client.id} />
            </CardContent>
          </Card>

          <ClientInfoForm
            clientId={client.id}
            info={{
              name: client.name,
              contactEmail: client.contactEmail,
              notes: client.notes,
            }}
          />
        </div>
      </div>

      <BillingInfoForm
        clientId={client.id}
        billing={{
          billingType: client.billingType,
          legalName: client.legalName,
          contactName: client.contactName,
          billingEmail: client.billingEmail,
          addressLine1: client.addressLine1,
          addressLine2: client.addressLine2,
          postalCode: client.postalCode,
          city: client.city,
          country: client.country,
          siret: client.siret,
          siren: client.siren,
          vatNumber: client.vatNumber,
          legalForm: client.legalForm,
        }}
      />

      <ReferralCard
        clientId={client.id}
        referrers={referrers}
        current={{
          referrerId: client.referrerId,
          referralDate: client.referralDate
            ? client.referralDate.toISOString().slice(0, 10)
            : null,
          commissionRate:
            client.commissionRate != null ? Number(client.commissionRate) : null,
          referralDurationMonths: client.referralDurationMonths,
        }}
      />
    </div>
  );
}
