import "server-only";

import { Resend } from "resend";
import { sendPushToEmail, type PushPayload } from "@/lib/push";

const FROM = process.env.EMAIL_FROM ?? "Back Office <onboarding@resend.dev>";
// Adresse où arrivent les réponses des clients (le domaine d'envoi n'a pas de boîte).
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? "admin@example.com";
// Adresse de l'admin pour les alertes internes (relances factures, monitoring).
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? REPLY_TO;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/**
 * Envoi d'une notification : email, et si `push` est fourni, la même
 * information part en Web Push vers les appareils abonnés du destinataire
 * (PWA installée). Les emails purement transactionnels — reset de mot de
 * passe, invitation — ne passent pas de `push`.
 */
async function send(options: {
  to: string;
  subject: string;
  html: string;
  push?: Omit<PushPayload, "title">;
}) {
  const { push, ...email } = options;
  if (push) {
    await sendPushToEmail(email.to, { title: email.subject, ...push }).catch(
      (e) => console.error("[push] failed:", e)
    );
  }
  const resend = getResend();
  if (!resend) {
    console.log(`[email:dev] to=${email.to} subject="${email.subject}"`);
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    ...email,
  });
  if (error) console.error("[email] send failed:", error);
}

export async function sendPasswordResetEmail(params: { to: string; url: string }) {
  await send({
    to: params.to,
    subject: "Réinitialisation de votre mot de passe",
    html: `<p>Bonjour,</p><p>Cliquez sur ce lien pour réinitialiser votre mot de passe :</p><p><a href="${params.url}">Réinitialiser mon mot de passe</a></p><p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
  });
}

export async function sendNewTicketEmail(params: {
  to: string;
  ticketNumber: number;
  title: string;
  projectName: string;
  clientName: string;
  authorName: string;
  priority: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  await send({
    to: params.to,
    subject: `[#${params.ticketNumber}] Nouveau ticket — ${params.title}`,
    html: `<p><strong>${params.authorName}</strong> (${params.clientName}) a créé un ticket sur <strong>${params.projectName}</strong> :</p><p><strong>#${params.ticketNumber} — ${params.title}</strong> · priorité ${params.priority}</p><p><a href="${baseUrl}/admin/tickets">Voir le ticket</a></p>`,
    push: {
      body: `${params.authorName} (${params.clientName}) · ${params.projectName} · priorité ${params.priority}`,
      path: "/admin/tickets",
    },
  });
}

export async function sendTicketUpdateEmail(params: {
  to: string;
  ticketNumber: number;
  title: string;
  event: string;
  /** Chemin du lien « Voir » (par défaut le portail client). */
  path?: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  await send({
    to: params.to,
    subject: `[#${params.ticketNumber}] ${params.event}`,
    html: `<p>${params.event}</p><p><strong>#${params.ticketNumber} — ${params.title}</strong></p><p><a href="${baseUrl}${params.path ?? "/tickets"}">Voir le ticket</a></p>`,
    push: { body: params.title, path: params.path ?? "/tickets" },
  });
}

/** Ticket passé en « Résolu » : invite le client à tester puis valider (ou rouvrir). */
export async function sendTicketResolvedEmail(params: {
  to: string;
  ticketNumber: number;
  title: string;
  ticketId: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  await send({
    to: params.to,
    subject: `[#${params.ticketNumber}] Correctif prêt — à valider`,
    html: `<p>Votre ticket <strong>#${params.ticketNumber} — ${params.title}</strong> a été corrigé.</p><p>Testez la correction, puis validez le ticket. Si le problème persiste, rouvrez-le en expliquant ce qui ne va pas.</p><p><a href="${baseUrl}/tickets/${params.ticketId}">Tester et valider le ticket</a></p>`,
    push: { body: params.title, path: `/tickets/${params.ticketId}` },
  });
}

/**
 * Rappel interne (admin uniquement, jamais envoyé au client) : liste des
 * factures émises dont l'échéance est dépassée.
 */
export async function sendOverdueInvoicesEmail(params: {
  invoices: {
    number: string;
    clientName: string;
    total: string;
    dueDate: string;
    daysLate: number;
  }[];
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const rows = params.invoices
    .map(
      (i) =>
        `<li><strong>${i.number}</strong> — ${i.clientName} · ${i.total} · échéance ${i.dueDate} (<strong>${i.daysLate} j de retard</strong>)</li>`
    )
    .join("");
  const n = params.invoices.length;
  await send({
    to: ADMIN_EMAIL,
    subject: `⏰ ${n} facture${n > 1 ? "s" : ""} en retard de paiement`,
    html: `<p>Rappel interne : ${n > 1 ? "ces factures sont" : "cette facture est"} toujours en attente de paiement. À toi de relancer le client si besoin.</p><ul>${rows}</ul><p><a href="${baseUrl}/admin/documents">Voir les factures</a></p>`,
    push: {
      body: params.invoices
        .map((i) => `${i.number} — ${i.clientName}`)
        .join(", "),
      path: "/admin/documents",
    },
  });
}

/** Alerte interne : un site client ne répond plus. */
export async function sendSiteDownEmail(params: {
  projectName: string;
  clientName: string;
  url: string;
  detail: string; // "HTTP 502" ou message d'erreur réseau
  downSince: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  await send({
    to: ADMIN_EMAIL,
    subject: `🔴 Site down — ${params.projectName} (${params.clientName})`,
    html: `<p>Le site <a href="${params.url}">${params.url}</a> ne répond plus.</p><p>${params.detail} · down depuis ${params.downSince}</p><p><a href="${baseUrl}/admin/monitoring">Voir le monitoring</a></p>`,
    push: {
      body: `${params.url} · ${params.detail} · down depuis ${params.downSince}`,
      path: "/admin/monitoring",
    },
  });
}

/** Fin d'incident : le site répond à nouveau. */
export async function sendSiteUpEmail(params: {
  projectName: string;
  clientName: string;
  url: string;
  downtime: string; // durée de l'incident, formatée
}) {
  await send({
    to: ADMIN_EMAIL,
    subject: `🟢 Site rétabli — ${params.projectName} (${params.clientName})`,
    html: `<p>Le site <a href="${params.url}">${params.url}</a> répond à nouveau (indisponible pendant ${params.downtime}).</p>`,
    push: {
      body: `${params.url} · indisponible pendant ${params.downtime}`,
      path: "/admin/monitoring",
    },
  });
}

export async function sendInvitationEmail(params: {
  to: string;
  clientName: string;
  url: string;
}) {
  await send({
    to: params.to,
    subject: `Invitation — espace client ${params.clientName}`,
    html: `<p>Bonjour,</p><p>Un espace client a été créé pour <strong>${params.clientName}</strong>. Créez votre compte pour suivre votre projet et faire vos retours :</p><p><a href="${params.url}">Créer mon compte</a></p><p>Ce lien expire dans 7 jours.</p>`,
  });
}
