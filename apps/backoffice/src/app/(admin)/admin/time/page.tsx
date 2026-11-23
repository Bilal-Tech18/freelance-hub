import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { getTimeOverview } from "@/lib/services/time";
import { formatDuration } from "@/lib/duration";
import { TimerCard } from "@/components/time/timer-card";
import { DeleteEntryButton } from "@/components/time/delete-entry-button";
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

export const metadata = { title: "Suivi du temps" };

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Paris",
});

export default async function TimePage() {
  await requireAdmin();
  const [overview, projects] = await Promise.all([
    getTimeOverview(),
    db.project.findMany({
      where: { status: { notIn: ["ARCHIVED"] } },
      select: { id: true, name: true, client: { select: { name: true } } },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  const projectOptions = projects.map((p) => ({
    id: p.id,
    label: `${p.client.name} / ${p.name}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Suivi du temps</h1>
        <p className="text-sm text-muted-foreground">
          Temps passé par projet et par jour ·{" "}
          {overview.todayMs > 0
            ? `aujourd'hui : ${formatDuration(overview.todayMs)}`
            : "rien d'enregistré aujourd'hui"}
        </p>
      </div>

      <TimerCard projects={projectOptions} running={overview.running} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Par jour</CardTitle>
            <CardDescription>14 derniers jours, répartition par projet</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.days.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune entrée — lance le timer pour commencer.
              </p>
            ) : (
              <ul className="space-y-3">
                {overview.days.map((d) => (
                  <li key={d.key} className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium capitalize">
                        {d.label}
                        {d.isToday && (
                          <span className="ml-2 text-xs text-emerald-600">
                            aujourd&apos;hui
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatDuration(d.totalMs)}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {d.perProject.map((p) => (
                        <li
                          key={p.label}
                          className="flex justify-between text-xs text-muted-foreground"
                        >
                          <span>{p.label}</span>
                          <span className="tabular-nums">{formatDuration(p.ms)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Par projet</CardTitle>
            <CardDescription>Mois en cours et total</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune entrée.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead className="text-right">Ce mois</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-medium">{p.name}</span>{" "}
                        <span className="text-muted-foreground">· {p.clientName}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.monthMs > 0 ? formatDuration(p.monthMs) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDuration(p.totalMs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dernières entrées</CardTitle>
          <CardDescription>
            Supprime une entrée si tu as oublié d&apos;arrêter le timer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune entrée terminée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Jour</TableHead>
                  <TableHead>Créneau</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.recent.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.label}</TableCell>
                    <TableCell>{dayFmt.format(e.startedAt)}</TableCell>
                    <TableCell className="tabular-nums">
                      {timeFmt.format(e.startedAt)} → {timeFmt.format(e.endedAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(e.ms)}
                    </TableCell>
                    <TableCell>
                      <DeleteEntryButton id={e.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
