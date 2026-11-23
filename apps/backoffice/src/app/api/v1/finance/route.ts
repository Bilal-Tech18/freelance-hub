import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key";
import { apiError } from "@/lib/api-serializers";
import {
  getFinanceTimeseries,
  getGlobalFinancials,
} from "@/lib/services/finance";
import { getSettings } from "@/lib/services/settings";
import {
  computeUrssaf,
  incomeTaxBareme,
  incomeTaxLiberatoire,
  taxableBase,
} from "@/lib/micro";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Vue financière micro-entreprise : KPIs globaux, mois par mois (BNC vs
 * ventes, manuel prioritaire), URSSAF et estimations d'impôt.
 * Réservé aux clés API d'un compte ADMIN.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, ["finance:read"]);
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "ADMIN") {
    return apiError(403, "FORBIDDEN", "Finance data is admin-only.");
  }

  const now = new Date();
  const url = new URL(request.url);
  const yearParam = Number(url.searchParams.get("year"));
  const year =
    Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100
      ? yearParam
      : now.getFullYear();
  const monthsInYear = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  // getFinanceTimeseries est ancrée sur "now" : on ne sert le détail mensuel
  // que pour l'année en cours.
  const [global, settings, timeseries] = await Promise.all([
    getGlobalFinancials(year),
    getSettings(),
    year === now.getFullYear()
      ? getFinanceTimeseries(monthsInYear, now)
      : Promise.resolve(null),
  ]);

  const rateBnc = Number(settings.urssafRate);
  const rateGoods = Number(settings.urssafRateGoods);

  let months = null;
  let bncYear = 0;
  let goodsYear = 0;
  if (timeseries) {
    months = timeseries.map((p, i) => {
      const urssaf = round2(
        computeUrssaf(p.bncHt, rateBnc) + computeUrssaf(p.goodsHt, rateGoods)
      );
      return {
        month: i + 1,
        bncHt: p.bncHt,
        goodsHt: p.goodsHt,
        declaredHt: p.declaredHt,
        urssafEstimated: urssaf,
        netAfterUrssaf: round2(p.declaredHt - urssaf),
      };
    });
    bncYear = round2(timeseries.reduce((s, p) => s + p.bncHt, 0));
    goodsYear = round2(timeseries.reduce((s, p) => s + p.goodsHt, 0));
  }

  const urssafYear = round2(
    computeUrssaf(bncYear, rateBnc) + computeUrssaf(goodsYear, rateGoods)
  );
  const base = taxableBase(bncYear, goodsYear);

  return NextResponse.json({
    year,
    urssafRates: { serviceBnc: rateBnc, goods: rateGoods },
    global,
    currentYearDetail: timeseries
      ? {
          bncHtYear: bncYear,
          goodsHtYear: goodsYear,
          urssafEstimatedYear: urssafYear,
          netAfterUrssafYear: round2(bncYear + goodsYear - urssafYear),
          incomeTax: {
            taxableBase: base,
            baremeEstimate: incomeTaxBareme(base),
            versementLiberatoireEstimate: incomeTaxLiberatoire(bncYear, goodsYear),
          },
          months,
        }
      : null,
  });
}
