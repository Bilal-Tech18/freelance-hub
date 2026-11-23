"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function WeeklyChart({
  data,
}: {
  data: { week: string; created: number; resolved: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} width={30} />
        <Tooltip />
        <Legend />
        <Bar dataKey="created" name="Créés" fill="var(--color-chart-1, #6366f1)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="resolved" name="Résolus" fill="var(--color-chart-2, #22c55e)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
