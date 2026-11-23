import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getReferrerDetail } from "@/lib/services/referrers";
import { ReferrerForm } from "@/components/referrers/referrer-form";
import { ReferrerPayoutsCard } from "@/components/referrers/referrer-payouts-card";
import { BackButton } from "@/components/nav/back-button";
import { formatEUR } from "@/lib/finance";
import {
  Card,
  CardContent,
  CardDescription,
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

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default async function ReferrerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const data = await getReferrerDetail(id, new Date());
  if (!data) notFound();
  const { referrer, commissions, totalDue, activeDue, totalPaid, remaining } =
    data;

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton href="/admin/referrers" label="Apporteurs" />
      <h1 className="text-2xl font-semibold">{referrer.name}</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-background">
          <CardHeader>
            <CardDescription>Commission due (total)</CardDescription>
            <CardTitle className="text-2xl">{formatEUR(totalDue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-background">
          <CardHeader>
            <CardDescription>Dont fenêtres encore actives</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatEUR(activeDue)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-background">
          <CardHeader>
            <CardDescription>Déjà réglé</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {formatEUR(totalPaid)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-background">
          <CardHeader>
            <CardDescription>Reste à payer</CardDescription>
            <CardTitle
              className={`text-2xl ${
                remaining > 0 ? "text-amber-600" : "text-muted-foreground"
              }`}
            >
              {formatEUR(remaining)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients apportés</CardTitle>
          <CardDescription>
            Commission = % de tout l&apos;encaissé du client dans sa fenêtre
            d&apos;apport (CA HT)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun client rattaché. Va sur une fiche client pour l&apos;associer.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Fenêtre</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead className="text-right">CA HT</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.clientId}>
                    <TableCell>
                      <Link
                        href={`/admin/clients/${c.clientId}`}
                        className="font-medium hover:underline"
                      >
                        {c.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.windowStart && c.windowEnd ? (
                        <>
                          {dateFmt.format(c.windowStart)} →{" "}
                          {dateFmt.format(c.windowEnd)}
                          {c.active ? (
                            <span className="ml-1 text-emerald-600">• actif</span>
                          ) : (
                            <span className="ml-1">• terminé</span>
                          )}
                        </>
                      ) : (
                        "Date d'apport manquante"
                      )}
                    </TableCell>
                    <TableCell className="text-right">{c.rate}%</TableCell>
                    <TableCell className="text-right">{formatEUR(c.htInWindow)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatEUR(c.commission)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReferrerPayoutsCard
        referrerId={referrer.id}
        remaining={remaining}
        payouts={referrer.payouts.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          note: p.note,
          paidAt: p.paidAt.toISOString(),
        }))}
      />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Coordonnées</h2>
        <ReferrerForm
          referrer={{
            id: referrer.id,
            name: referrer.name,
            email: referrer.email,
            phone: referrer.phone,
            iban: referrer.iban,
            notes: referrer.notes,
            defaultCommissionRate: Number(referrer.defaultCommissionRate),
          }}
        />
      </div>
    </div>
  );
}
