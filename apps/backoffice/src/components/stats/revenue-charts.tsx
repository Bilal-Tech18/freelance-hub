"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tooltipTheme } from "./chart-theme";
import type { FinancePoint } from "@/lib/services/finance";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eur2 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const axisEur = (v: number) => eur0.format(v);
const tooltipEur = (v: unknown) => eur2.format(Number(v));

/** Encaissements mensuels : CA HT. */
export function MonthlyIncomeChart({ data }: { data: FinancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis tickFormatter={axisEur} fontSize={12} width={60} />
        <Tooltip formatter={tooltipEur} {...tooltipTheme} />
        <Legend />
        <Bar
          dataKey="declaredHt"
          name="CA HT"
          fill="#047857"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** CA HT déclaré cumulé sur la période. */
export function CumulativeRevenueChart({ data }: { data: FinancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#047857" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#047857" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis tickFormatter={axisEur} fontSize={12} width={60} />
        <Tooltip formatter={tooltipEur} {...tooltipTheme} />
        <Area
          type="monotone"
          dataKey="cumulativeHt"
          name="CA HT cumulé"
          stroke="#047857"
          strokeWidth={2}
          fill="url(#caGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Total encaissé par mois (TTC). */
export function MonthlyReceivedChart({ data }: { data: FinancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis tickFormatter={axisEur} fontSize={12} width={60} />
        <Tooltip formatter={tooltipEur} {...tooltipTheme} />
        <Line
          type="monotone"
          dataKey="received"
          name="Total encaissé"
          stroke="#0d9488"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
