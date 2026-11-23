import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { getStats } from "@/lib/services/stats";
import {
  getGlobalFinancials,
  getFinanceTimeseries,
  getMonthlyMrr,
  getYearForecast,
} from "@/lib/services/finance";
import { getTotalCommissionsDue } from "@/lib/services/referrers";
import { getSettings } from "@/lib/services/settings";
import { getOverdueInvoices } from "@/lib/services/reminders";
import { getMonitoringOverview } from "@/lib/services/monitoring";
import { formatEUR } from "@/lib/finance";
import { computeUrssaf, MICRO_CEILING_BNC } from "@/lib/micro";
import { WeeklyChart } from "@/components/stats/weekly-chart";
import {
  CumulativeRevenueChart,
  MonthlyIncomeChart,
  MonthlyReceivedChart,
} from "@/components/stats/revenue-charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/ticket-labels";
import type { TicketStatus } from "@prisma/client";
import {
  AlarmClock,
  Banknote,
  CheckCircle2,
  FileWarning,
  FolderKanban,
  Gauge,
  Globe,
  HandCoins,
  Landmark,
  Repeat,
  Ticket,
  Timer,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const metadata = { title: "Dashboard" };

function Kpi({
  label,
  value,
  sub,
  href,
  alert,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  alert?: boolean;
  icon: LucideIcon;
  iconClass: string;
}) {
  const card = (
    <Card className={`bg-background ${alert ? "border-red-300 dark:border-red-800" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className={`text-3xl ${alert ? "text-red-600" : ""}`}>
            {value}
          </CardTitle>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`flex size-10 items-center justify-center rounded-full ${iconClass}`}>
          <Icon className="size-5" />
        </div>
      </CardHeader>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const now = new Date();
  const year = now.getFullYear();
  const [
    stats,
    finance,
    timeseries,
    forecast,
    mrr,
    commissionsDue,
    settings,
    overdueInvoices,
    monitoring,
  ] = await Promise.all([
      getStats(),
      getGlobalFinancials(year),
      getFinanceTimeseries(12, now),
      getYearForecast(year, now),
      getMonthlyMrr(now),
      getTotalCommissionsDue(now),
      getSettings(),
      getOverdueInvoices(now),
      getMonitoringOverview(),
    ]);

  // Moyenne mensuelle, et prévision de fin d'année alignée sur la page
  // CA & impôts : encaissé + reste attendu (factures émises + MRR).
  const monthsElapsed = now.getMonth() + 1;
  const avgMonthly = Math.round((finance.declaredHtYear / monthsElapsed) * 100) / 100;
  const forecastRemaining = forecast.reduce((s, f) => s + f.bncHt + f.goodsHt, 0);
  const projectedYear =
    Math.round((finance.declaredHtYear + forecastRemaining) * 100) / 100;

  // Net après URSSAF : mois en cours + rappel du mois précédent
  // (chaque activité a son taux : prestations BNC vs ventes de marchandises)
  const urssafRate = Number(settings.urssafRate);
  const urssafRateGoods = Number(settings.urssafRateGoods);
  const netOf = (p?: { bncHt: number; goodsHt: number }) =>
    p
      ? Math.round(
          (p.bncHt +
            p.goodsHt -
            computeUrssaf(p.bncHt, urssafRate) -
            computeUrssaf(p.goodsHt, urssafRateGoods)) *
            100
        ) / 100
      : 0;
  const netCurrent = netOf(timeseries[timeseries.length - 1]);
  const netPrevious = netOf(timeseries[timeseries.length - 2]);
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(now);
  const prevMonthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(
    new Date(year, now.getMonth() - 1, 1)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <h2 className="text-sm font-medium text-muted-foreground">
        Activité
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Tickets ouverts"
          value={stats.openCount}
          href="/admin/tickets?status=NEW"
          icon={Ticket}
          iconClass="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
        />
        <Kpi
          label="En retard (SLA)"
          value={stats.overdueCount}
          href="/admin/tickets?overdue=true"
          alert={stats.overdueCount > 0}
          icon={AlarmClock}
          iconClass="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
        />
        <Kpi
          label="Résolus (30 j)"
          value={stats.resolvedLast30d}
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
        />
        <Kpi
          label="Projets actifs"
          value={stats.activeProjects}
          icon={FolderKanban}
          iconClass="bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Factures en retard"
          value={overdueInvoices.length}
          sub={
            overdueInvoices.length > 0
              ? `${formatEUR(
                  overdueInvoices.reduce((s, d) => s + Number(d.total), 0)
                )} à relancer`
              : "rien à relancer"
          }
          href="/admin/documents"
          alert={overdueInvoices.length > 0}
          icon={FileWarning}
          iconClass="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
        />
        <Kpi
          label="Sites clients"
          value={
            monitoring.monitored === 0
              ? "—"
              : `${monitoring.up}/${monitoring.monitored} up`
          }
          sub={monitoring.down > 0 ? `${monitoring.down} site(s) down` : undefined}
          href="/admin/monitoring"
          alert={monitoring.down > 0}
          icon={Globe}
          iconClass="bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
        />
        <Kpi
          label="Temps moyen de résolution"
          value={
            stats.avgResolutionDays !== null
              ? `${stats.avgResolutionDays} j`
              : "—"
          }
          icon={Timer}
          iconClass="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
        />
        <Kpi
          label="Respect des deadlines"
          value={
            stats.slaComplianceRate !== null
              ? `${stats.slaComplianceRate} %`
              : "—"
          }
          alert={stats.slaComplianceRate !== null && stats.slaComplianceRate < 80}
          icon={Gauge}
          iconClass="bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Charge hebdomadaire (8 semaines)</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyChart data={stats.weekly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets par projet</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byProject.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun ticket.</p>
            ) : (
              <ul className="space-y-2">
                {stats.byProject.slice(0, 10).map((p) => (
                  <li
                    key={`${p.clientName}-${p.projectName}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      <span className="font-medium">{p.projectName}</span>{" "}
                      <span className="text-muted-foreground">
                        · {p.clientName}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {p.open} ouvert{p.open > 1 ? "s" : ""} / {p.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Répartition par statut</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {stats.byStatus.map((s) => (
              <div key={s.status} className="text-sm">
                <span className="text-muted-foreground">
                  {STATUS_LABELS[s.status as TicketStatus] ?? s.status}
                </span>{" "}
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3 pt-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Finances {year}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Kpi
            label={`CA HT déclaré (${year})`}
            value={formatEUR(finance.declaredHtYear)}
            icon={Landmark}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          />
          <Kpi
            label="Moyenne mensuelle (CA HT)"
            value={formatEUR(avgMonthly)}
            sub={`Prévision ${year} (factures + MRR) : ${formatEUR(projectedYear)} · plafond BNC ${formatEUR(
              MICRO_CEILING_BNC
            )} (${Math.round((projectedYear / MICRO_CEILING_BNC) * 100)} %)`}
            href="/admin/finance"
            alert={projectedYear > MICRO_CEILING_BNC}
            icon={TrendingUp}
            iconClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
          />
          <Kpi
            label={`MRR (${monthName})`}
            value={formatEUR(mrr.totalHt)}
            sub={
              mrr.count > 0
                ? `${mrr.count} récurrent${mrr.count > 1 ? "s" : ""} · ${mrr.days} j ouvrés ce mois`
                : "Aucun récurrent — à définir sur CA & impôts"
            }
            href="/admin/finance"
            icon={Repeat}
            iconClass="bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
          />
          <Kpi
            label={`TVA collectée (${year})`}
            value={formatEUR(finance.vatCollectedYear)}
            icon={Banknote}
            iconClass="bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
          />
          <Kpi
            label="Reste à encaisser"
            value={formatEUR(finance.outstanding)}
            href="/admin/projects"
            alert={finance.outstanding > 0}
            icon={Wallet}
            iconClass="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
          />
          <Kpi
            label={`Net URSSAF (${monthName})`}
            value={formatEUR(netCurrent)}
            sub={`${prevMonthName} : ${formatEUR(netPrevious)} · BNC ${urssafRate} % / ventes ${urssafRateGoods} %`}
            href="/admin/finance"
            icon={HandCoins}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          />
          <Kpi
            label="Total facturé TTC"
            value={formatEUR(finance.invoicedTtc)}
            icon={HandCoins}
            iconClass="bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400"
          />
          <Kpi
            label="CA HT déclaré (total)"
            value={formatEUR(finance.declaredHtAllTime)}
            icon={Landmark}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          />
          <Kpi
            label="Commissions apporteurs à régler"
            value={formatEUR(commissionsDue)}
            href="/admin/referrers"
            icon={HandCoins}
            iconClass="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-background">
            <CardHeader>
              <CardTitle>Encaissements mensuels</CardTitle>
              <CardDescription>
                CA HT, 12 derniers mois
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyIncomeChart data={timeseries} />
            </CardContent>
          </Card>
          <Card className="bg-background">
            <CardHeader>
              <CardTitle>CA HT cumulé</CardTitle>
              <CardDescription>Progression sur 12 mois</CardDescription>
            </CardHeader>
            <CardContent>
              <CumulativeRevenueChart data={timeseries} />
            </CardContent>
          </Card>
        </div>

        <Card className="bg-background">
          <CardHeader>
            <CardTitle>Total encaissé par mois</CardTitle>
            <CardDescription>Encaissé TTC</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyReceivedChart data={timeseries} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
