import { requireAdmin } from "@/lib/authz";
import { getSettings } from "@/lib/services/settings";
import {
  getFinanceTimeseries,
  getRecurringBillingStatus,
  getYearForecast,
} from "@/lib/services/finance";
import { formatEUR } from "@/lib/finance";
import {
  computeUrssaf,
  incomeTaxBareme,
  incomeTaxLiberatoire,
  IR_BAREME_YEAR,
  MICRO_BNC_ABATEMENT,
  MICRO_CEILING_BNC,
  MICRO_CEILING_GOODS,
  MICRO_GOODS_ABATEMENT,
  taxableBase,
  VL_RATE,
  VL_RATE_GOODS,
} from "@/lib/micro";
import { UrssafRateForm } from "@/components/finance/urssaf-rate-form";
import { MonthRow, type MonthDetailItem } from "@/components/finance/month-row";
import { MrrManager, type MrrItem } from "@/components/finance/mrr-manager";
import { RecurringBillingCard } from "@/components/finance/recurring-billing-card";
import { DeadlinePill } from "@/components/finance/deadline-pill";
import { db } from "@/lib/db";
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

export const metadata = { title: "CA de l'année" };

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long" });
const round2 = (n: number) => Math.round(n * 100) / 100;

function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${className ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function FinanceYearPage() {
  await requireAdmin();
  const now = new Date();
  const year = now.getFullYear();
  const monthsElapsed = now.getMonth() + 1;

  const yearStart = new Date(year, 0, 1);
  const [
    settings,
    timeseries,
    forecast,
    billingStatus,
    recurrings,
    clients,
    adjustments,
    overrides,
    doneRows,
    payments,
    soloInvoices,
  ] = await Promise.all([
      getSettings(),
      getFinanceTimeseries(monthsElapsed, now),
      getYearForecast(year, now),
      getRecurringBillingStatus(now),
      db.recurringRevenue.findMany({
        include: { client: { select: { name: true } } },
        orderBy: [{ client: { name: "asc" } }, { createdAt: "asc" }],
      }),
      db.client.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.revenueAdjustment.findMany({ where: { year } }),
      db.urssafOverride.findMany({ where: { year } }),
      db.complianceDone.findMany(),
      db.payment.findMany({
        where: { paidAt: { gte: yearStart } },
        orderBy: { paidAt: "asc" },
        include: {
          project: {
            select: {
              name: true,
              vatRate: true,
              activity: true,
              client: { select: { name: true } },
            },
          },
        },
      }),
      db.document.findMany({
        where: {
          type: "INVOICE",
          status: "PAID",
          projectId: null,
          paidAt: { gte: yearStart },
        },
        select: {
          id: true,
          number: true,
          subtotal: true,
          activity: true,
          paidAt: true,
          client: { select: { name: true } },
        },
      }),
    ]);
  const rateBnc = Number(settings.urssafRate);
  const rateGoods = Number(settings.urssafRateGoods);
  const doneKeys = new Set(doneRows.map((d) => d.key));

  const adjKey = (m: number, activity: string) => `${m}-${activity}`;
  const adjustmentMap = new Map(
    adjustments.map((a) => [adjKey(a.month, a.activity), Number(a.amountHt)])
  );
  const overrideMap = new Map(overrides.map((o) => [o.month, Number(o.amount)]));

  // Détail des mouvements comptés, par mois (pour la ligne dépliable)
  const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
  const detailsByMonth = new Map<
    number,
    { label: string; sub: string; amountHt: number | null; counted: boolean }[]
  >();
  const pushDetail = (
    month: number,
    item: { label: string; sub: string; amountHt: number | null; counted: boolean }
  ) => {
    const list = detailsByMonth.get(month) ?? [];
    list.push(item);
    detailsByMonth.set(month, list);
  };
  for (const p of payments) {
    const month = p.paidAt.getMonth() + 1;
    const amount = Number(p.amount);
    const ht = round2(amount / (1 + Number(p.project.vatRate) / 100));
    pushDetail(month, {
      label: `${p.project.client.name} / ${p.project.name}`,
      sub: `${dayFmt.format(p.paidAt)} · ${p.method ?? "paiement"} · ${
        p.project.activity === "GOODS" ? "ventes" : "BNC"
      } · ${formatEUR(amount)} TTC`,
      amountHt: ht,
      counted: true,
    });
  }
  for (const inv of soloInvoices) {
    if (!inv.paidAt) continue;
    pushDetail(inv.paidAt.getMonth() + 1, {
      label: `Facture ${inv.number ?? ""} · ${inv.client.name}`,
      sub: `${dayFmt.format(inv.paidAt)} · facture sans projet · déclaré (${
        inv.activity === "GOODS" ? "ventes" : "BNC"
      })`,
      amountHt: Number(inv.subtotal),
      counted: true,
    });
  }

  // Prévisions (factures émises + MRR, dédoublonnées) indexées par mois.
  const forecastByMonth = new Map(forecast.map((f) => [f.m, f]));
  const forecastDetails = (m: number): MonthDetailItem[] =>
    (forecastByMonth.get(m)?.lines ?? []).map((l) => ({
      label: l.label,
      sub: l.sub,
      amountHt: l.amountHt,
      counted: true,
    }));

  // Les 12 mois : réalisé jusqu'au mois en cours, prévision seule ensuite.
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const future = m > monthsElapsed;
    const point = future ? null : timeseries[i];
    const bnc = point?.bncHt ?? 0;
    const goods = point?.goodsHt ?? 0;
    const f = forecastByMonth.get(m);
    const forecastBnc = f?.bncHt ?? 0;
    const forecastGoods = f?.goodsHt ?? 0;
    // Mois futur : URSSAF et net estimés sur la prévision.
    const computedUrssaf = future
      ? round2(
          computeUrssaf(forecastBnc, rateBnc) + computeUrssaf(forecastGoods, rateGoods)
        )
      : round2(computeUrssaf(bnc, rateBnc) + computeUrssaf(goods, rateGoods));
    const override = future ? null : (overrideMap.get(m) ?? null);
    const urssaf = override ?? computedUrssaf;
    return {
      m,
      name: monthFmt.format(new Date(year, i, 1)),
      future,
      bnc,
      goods,
      bncTracked: point?.bncTracked ?? 0,
      goodsTracked: point?.goodsTracked ?? 0,
      vat: point?.vatCollected ?? 0,
      adjBnc: future ? null : (adjustmentMap.get(adjKey(m, "SERVICE_BNC")) ?? null),
      adjGoods: future ? null : (adjustmentMap.get(adjKey(m, "GOODS")) ?? null),
      details: future ? [] : (detailsByMonth.get(m) ?? []),
      forecastBnc,
      forecastGoods,
      forecastDetails: forecastDetails(m),
      computedUrssaf,
      override,
      urssaf,
      net: future
        ? round2(forecastBnc + forecastGoods - urssaf)
        : round2(bnc + goods - urssaf),
      current: m === monthsElapsed,
    };
  });

  // Agrégats réalisés : uniquement les mois écoulés (les futurs sont des prévisions).
  const elapsed = months.filter((m) => !m.future);
  const bncYear = round2(elapsed.reduce((s, m) => s + m.bnc, 0));
  const goodsYear = round2(elapsed.reduce((s, m) => s + m.goods, 0));
  const caYear = round2(bncYear + goodsYear);
  const urssafBncYear = computeUrssaf(bncYear, rateBnc);
  const urssafGoodsYear = computeUrssaf(goodsYear, rateGoods);
  const urssafYear = round2(elapsed.reduce((s, m) => s + m.urssaf, 0));
  const netYear = round2(caYear - urssafYear);
  const vatYear = round2(elapsed.reduce((s, m) => s + m.vat, 0));

  const base = taxableBase(bncYear, goodsYear);
  const taxBareme = incomeTaxBareme(base);
  const taxVl = incomeTaxLiberatoire(bncYear, goodsYear);

  // Reste attendu sur l'année (factures émises + MRR, dédoublonnés) et
  // prévision de fin d'année = réalisé + reste attendu.
  const forecastBncRemaining = round2(forecast.reduce((s, f) => s + f.bncHt, 0));
  const forecastGoodsRemaining = round2(forecast.reduce((s, f) => s + f.goodsHt, 0));
  const forecastRemaining = round2(forecastBncRemaining + forecastGoodsRemaining);
  const urssafForecastRemaining = round2(
    forecast.reduce(
      (s, f) => s + computeUrssaf(f.bncHt, rateBnc) + computeUrssaf(f.goodsHt, rateGoods),
      0
    )
  );
  const projectedBnc = round2(bncYear + forecastBncRemaining);
  const projectedTotal = round2(caYear + forecastRemaining);
  const projectedUrssaf = round2(urssafYear + urssafForecastRemaining);
  const projectedNet = round2(projectedTotal - projectedUrssaf);

  // Moyenne mensuelle et projection linéaire, en repère de comparaison.
  const avgMonthly = monthsElapsed > 0 ? round2(caYear / monthsElapsed) : 0;
  const linearTotal = monthsElapsed > 0 ? round2((caYear / monthsElapsed) * 12) : 0;
  const ceilings = [
    {
      label: "Prestations BNC",
      current: bncYear,
      projected: projectedBnc,
      ceiling: MICRO_CEILING_BNC,
      show: true,
    },
    {
      label: "CA global (activité mixte)",
      current: caYear,
      projected: projectedTotal,
      ceiling: MICRO_CEILING_GOODS,
      show: goodsYear > 0,
    },
  ].filter((c) => c.show);

  // Revenus récurrents, sérialisés pour la carte de gestion (mois en UTC :
  // les dates sont stockées au 1er du mois, colonne DATE).
  const ym = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const currentYm = `${year}-${String(monthsElapsed).padStart(2, "0")}`;
  const nowIdx = year * 12 + (monthsElapsed - 1);
  const mrrItems: MrrItem[] = recurrings.map((r) => {
    const fromIdx = r.startsOn.getUTCFullYear() * 12 + r.startsOn.getUTCMonth();
    const toIdx = r.endsOn
      ? r.endsOn.getUTCFullYear() * 12 + r.endsOn.getUTCMonth()
      : Infinity;
    return {
      id: r.id,
      clientId: r.clientId,
      clientName: r.client.name,
      label: r.label,
      amountHt: Number(r.amountHt),
      mode: r.mode,
      activity: r.activity,
      startsOn: ym(r.startsOn),
      endsOn: r.endsOn ? ym(r.endsOn) : null,
      activeNow: fromIdx <= nowIdx && nowIdx <= toIdx,
    };
  });

  // Échéances déclaratives
  const shortDate = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
  const mm = (m: number) => String(m).padStart(2, "0");
  const monthlyDeadlines = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const urssafDue = new Date(year, m + 1, 0);
    const tvaDue = new Date(year, m, 24);
    return {
      m,
      name: monthFmt.format(new Date(year, i, 1)),
      urssaf: {
        key: `urssaf-${year}-${mm(m)}`,
        due: urssafDue,
        dueLabel: shortDate.format(urssafDue),
      },
      tva: {
        key: `tva-${year}-${mm(m)}`,
        due: tvaDue,
        dueLabel: shortDate.format(tvaDue),
      },
      future: m > monthsElapsed,
    };
  });
  const annualDeadlines = [
    {
      // La déclaration faite en juin N porte sur les revenus N-1.
      key: `ir-${year}`,
      label: `Déclaration de revenus ${year - 1}`,
      due: new Date(year, 5, 8),
      dueLabel: `≈ 08/06/${year}`,
    },
    {
      key: `cfe-${year}`,
      label: `CFE ${year}`,
      due: new Date(year, 11, 15),
      dueLabel: `15/12/${year}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CA {year}</h1>
          <p className="text-sm text-muted-foreground">
            CA HT déclaré encaissé, cotisations URSSAF et estimation d&apos;impôt
            (micro-entreprise, prestations BNC + ventes de marchandises).
          </p>
        </div>
        <UrssafRateForm rate={rateBnc} rateGoods={rateGoods} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={`Prestations BNC (${year})`}
          value={formatEUR(bncYear)}
          sub={`URSSAF ${rateBnc} % : ${formatEUR(urssafBncYear)}`}
        />
        <Stat
          label={`Ventes de marchandises (${year})`}
          value={formatEUR(goodsYear)}
          sub={`URSSAF ${rateGoods} % : ${formatEUR(urssafGoodsYear)}`}
        />
        <Stat
          label="URSSAF totale (réelle)"
          value={formatEUR(urssafYear)}
          className="text-amber-600"
        />
        <Stat
          label="Net après URSSAF"
          value={formatEUR(netYear)}
          className="text-emerald-600"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plafond micro & prévision {year}</CardTitle>
          <CardDescription>
            Prévision fin d&apos;année :{" "}
            <strong>{formatEUR(projectedTotal)}</strong> (encaissé + factures
            émises + revenus récurrents, dédoublonnés). Moyenne mensuelle :{" "}
            <strong>{formatEUR(avgMonthly)}</strong> sur {monthsElapsed} mois
            (projection linéaire : {formatEUR(linearTotal)}). Plafonds
            2026-2028 : {formatEUR(MICRO_CEILING_BNC)} en prestations BNC,{" "}
            {formatEUR(MICRO_CEILING_GOODS)} en global/ventes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {ceilings.map((c) => {
            const currentPct = Math.min(100, (c.current / c.ceiling) * 100);
            const projectedPct = Math.min(100, (c.projected / c.ceiling) * 100);
            const overProjected = c.projected > c.ceiling;
            const warnProjected = !overProjected && c.projected > c.ceiling * 0.85;
            return (
              <div key={c.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{c.label}</span>
                  <span className="tabular-nums">
                    {formatEUR(c.current)}{" "}
                    <span className="text-muted-foreground">
                      / {formatEUR(c.ceiling)} (
                      {Math.round((c.current / c.ceiling) * 100)} %)
                    </span>
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-200 dark:bg-emerald-900"
                    style={{ width: `${projectedPct}%` }}
                    title="Prévision fin d'année"
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                    style={{ width: `${currentPct}%` }}
                    title="Encaissé à ce jour"
                  />
                </div>
                <p
                  className={`text-xs ${
                    overProjected
                      ? "font-medium text-red-600"
                      : warnProjected
                        ? "font-medium text-amber-600"
                        : "text-muted-foreground"
                  }`}
                >
                  Prévision : {formatEUR(c.projected)} (
                  {Math.round((c.projected / c.ceiling) * 100)} % du plafond)
                  {overProjected &&
                    " — au rythme actuel tu dépasses le plafond, anticipe (TVA/régime réel)."}
                  {warnProjected && " — tu t'approches du plafond, garde un œil dessus."}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mois par mois</CardTitle>
          <CardDescription>
            Cliquez sur un mois pour voir le détail de ce qui est compté. Le
            crayon permet de corriger : le CA manuel est <strong>prioritaire</strong>{" "}
            (il remplace le suivi automatique du mois), l&apos;URSSAF saisie
            remplace le calcul — 0 ou vide pour revenir à l&apos;automatique. La
            TVA encaissée est calculée sur les encaissements déclarés du mois
            (montant à reverser).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">BNC (HT)</TableHead>
                <TableHead className="text-right">Manuel BNC</TableHead>
                <TableHead className="text-right">Ventes (HT)</TableHead>
                <TableHead className="text-right">Manuel ventes</TableHead>
                <TableHead className="text-right">TVA encaissée</TableHead>
                <TableHead className="text-right">URSSAF</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <MonthRow
                  key={m.m}
                  year={year}
                  month={m.m}
                  name={m.name}
                  current={m.current}
                  future={m.future}
                  bnc={m.bnc}
                  goods={m.goods}
                  bncTracked={m.bncTracked}
                  goodsTracked={m.goodsTracked}
                  adjBnc={m.adjBnc}
                  adjGoods={m.adjGoods}
                  vat={m.vat}
                  details={m.details}
                  forecastBnc={m.forecastBnc}
                  forecastGoods={m.forecastGoods}
                  forecastDetails={m.forecastDetails}
                  computedUrssaf={m.computedUrssaf}
                  override={m.override}
                  net={m.net}
                />
              ))}
              <TableRow className="border-t-2">
                <TableCell className="font-medium">Prestations BNC</TableCell>
                <TableCell className="text-right font-medium">
                  {formatEUR(bncYear)}
                </TableCell>
                <TableCell colSpan={4} />
                <TableCell className="text-right text-amber-600">
                  {formatEUR(urssafBncYear)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Ventes de marchandises</TableCell>
                <TableCell className="text-right font-medium">
                  {formatEUR(goodsYear)}
                </TableCell>
                <TableCell colSpan={4} />
                <TableCell className="text-right text-amber-600">
                  {formatEUR(urssafGoodsYear)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>Total {year} (encaissé)</TableCell>
                <TableCell className="text-right">{formatEUR(caYear)}</TableCell>
                <TableCell colSpan={3} />
                <TableCell
                  className="text-right text-sky-700 dark:text-sky-400"
                  title="TVA encaissée sur l'année, à reverser"
                >
                  {formatEUR(vatYear)}
                </TableCell>
                <TableCell className="text-right text-amber-600">
                  {formatEUR(urssafYear)}
                </TableCell>
                <TableCell className="text-right text-emerald-600">
                  {formatEUR(netYear)}
                </TableCell>
                <TableCell />
              </TableRow>
              {forecastRemaining > 0 && (
                <TableRow className="italic text-muted-foreground">
                  <TableCell>
                    Prévision fin {year}
                    <span className="block text-xs not-italic">
                      encaissé + {formatEUR(forecastRemaining)} attendus
                      (factures émises + récurrents)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEUR(projectedTotal)}
                  </TableCell>
                  <TableCell colSpan={4} />
                  <TableCell className="text-right text-amber-600/70">
                    {formatEUR(projectedUrssaf)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600/80">
                    {formatEUR(projectedNet)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecurringBillingCard
        items={billingStatus}
        monthName={monthFmt.format(now)}
      />

      <MrrManager clients={clients} items={mrrItems} currentMonth={currentYm} />

      <Card>
        <CardHeader>
          <CardTitle>Échéances {year}</CardTitle>
          <CardDescription>
            Cliquez sur une échéance quand elle est faite — elle passe en vert.
            En rouge : dépassée et non faite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Déclaration URSSAF (mensuelle)</p>
            <div className="flex flex-wrap gap-1.5">
              {monthlyDeadlines.map((d) => (
                <DeadlinePill
                  key={d.urssaf.key}
                  deadlineKey={d.urssaf.key}
                  label={d.name}
                  due={d.urssaf.dueLabel}
                  done={doneKeys.has(d.urssaf.key)}
                  overdue={!d.future && now > d.urssaf.due}
                  muted={d.future}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Déclaration TVA (mensuelle)</p>
            <div className="flex flex-wrap gap-1.5">
              {monthlyDeadlines.map((d) => (
                <DeadlinePill
                  key={d.tva.key}
                  deadlineKey={d.tva.key}
                  label={d.name}
                  due={d.tva.dueLabel}
                  done={doneKeys.has(d.tva.key)}
                  overdue={!d.future && now > d.tva.due}
                  muted={d.future}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Annuel</p>
            <div className="flex flex-wrap gap-1.5">
              {annualDeadlines.map((d) => (
                <DeadlinePill
                  key={d.key}
                  deadlineKey={d.key}
                  label={d.label}
                  due={d.dueLabel}
                  done={doneKeys.has(d.key)}
                  overdue={now > d.due}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prévision d&apos;impôt sur le revenu (micro)</CardTitle>
          <CardDescription>
            Deux régimes possibles — montants indicatifs, calculés sur le CA
            encaissé à ce jour, hors autres revenus du foyer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-sm font-medium">Barème progressif (1 part)</p>
              <p className="text-2xl font-semibold">{formatEUR(taxBareme)}</p>
              <p className="text-xs text-muted-foreground">
                Base imposable : {formatEUR(base)} après abattements de{" "}
                {MICRO_BNC_ABATEMENT * 100} % (BNC) et{" "}
                {MICRO_GOODS_ABATEMENT * 100} % (ventes) — barème {IR_BAREME_YEAR},
                hors décote et autres revenus.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-sm font-medium">
                Versement libératoire ({VL_RATE * 100} % BNC, {VL_RATE_GOODS * 100} %
                ventes)
              </p>
              <p className="text-2xl font-semibold">{formatEUR(taxVl)}</p>
              <p className="text-xs text-muted-foreground">
                Payé au fil de l&apos;eau avec les cotisations URSSAF, si
                l&apos;option est activée (soumis à condition de revenu fiscal).
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t pt-3">
            Estimations indicatives : le calcul réel dépend de l&apos;ensemble des
            revenus du foyer, du nombre de parts et du barème en vigueur au moment
            de la déclaration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
