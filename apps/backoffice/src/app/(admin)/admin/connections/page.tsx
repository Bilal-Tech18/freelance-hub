import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { formatUserAgent } from "@/lib/user-agent";
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
import { DataTable, type DataTableRow } from "@/components/ui/data-table";

export const metadata = { title: "Connexions" };

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** « il y a 5 min » / « il y a 3 h », sinon date complète. */
function relativeTime(date: Date, now: number): string {
  const diffMin = Math.round((now - date.getTime()) / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  return dateTimeFmt.format(date);
}

function RoleBadge({ role }: { role: string }) {
  return role === "ADMIN" ? (
    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
      Admin
    </Badge>
  ) : (
    <Badge variant="secondary">Client</Badge>
  );
}

export default async function ConnectionsPage() {
  await requireAdmin();
  const now = Date.now();

  const [activeSessions, events] = await Promise.all([
    db.session.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.loginEvent.findMany({
      take: 300,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
  ]);

  // Une entrée par utilisateur connecté (sessions triées par activité décroissante,
  // la première rencontrée est donc la plus récente).
  const connectedUsers = new Map<
    string,
    {
      user: (typeof activeSessions)[number]["user"];
      sessionCount: number;
      lastActivity: Date;
      lastIp: string | null;
      lastUserAgent: string | null;
    }
  >();
  for (const s of activeSessions) {
    const existing = connectedUsers.get(s.userId);
    if (existing) {
      existing.sessionCount += 1;
    } else {
      connectedUsers.set(s.userId, {
        user: s.user,
        sessionCount: 1,
        lastActivity: s.updatedAt,
        lastIp: s.ipAddress,
        lastUserAgent: s.userAgent,
      });
    }
  }

  const userOptions = [
    ...new Map(
      events.map((e) => [e.userId, { value: e.userId, label: e.user.name }])
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));

  const rows: DataTableRow[] = events.map((e) => ({
    id: e.id,
    searchText: `${e.user.name} ${e.user.email} ${e.ipAddress ?? ""}`,
    sortValues: {
      user: e.user.name,
      date: e.createdAt.getTime(),
      ip: e.ipAddress ?? "",
      device: formatUserAgent(e.userAgent),
    },
    filterValues: { user: e.userId },
    cells: {
      user: (
        <div>
          <span className="font-medium">{e.user.name}</span>
          <span className="ml-2 text-muted-foreground text-xs">
            {e.user.email}
          </span>
        </div>
      ),
      date: dateTimeFmt.format(e.createdAt),
      ip: <span className="text-muted-foreground">{e.ipAddress || "—"}</span>,
      device: (
        <span className="text-muted-foreground" title={e.userAgent ?? undefined}>
          {formatUserAgent(e.userAgent)}
        </span>
      ),
    },
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Connexions</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            Connectés en ce moment
            <Badge variant="secondary" className="ml-2 align-middle">
              {connectedUsers.size}
            </Badge>
          </CardTitle>
          <CardDescription>
            Utilisateurs avec une session active (non expirée).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectedUsers.size === 0 ? (
            <p className="text-muted-foreground text-sm">
              Personne n&apos;est connecté.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Dernière activité</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Appareil</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...connectedUsers.values()].map((c) => (
                  <TableRow key={c.user.id}>
                    <TableCell>
                      <span className="font-medium">{c.user.name}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {c.user.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={c.user.role} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        {relativeTime(c.lastActivity, now)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lastIp || "—"}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground"
                      title={c.lastUserAgent ?? undefined}
                    >
                      {formatUserAgent(c.lastUserAgent)}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.sessionCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Historique des connexions</h2>
          <p className="text-muted-foreground text-sm">
            Les 300 dernières connexions, filtrables par utilisateur.
          </p>
        </div>
        <DataTable
          storageKey="admin-connections"
          searchPlaceholder="Rechercher un utilisateur, une IP…"
          initialSort={{ key: "date", dir: "desc" }}
          filters={[{ key: "user", label: "Utilisateur", options: userOptions }]}
          columns={[
            { key: "user", label: "Utilisateur" },
            { key: "date", label: "Date & heure" },
            { key: "ip", label: "IP" },
            { key: "device", label: "Appareil" },
          ]}
          rows={rows}
          emptyMessage="Aucune connexion enregistrée."
        />
      </div>
    </div>
  );
}
