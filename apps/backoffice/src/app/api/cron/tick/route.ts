import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { remindCalendarTasks } from "@/lib/services/calendar-reminders";
import { runSiteChecks } from "@/lib/services/monitoring";
import { remindOverdueInvoices } from "@/lib/services/reminders";

// Le monitoring et les rappels du calendrier tournent à chaque tick ; les relances factures au plus une
// fois par 20 h. Appelé toutes les 30 min par le scheduler interne
// (src/instrumentation.ts) — utilisable aussi par un pinger externe.
const INVOICE_REMINDERS_EVERY_MS = 20 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Secret cron invalide." } },
      { status: 401 }
    );
  }

  const now = new Date();
  const monitoring = await runSiteChecks(now);

  let reminders: Awaited<ReturnType<typeof remindOverdueInvoices>> | null = null;
  const state = await db.cronState.findUnique({
    where: { key: "invoice-reminders" },
  });
  if (!state || now.getTime() - state.runAt.getTime() > INVOICE_REMINDERS_EVERY_MS) {
    reminders = await remindOverdueInvoices(now);
    await db.cronState.upsert({
      where: { key: "invoice-reminders" },
      create: { key: "invoice-reminders", runAt: now },
      update: { runAt: now },
    });
  }

  // Rappels du calendrier, confinés : un échec ici ne doit pas faire
  // échouer le reste du cron.
  let calendar: Awaited<ReturnType<typeof remindCalendarTasks>> | { error: string };
  try {
    calendar = await remindCalendarTasks(now);
  } catch (e) {
    calendar = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: true, monitoring, reminders, calendar });
}
