import { requireAdmin } from "@/lib/authz";
import { getMonitoringOverview } from "@/lib/services/monitoring";
import { formatDuration } from "@/lib/duration";
import { CheckNowButton } from "@/components/monitoring/check-now-button";
import { MonitorToggle } from "@/components/monitoring/monitor-toggle";
import { DeleteSiteButton } from "@/components/monitoring/delete-site-button";
import { RestoreSiteButton } from "@/components/monitoring/restore-site-button";
import { AddSiteForm } from "@/components/monitoring/add-site-form";
import { Badge } from "@/components/ui/badge";
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

export const metadata = { title: "Monitoring" };

const checkedFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function StatusBadge({
  status,
  enabled,
}: {
  status: "UP" | "DOWN" | "UNKNOWN";
  enabled: boolean;
}) {
  if (!enabled) return <Badge variant="outline">Désactivé</Badge>;
  if (status === "UP")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
        En ligne
      </Badge>
    );
  if (status === "DOWN")
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300">
        Down
      </Badge>
    );
  return <Badge variant="secondary">Pas encore vérifié</Badge>;
}

export default async function MonitoringPage() {
  await requireAdmin();
  const { sites, hiddenSites, monitored, up, down } = await getMonitoringOverview();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Monitoring des sites</h1>
          <p className="text-sm text-muted-foreground">
            {monitored} site{monitored > 1 ? "s" : ""} surveillé
            {monitored > 1 ? "s" : ""} ·{" "}
            {down > 0 ? (
              <span className="font-medium text-red-600">{down} down</span>
            ) : (
              <span className="text-emerald-600">{up} en ligne, aucun incident</span>
            )}
            . Visible uniquement par toi — alerte email si un site tombe.
          </p>
        </div>
        <CheckNowButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un site</CardTitle>
          <CardDescription>
            N&apos;importe quelle URL à surveiller, en plus des projets clients
            (portfolio, app, staging…).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddSiteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sites surveillés</CardTitle>
          <CardDescription>
            Projets avec une URL + sites ajoutés à la main. La vérification
            automatique tourne toutes les 30 minutes ; une alerte part quand un
            site tombe, puis toutes les 6 h tant qu&apos;il reste down, et à
            son rétablissement.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun site à surveiller — ajoute une URL ci-dessus ou renseigne
              l&apos;URL d&apos;un projet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Détail</TableHead>
                  <TableHead className="text-right">Réponse</TableHead>
                  <TableHead>Dernière vérif.</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((s) => (
                  <TableRow key={s.key} className={!s.enabled ? "opacity-60" : ""}>
                    <TableCell>
                      <span className="font-medium">{s.name}</span>
                      {s.clientName && (
                        <span className="text-muted-foreground"> · {s.clientName}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline-offset-2 hover:underline"
                      >
                        {s.url.replace(/^https?:\/\//, "")}
                      </a>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} enabled={s.enabled} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.status === "DOWN" ? (
                        <>
                          {s.lastStatusCode ? `HTTP ${s.lastStatusCode}` : s.lastError}
                          {s.downSince && s.lastCheckedAt && (
                            <>
                              {" "}
                              · down depuis{" "}
                              {formatDuration(
                                s.lastCheckedAt.getTime() - s.downSince.getTime()
                              )}
                            </>
                          )}
                        </>
                      ) : s.lastStatusCode ? (
                        `HTTP ${s.lastStatusCode}`
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {s.responseMs !== null && s.status === "UP"
                        ? `${s.responseMs} ms`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.lastCheckedAt ? checkedFmt.format(s.lastCheckedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <MonitorToggle
                          projectId={s.projectId ?? undefined}
                          monitorId={s.monitorId ?? undefined}
                          enabled={s.enabled}
                        />
                        <DeleteSiteButton
                          monitorId={s.custom ? (s.monitorId ?? undefined) : undefined}
                          projectId={s.projectId ?? undefined}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {hiddenSites.length > 0 && (
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Retirés du monitoring :{" "}
              {hiddenSites.map((h, i) => (
                <span key={h.projectId}>
                  {i > 0 && " · "}
                  {h.name}
                  {h.clientName ? ` (${h.clientName})` : ""}{" "}
                  <RestoreSiteButton projectId={h.projectId} />
                </span>
              ))}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
