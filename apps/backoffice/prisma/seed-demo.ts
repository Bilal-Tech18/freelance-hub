// Jeu de données de démo : clients, projets, tickets, factures, 12 mois de CA.
// Usage : npm run db:seed:demo (après db:seed). Refuse de tourner sur une base
// qui contient déjà des clients, pour ne jamais mélanger démo et vraies données.
// Toutes les entreprises, personnes et numéros sont fictifs.

import { createCipheriv, randomBytes } from "crypto";
import type {
  Client,
  Prisma,
  Setting,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@prisma/client";
import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { computeTotals, docDayKey, formatDocNumber, type LineItem } from "../src/lib/documents";
import { fiscalTask } from "../src/lib/fiscal-deadlines";
import { addDays, occurrencesBetween, parisNow, weekdayIndex } from "../src/lib/recurrence";
import { computeDueDate } from "../src/lib/sla";

const CLIENT_PASSWORD = "demo-client-2026";
const DAY = 86_400_000;
const now = new Date();
const daysAgo = (n: number, hour = 10) => {
  const d = new Date(now.getTime() - n * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const daysAhead = (n: number) => new Date(now.getTime() + n * DAY);

// Même format que src/lib/vault-crypto.ts (non importable hors Next : server-only).
function encryptFields(fields: Record<string, string>) {
  const key = Buffer.from(process.env.VAULT_ENCRYPTION_KEY ?? "", "hex");
  if (key.length !== 32) throw new Error("VAULT_ENCRYPTION_KEY (64 hex) requis pour le Vault de démo.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(fields), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

function sellerSnapshot(s: Setting) {
  return {
    name: s.sellerName ?? "",
    legalForm: s.sellerLegalForm ?? "",
    addressLine1: s.sellerAddressLine1 ?? "",
    addressLine2: s.sellerAddressLine2 ?? "",
    postalCode: s.sellerPostalCode ?? "",
    city: s.sellerCity ?? "",
    country: s.sellerCountry ?? "France",
    email: s.sellerEmail ?? "",
    phone: s.sellerPhone ?? "",
    siret: s.siret ?? "",
    vatNumber: s.vatNumber ?? "",
    apeCode: s.apeCode ?? "",
    iban: s.iban ?? "",
    bic: s.bic ?? "",
    bankName: s.bankName ?? "",
    vatExempt: s.vatExempt,
    legalMentions: s.legalMentions ?? "",
  };
}

function clientSnapshot(c: Client) {
  return {
    billingType: c.billingType,
    displayName: c.billingType === "COMPANY" ? c.legalName || c.name : c.contactName || c.name,
    contactName: c.contactName ?? "",
    email: c.billingEmail || c.contactEmail || "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    postalCode: c.postalCode ?? "",
    city: c.city ?? "",
    country: c.country ?? "France",
    siret: c.siret ?? "",
    siren: c.siren ?? "",
    vatNumber: c.vatNumber ?? "",
    legalForm: c.legalForm ?? "",
  };
}

async function createUser(email: string, name: string, role: "CLIENT" | "MAINTAINER", clientId?: string) {
  await auth.api.createUser({ body: { email, password: CLIENT_PASSWORD, name, role: role as "user" } });
  return db.user.update({ where: { email }, data: { clientId, emailVerified: true } });
}

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("Aucun admin : lancer d'abord `npm run db:seed`.");
  if ((await db.client.count()) > 0) {
    console.log("La base contient déjà des clients : démo non chargée.");
    return;
  }

  // ---------- Réglages vendeur (fictifs) ----------
  const settings = await db.setting.upsert({
    where: { id: "app" },
    create: { id: "app" },
    update: {},
  });
  const seller = await db.setting.update({
    where: { id: settings.id },
    data: {
      sellerName: "Camille Durand",
      sellerLegalForm: "EI",
      sellerAddressLine1: "12 rue des Lilas",
      sellerPostalCode: "69003",
      sellerCity: "Lyon",
      sellerEmail: "contact@camille-durand.example",
      sellerPhone: "+33 6 00 00 00 00",
      siret: "000 000 000 00000",
      apeCode: "6201Z",
      iban: "FR76 0000 0000 0000 0000 0000 000",
      bic: "DEMOFRPPXXX",
      bankName: "Banque Démo",
    },
  });

  // ---------- Apporteur ----------
  const referrer = await db.referrer.create({
    data: { name: "Julien Marchand", email: "julien@marchand-conseil.example", defaultCommissionRate: 10 },
  });

  // ---------- Clients ----------
  const company = (data: Partial<Prisma.ClientUncheckedCreateInput> & { name: string }) =>
    db.client.create({ data: { billingType: "COMPANY", city: "Lyon", country: "France", ...data } });

  const lumen = await company({
    name: "Atelier Lumen",
    legalName: "Atelier Lumen SAS",
    legalForm: "SAS",
    contactName: "Sophie Martin",
    contactEmail: "sophie@atelier-lumen.example",
    addressLine1: "4 quai Saint-Antoine",
    postalCode: "69002",
  });
  const riviere = await company({
    name: "Maison Rivière",
    legalName: "Boulangerie Maison Rivière",
    legalForm: "EI",
    contactName: "Thomas Rivière",
    contactEmail: "thomas@maison-riviere.example",
    addressLine1: "21 place Bellecour",
    postalCode: "69002",
  });
  const vasseur = await company({
    name: "Cabinet Vasseur",
    legalName: "Vasseur & Associés Avocats",
    legalForm: "SELARL",
    contactName: "Claire Vasseur",
    contactEmail: "c.vasseur@vasseur-avocats.example",
    addressLine1: "9 cours Lafayette",
    postalCode: "69006",
    referrerId: referrer.id,
    referralDate: daysAgo(150),
  });
  const kinetik = await company({
    name: "Studio Kinetik",
    legalName: "Studio Kinetik SARL",
    legalForm: "SARL",
    contactName: "Nadia Benali",
    contactEmail: "nadia@studio-kinetik.example",
    city: "Grenoble",
    postalCode: "38000",
  });
  const oree = await company({
    name: "Les Jardins d'Orée",
    legalName: "Association Les Jardins d'Orée",
    legalForm: "Association",
    contactName: "Paul Lefèvre",
    contactEmail: "paul@jardins-oree.example",
    city: "Villeurbanne",
    postalCode: "69100",
  });

  // ---------- Utilisateurs ----------
  const sophie = await createUser("sophie@atelier-lumen.example", "Sophie Martin", "CLIENT", lumen.id);
  const thomas = await createUser("thomas@maison-riviere.example", "Thomas Rivière", "CLIENT", riviere.id);
  const claire = await createUser("c.vasseur@vasseur-avocats.example", "Claire Vasseur", "CLIENT", vasseur.id);
  const nadia = await createUser("nadia@studio-kinetik.example", "Nadia Benali", "CLIENT", kinetik.id);
  const maintainer = await createUser("lea@demo.local", "Léa Garnier", "MAINTAINER");

  // ---------- Projets ----------
  const project = (data: Prisma.ProjectUncheckedCreateInput) => db.project.create({ data });
  const pLumen = await project({
    clientId: lumen.id,
    name: "Site vitrine & portfolio",
    description: "Refonte du site de l'atelier : portfolio filtrable, pages services, formulaire de contact.",
    status: "ACTIVE",
    url: "https://atelier-lumen.example",
    amountHt: 4800,
    createdAt: daysAgo(330),
  });
  const pRiviere = await project({
    clientId: riviere.id,
    name: "Click & collect",
    description: "Commande en ligne des viennoiseries et retrait en boutique, paiement Stripe.",
    status: "ACTIVE",
    url: "https://maison-riviere.example",
    amountHt: 6200,
    createdAt: daysAgo(240),
  });
  const pVasseur = await project({
    clientId: vasseur.id,
    name: "Refonte site + espace client",
    description: "Nouveau site du cabinet et espace sécurisé de partage de documents avec les clients.",
    status: "ACTIVE",
    url: "https://vasseur-avocats.example",
    amountHt: 9500,
    createdAt: daysAgo(150),
  });
  const pKinetik = await project({
    clientId: kinetik.id,
    name: "App de réservation de cours",
    description: "Application mobile (iOS / Android) de réservation de cours de danse.",
    status: "ONBOARDING",
    amountHt: 14000,
    createdAt: daysAgo(12),
  });
  const pOree = await project({
    clientId: oree.id,
    name: "Site associatif",
    description: "Site de l'association, agenda des ateliers et adhésions en ligne.",
    status: "COMPLETED",
    url: "https://jardins-oree.example",
    amountHt: 2400,
    vatRate: 20,
    createdAt: daysAgo(360),
  });
  await db.projectAssignment.create({ data: { userId: maintainer.id, projectId: pRiviere.id } });

  // ---------- Jalons ----------
  const milestones: [string, [string, "DONE" | "IN_PROGRESS" | "PLANNED", number][]][] = [
    [pLumen.id, [["Maquettes", "DONE", -300], ["Développement", "DONE", -260], ["Mise en ligne", "DONE", -240], ["Évolutions v2", "IN_PROGRESS", 20]]],
    [pRiviere.id, [["Cadrage & maquettes", "DONE", -200], ["Catalogue & panier", "DONE", -150], ["Paiement Stripe", "DONE", -110], ["Programme fidélité", "IN_PROGRESS", 25]]],
    [pVasseur.id, [["Ateliers & arborescence", "DONE", -120], ["Design", "DONE", -80], ["Développement du site", "IN_PROGRESS", 10], ["Espace client", "PLANNED", 45], ["Recette & mise en ligne", "PLANNED", 60]]],
    [pKinetik.id, [["Onboarding & cadrage", "IN_PROGRESS", 7], ["Maquettes", "PLANNED", 30], ["Développement MVP", "PLANNED", 90]]],
    [pOree.id, [["Maquettes", "DONE", -330], ["Développement", "DONE", -300], ["Mise en ligne", "DONE", -280]]],
  ];
  for (const [projectId, list] of milestones) {
    await db.milestone.createMany({
      data: list.map(([title, status, offset], order) => ({
        projectId,
        title,
        status,
        order,
        dueDate: daysAhead(offset),
        completedAt: status === "DONE" ? daysAhead(offset) : null,
      })),
    });
  }

  // ---------- Factures, devis et encaissements ----------
  const seqByDay = new Map<string, number>();
  const numberFor = (type: "INVOICE" | "QUOTE", date: Date) => {
    const { year, minSeq } = docDayKey(date);
    const k = `${type}-${year}-${minSeq}`;
    const seq = (seqByDay.get(k) ?? minSeq - 1) + 1;
    seqByDay.set(k, seq);
    const prefix = type === "INVOICE" ? seller.invoicePrefix : seller.quotePrefix;
    return { year, seq, number: formatDocNumber(prefix, year, seq) };
  };

  async function document(opts: {
    type: "INVOICE" | "QUOTE";
    client: Client;
    projectId: string;
    items: LineItem[];
    issuedDaysAgo: number;
    status: "ISSUED" | "PAID" | "ACCEPTED" | "DRAFT";
    paidDaysAgo?: number;
  }) {
    const vatRate = 20;
    const totals = computeTotals(opts.items, vatRate);
    const base = {
      type: opts.type,
      clientId: opts.client.id,
      projectId: opts.projectId,
      vatRate,
      items: opts.items,
      ...totals,
    };
    if (opts.status === "DRAFT") return db.document.create({ data: { ...base, status: "DRAFT" } });

    const issueDate = daysAgo(opts.issuedDaysAgo);
    const { year, seq, number } = numberFor(opts.type, issueDate);
    let paymentId: string | undefined;
    let paidAt: Date | undefined;
    if (opts.status === "PAID") {
      paidAt = daysAgo(opts.paidDaysAgo ?? opts.issuedDaysAgo - 10, 15);
      const payment = await db.payment.create({
        data: { projectId: opts.projectId, amount: totals.total, vatRate, method: `Facture ${number}`, paidAt },
      });
      paymentId = payment.id;
    }
    return db.document.create({
      data: {
        ...base,
        status: opts.status,
        number,
        year,
        seq,
        issueDate,
        dueDate: opts.type === "INVOICE" ? new Date(issueDate.getTime() + seller.paymentTermsDays * DAY) : null,
        validUntil: opts.type === "QUOTE" ? new Date(issueDate.getTime() + seller.quoteValidityDays * DAY) : null,
        acceptedAt: opts.status === "ACCEPTED" ? new Date(issueDate.getTime() + 4 * DAY) : null,
        paidAt,
        paymentId,
        sellerSnapshot: sellerSnapshot(seller),
        clientSnapshot: clientSnapshot(opts.client),
      },
    });
  }
  const line = (description: string, unitPrice: number, quantity = 1): LineItem => ({ description, quantity, unitPrice });

  // Les Jardins d'Orée : projet terminé, soldé.
  await document({ type: "INVOICE", client: oree, projectId: pOree.id, items: [line("Site associatif — acompte 50 %", 1200)], issuedDaysAgo: 345, status: "PAID" });
  await document({ type: "INVOICE", client: oree, projectId: pOree.id, items: [line("Site associatif — solde", 1200)], issuedDaysAgo: 285, status: "PAID" });
  // Atelier Lumen
  await document({ type: "QUOTE", client: lumen, projectId: pLumen.id, items: [line("Design UI (maquettes Figma)", 1400), line("Développement Next.js", 2800), line("Mise en ligne & formation", 600)], issuedDaysAgo: 335, status: "ACCEPTED" });
  await document({ type: "INVOICE", client: lumen, projectId: pLumen.id, items: [line("Site vitrine — acompte 30 %", 1440)], issuedDaysAgo: 320, status: "PAID" });
  await document({ type: "INVOICE", client: lumen, projectId: pLumen.id, items: [line("Site vitrine — situation 40 %", 1920)], issuedDaysAgo: 270, status: "PAID" });
  await document({ type: "INVOICE", client: lumen, projectId: pLumen.id, items: [line("Site vitrine — solde", 1440)], issuedDaysAgo: 235, status: "PAID" });
  // Maison Rivière
  await document({ type: "INVOICE", client: riviere, projectId: pRiviere.id, items: [line("Click & collect — acompte", 1860)], issuedDaysAgo: 230, status: "PAID" });
  await document({ type: "INVOICE", client: riviere, projectId: pRiviere.id, items: [line("Catalogue & panier", 2170)], issuedDaysAgo: 150, status: "PAID" });
  await document({ type: "INVOICE", client: riviere, projectId: pRiviere.id, items: [line("Intégration paiement Stripe", 2170)], issuedDaysAgo: 45, status: "ISSUED" });
  // Cabinet Vasseur
  await document({ type: "QUOTE", client: vasseur, projectId: pVasseur.id, items: [line("Ateliers de cadrage", 900), line("Design du site", 2100), line("Développement du site", 3800), line("Espace client sécurisé", 2700)], issuedDaysAgo: 155, status: "ACCEPTED" });
  await document({ type: "INVOICE", client: vasseur, projectId: pVasseur.id, items: [line("Refonte — acompte 30 %", 2850)], issuedDaysAgo: 140, status: "PAID" });
  await document({ type: "INVOICE", client: vasseur, projectId: pVasseur.id, items: [line("Refonte — design validé", 2850)], issuedDaysAgo: 75, status: "PAID" });
  // Studio Kinetik
  await document({ type: "QUOTE", client: kinetik, projectId: pKinetik.id, items: [line("Cadrage & ateliers", 1500), line("Design mobile", 3500), line("Développement MVP React Native", 9000)], issuedDaysAgo: 10, status: "ISSUED" });
  await document({ type: "INVOICE", client: kinetik, projectId: pKinetik.id, items: [line("App réservation — acompte 30 %", 4200)], issuedDaysAgo: 0, status: "DRAFT" });

  // Maintenance mensuelle (revenu récurrent)
  await db.recurringRevenue.create({
    data: { clientId: lumen.id, label: "Maintenance & hébergement", amountHt: 180, startsOn: daysAgo(230), mode: "FIXED" },
  });
  for (const m of [6, 5, 4, 3, 2, 1]) {
    await db.payment.create({
      data: { projectId: pLumen.id, amount: 216, vatRate: 20, method: "Virement — maintenance", paidAt: daysAgo(m * 30 + 3, 9) },
    });
  }

  // ---------- Tickets ----------
  type T = {
    project: string;
    author: string;
    title: string;
    description: string;
    type: TicketType;
    priority: TicketPriority;
    status: TicketStatus;
    age: number;
    comments?: [string, string][];
  };
  const A = admin.id;
  const tickets: T[] = [
    { project: pRiviere.id, author: thomas.id, title: "Le bouton « Payer » ne répond pas sur iPhone", description: "Sur Safari iOS, rien ne se passe quand on valide le panier. Testé sur deux iPhone différents.", type: "BUG", priority: "URGENT", status: "IN_PROGRESS", age: 1, comments: [[A, "Reproduit sur iOS 18, c'est le script Stripe qui est bloqué. Je corrige dans la journée."], [thomas.id, "Merci, c'est notre plus gros créneau de commandes demain matin."]] },
    { project: pRiviere.id, author: thomas.id, title: "Ajouter les galettes des rois au catalogue", description: "Il faudrait une catégorie saisonnière visible uniquement en janvier.", type: "EVOLUTION", priority: "MEDIUM", status: "NEW", age: 2 },
    { project: pRiviere.id, author: thomas.id, title: "Créneaux de retrait le dimanche", description: "Peut-on ouvrir les créneaux du dimanche de 7h à 12h ?", type: "QUESTION", priority: "LOW", status: "WAITING_ON_CLIENT", age: 6, comments: [[A, "Oui, c'est un réglage. Tu veux des créneaux de 15 ou 30 minutes ?"]] },
    { project: pRiviere.id, author: thomas.id, title: "Les emails de confirmation arrivent en spam", description: "Plusieurs clients ne reçoivent pas la confirmation de commande.", type: "BUG", priority: "HIGH", status: "RESOLVED", age: 20, comments: [[A, "Enregistrements SPF et DKIM ajoutés sur le domaine, la délivrabilité est revenue à la normale."]] },
    { project: pRiviere.id, author: A, title: "Programme de fidélité : maquette", description: "Carte de fidélité numérique : 10 achats = 1 viennoiserie offerte.", type: "EVOLUTION", priority: "MEDIUM", status: "IN_DEV", age: 9 },
    { project: pVasseur.id, author: claire.id, title: "Retours sur la maquette de la page Équipe", description: "Les photos sont trop grandes et on aimerait afficher les domaines d'expertise sous chaque nom.", type: "DESIGN_FEEDBACK", priority: "MEDIUM", status: "IN_PROGRESS", age: 3, comments: [[A, "Bien noté, je propose une version en grille de 3 colonnes avec les expertises en badges."]] },
    { project: pVasseur.id, author: claire.id, title: "Mentions légales et RGPD", description: "Notre DPO doit relire la politique de confidentialité avant la mise en ligne.", type: "QUESTION", priority: "HIGH", status: "WAITING_ON_CLIENT", age: 8 },
    { project: pVasseur.id, author: claire.id, title: "Le formulaire de contact n'envoie pas les pièces jointes", description: "Les PDF de plus de 5 Mo sont refusés sans message d'erreur.", type: "BUG", priority: "HIGH", status: "NEW", age: 0 },
    { project: pVasseur.id, author: A, title: "Espace client : authentification à deux facteurs", description: "Prévoir la double authentification par email pour l'espace documents.", type: "EVOLUTION", priority: "MEDIUM", status: "NEW", age: 4 },
    { project: pVasseur.id, author: claire.id, title: "Couleur des titres trop claire", description: "Le bleu des titres manque de contraste sur fond blanc.", type: "DESIGN_FEEDBACK", priority: "LOW", status: "CLOSED", age: 30 },
    { project: pLumen.id, author: sophie.id, title: "Ajouter un filtre « Céramique » au portfolio", description: "Nous avons une nouvelle collection à mettre en avant.", type: "EVOLUTION", priority: "MEDIUM", status: "IN_PROGRESS", age: 5 },
    { project: pLumen.id, author: sophie.id, title: "Images floues sur écran Retina", description: "Les visuels de la page d'accueil sont pixellisés sur MacBook.", type: "BUG", priority: "MEDIUM", status: "RESOLVED", age: 14, comments: [[A, "Les images sont maintenant servies en 2x via next/image. Peux-tu confirmer de ton côté ?"], [sophie.id, "Parfait, c'est net !"]] },
    { project: pLumen.id, author: sophie.id, title: "Mettre à jour les horaires d'ouverture", description: "Fermeture le lundi à partir du mois prochain.", type: "EVOLUTION", priority: "LOW", status: "CLOSED", age: 25 },
    { project: pLumen.id, author: sophie.id, title: "Comment modifier les textes de la page À propos ?", description: "Je ne trouve pas où éditer ce contenu dans le CMS.", type: "QUESTION", priority: "LOW", status: "RESOLVED", age: 35 },
    { project: pLumen.id, author: sophie.id, title: "Lien Instagram cassé dans le pied de page", description: "Le lien renvoie vers une page 404.", type: "BUG", priority: "LOW", status: "CLOSED", age: 45 },
    { project: pKinetik.id, author: nadia.id, title: "Envoi des accès App Store Connect", description: "Je vous ai ajouté comme développeur, à confirmer.", type: "QUESTION", priority: "MEDIUM", status: "NEW", age: 1 },
    { project: pKinetik.id, author: nadia.id, title: "Charte graphique et logo", description: "Voici nos couleurs et notre logo en SVG pour les maquettes.", type: "DESIGN_FEEDBACK", priority: "MEDIUM", status: "RESOLVED", age: 7 },
    { project: pOree.id, author: A, title: "Renouvellement du nom de domaine", description: "Le domaine expire dans 30 jours, à renouveler.", type: "EVOLUTION", priority: "LOW", status: "CLOSED", age: 55 },
  ];

  const flow: Record<TicketStatus, TicketStatus[]> = {
    NEW: [],
    IN_PROGRESS: ["IN_PROGRESS"],
    IN_DEV: ["IN_PROGRESS", "IN_DEV"],
    WAITING_ON_CLIENT: ["IN_PROGRESS", "WAITING_ON_CLIENT"],
    RESOLVED: ["IN_PROGRESS", "RESOLVED"],
    CLOSED: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  };
  for (const t of tickets) {
    const createdAt = daysAgo(t.age, 9 + (t.title.length % 8));
    const steps = flow[t.status];
    const stepAt = (i: number) => new Date(createdAt.getTime() + ((i + 1) * Math.max(t.age, 1) * DAY) / (steps.length + 1));
    const ticket = await db.ticket.create({
      data: {
        projectId: t.project,
        createdById: t.author,
        title: t.title,
        description: t.description,
        type: t.type,
        priority: t.priority,
        status: t.status,
        dueDate: computeDueDate(t.priority, createdAt),
        resolvedAt: steps.includes("RESOLVED") ? stepAt(steps.indexOf("RESOLVED")) : null,
        closedAt: t.status === "CLOSED" ? stepAt(steps.length - 1) : null,
        createdAt,
        updatedAt: steps.length ? stepAt(steps.length - 1) : createdAt,
      },
    });
    let from: TicketStatus = "NEW";
    for (const [i, to] of steps.entries()) {
      await db.ticketStatusChange.create({
        data: { ticketId: ticket.id, fromStatus: from, toStatus: to, changedById: A, createdAt: stepAt(i) },
      });
      from = to;
    }
    for (const [i, [authorId, body]] of (t.comments ?? []).entries()) {
      await db.comment.create({
        data: { ticketId: ticket.id, authorId, body, createdAt: new Date(createdAt.getTime() + (i + 1) * 3 * 3600_000) },
      });
    }
  }

  // ---------- Vault ----------
  const request = await db.credentialRequest.create({
    data: { projectId: pVasseur.id, provider: "OVH", label: "Accès OVH (nom de domaine)", status: "PROVIDED", instructions: "Compte qui gère le domaine vasseur-avocats.example." },
  });
  await db.vaultCredential.create({
    data: {
      clientId: vasseur.id,
      projectId: pVasseur.id,
      requestId: request.id,
      provider: "OVH",
      label: "Manager OVH",
      data: encryptFields({ url: "https://www.ovh.com/manager", login: "vasseur-demo", password: "demo-password-not-real", notes: "" }),
      createdById: claire.id,
    },
  });
  await db.credentialRequest.createMany({
    data: [
      { projectId: pVasseur.id, provider: "GITHUB", label: "Dépôt GitHub du cabinet", order: 1 },
      { projectId: pKinetik.id, provider: "OTHER", label: "App Store Connect", order: 0 },
    ],
  });

  // ---------- Suivi du temps ----------
  const timeProjects = [pRiviere.id, pVasseur.id, pVasseur.id, pLumen.id, pKinetik.id];
  for (let d = 1; d <= 20; d++) {
    if ([0, 6].includes(daysAgo(d).getDay())) continue;
    const projectId = timeProjects[d % timeProjects.length];
    const startedAt = daysAgo(d, 9);
    await db.timeEntry.create({
      data: { projectId, startedAt, endedAt: new Date(startedAt.getTime() + (2 + (d % 4)) * 3600_000), note: "Développement" },
    });
  }

  // ---------- Monitoring ----------
  const monitored: [string, number][] = [[pLumen.id, 182], [pRiviere.id, 241], [pVasseur.id, 318], [pOree.id, 205]];
  for (const [projectId, ms] of monitored) {
    await db.siteMonitor.create({
      data: { projectId, status: "UP", lastCheckedAt: now, lastStatusCode: 200, responseMs: ms, lastOkAt: now },
    });
  }

  // ---------- Connexions ----------
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  for (const [userId, d] of [[sophie.id, 1], [thomas.id, 0], [claire.id, 2], [nadia.id, 1], [maintainer.id, 0]] as const) {
    await db.loginEvent.create({ data: { userId, ipAddress: "203.0.113.10", userAgent: ua, createdAt: daysAgo(d, 8) } });
  }

  // ---------- Calendrier ----------
  const today = parisNow(now).day;
  // Vendredi (index 4) le plus récent avant aujourd'hui.
  const lastFriday = addDays(today, -((weekdayIndex(today) + 3) % 7 || 7));
  const calendarTasks = await Promise.all([
    db.calendarTask.create({
      data: { ...fiscalTask("URSSAF", "MONTHLY", today), remindDaysBefore: 7, preset: "URSSAF" },
    }),
    db.calendarTask.create({
      data: { ...fiscalTask("TVA", "QUARTERLY", today), remindDaysBefore: 7, preset: "TVA" },
    }),
    db.calendarTask.create({
      data: {
        title: "Maintenance mensuelle — Atelier Lumen",
        notes: "Mises à jour, sauvegarde, contrôle des formulaires et du certificat SSL.",
        startDate: addDays(today, -26),
        time: "10:00",
        recurrence: "MONTHLY",
        remindDaysBefore: 1,
      },
    }),
    db.calendarTask.create({
      data: {
        title: "Sauvegarde des sites clients",
        startDate: lastFriday,
        time: "17:00",
        recurrence: "WEEKLY",
        remindDaysBefore: 0,
      },
    }),
    db.calendarTask.create({
      data: {
        title: "Renouvellement du nom de domaine — Rivière",
        notes: "Vérifier le renouvellement automatique chez le registrar.",
        startDate: addDays(today, 12),
        recurrence: "YEARLY",
        remindDaysBefore: 7,
      },
    }),
    db.calendarTask.create({
      data: { title: "Point d'avancement — Kinetik", startDate: addDays(today, 2), time: "14:30", remindDaysBefore: 0 },
    }),
    db.calendarTask.create({
      data: { title: "Envoyer le rapport de maintenance — Orée", startDate: addDays(today, -3), remindDaysBefore: 0 },
    }),
  ]);
  // Occurrences passées cochées, sauf le rapport Orée laissé en retard.
  for (const task of calendarTasks.filter((t) => !t.title.includes("Orée"))) {
    for (const date of occurrencesBetween(task, addDays(today, -40), addDays(today, -1))) {
      await db.calendarOccurrence.create({ data: { taskId: task.id, date, doneAt: daysAgo(1) } });
    }
  }

  console.log("Démo chargée. Comptes clients (mot de passe : " + CLIENT_PASSWORD + ") :");
  for (const u of [sophie, thomas, claire, nadia, maintainer]) console.log(`  - ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
