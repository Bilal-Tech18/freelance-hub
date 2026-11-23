import "server-only";

import PDFDocument from "pdfkit";
import {
  DOC_TYPE_LABELS,
  LATE_PAYMENT_MENTION,
  vatLegalMention,
  type DocumentType,
  type LineItem,
} from "@/lib/documents";

type Snapshot = Record<string, string | boolean>;

const eurFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
// Helvetica (WinAnsi) ne connaît pas les espaces insécables fines d'Intl (U+202F)
// → pdfkit les remplace par un glyphe parasite. On les normalise en espaces.
const eur = { format: (n: number) => eurFmt.format(n).replace(/[  ]/g, " ") };
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

const BLUE = "#2563eb";
const GREY = "#6b7280";
const DARK = "#111827";
const LIGHT = "#f3f4f6";
const GREEN = "#047857";
const GREEN_BG = "#ecfdf5";

const M = 48; // marge
const PAGE_W = 595.28; // A4 largeur en points
const PAGE_H = 841.89; // A4 hauteur en points
const CONTENT_W = PAGE_W - M * 2;

export type DocumentPdfData = {
  type: DocumentType;
  number: string;
  issueDate: Date | null;
  dueDate: Date | null;
  validUntil: Date | null;
  // Renseigné sur une facture réglée : le PDF porte alors la mention
  // acquittée, pour servir de justificatif de paiement au client.
  paidAt: Date | null;
  vatRate: number;
  items: LineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  seller: Snapshot;
  client: Snapshot;
};

function partyLines(snap: Snapshot, isSeller: boolean): { name: string; lines: string[] } {
  const name = String((isSeller ? snap.name : snap.displayName) || "");
  const lines: string[] = [];
  const push = (v: unknown, prefix = "") => {
    if (v) lines.push(prefix + String(v));
  };
  push(snap.legalForm);
  push(snap.addressLine1);
  push(snap.addressLine2);
  const city = [snap.postalCode, snap.city].filter(Boolean).join(" ");
  if (city) lines.push(city);
  push(snap.country);
  push(snap.email);
  push(snap.phone);
  push(snap.siret, "SIRET : ");
  push(snap.vatNumber, "TVA : ");
  return { name, lines };
}

export function renderDocumentPdf(data: DocumentPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: M });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const isInvoice = data.type === "INVOICE";

  // ---- En-tête ----
  doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(22).text(DOC_TYPE_LABELS[data.type].toUpperCase(), M, M);
  doc.fillColor(DARK).font("Helvetica").fontSize(10).text(data.number, M, M + 30);

  const metaLines: string[] = [];
  if (data.issueDate) metaLines.push(`Date : ${dateFmt.format(data.issueDate)}`);
  // Pas d'échéance sur une facture déjà réglée : elle n'a plus d'objet et
  // laisse croire au client qu'il reste quelque chose à payer.
  if (isInvoice && data.dueDate && !data.paidAt)
    metaLines.push(`Échéance : ${dateFmt.format(data.dueDate)}`);
  if (!isInvoice && data.validUntil) metaLines.push(`Valable jusqu'au ${dateFmt.format(data.validUntil)}`);
  doc.fillColor(GREY).fontSize(9).text(metaLines.join("\n"), M, M + 4, {
    width: CONTENT_W,
    align: "right",
  });

  // ---- Parties ----
  const partiesY = M + 70;
  const colW = (CONTENT_W - 20) / 2;
  const seller = partyLines(data.seller, true);
  const client = partyLines(data.client, false);

  const drawParty = (label: string, name: string, lines: string[], x: number) => {
    doc.fillColor(GREY).font("Helvetica").fontSize(8).text(label.toUpperCase(), x, partiesY);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(name, x, partiesY + 12, { width: colW });
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    doc.text(lines.join("\n"), x, partiesY + 28, { width: colW });
  };
  drawParty("Émetteur", seller.name, seller.lines, M);
  drawParty("Destinataire", client.name, client.lines, M + colW + 20);

  // ---- Tableau ----
  let y = partiesY + 40 + Math.max(seller.lines.length, client.lines.length) * 12 + 20;
  const cDesc = M + 8;
  const cQty = M + CONTENT_W * 0.54;
  const cPu = M + CONTENT_W * 0.68;
  const cTot = M + CONTENT_W * 0.84;

  doc.rect(M, y, CONTENT_W, 22).fill(BLUE);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
  doc.text("Désignation", cDesc, y + 7);
  doc.text("Qté", cQty, y + 7, { width: CONTENT_W * 0.12, align: "right" });
  doc.text("PU HT", cPu, y + 7, { width: CONTENT_W * 0.14, align: "right" });
  doc.text("Total HT", cTot, y + 7, { width: CONTENT_W * 0.14, align: "right" });
  y += 22;

  doc.font("Helvetica").fontSize(9).fillColor(DARK);
  for (const it of data.items) {
    const descHeight = doc.heightOfString(it.description, { width: CONTENT_W * 0.5 });
    const rowH = Math.max(20, descHeight + 8);
    if (y + rowH > 760) {
      doc.addPage();
      y = M;
    }
    doc.fillColor(DARK).text(it.description, cDesc, y + 5, { width: CONTENT_W * 0.5 });
    doc.text(String(it.quantity), cQty, y + 5, { width: CONTENT_W * 0.12, align: "right" });
    doc.text(eur.format(it.unitPrice), cPu, y + 5, { width: CONTENT_W * 0.14, align: "right" });
    doc.text(eur.format(it.quantity * it.unitPrice), cTot, y + 5, {
      width: CONTENT_W * 0.14,
      align: "right",
    });
    y += rowH;
    doc.moveTo(M, y).lineTo(M + CONTENT_W, y).strokeColor(LIGHT).stroke();
  }

  // ---- Totaux ----
  y += 14;
  const totX = M + CONTENT_W * 0.55;
  const totW = CONTENT_W * 0.45;
  const totalRow = (label: string, value: string, filled: boolean) => {
    if (filled) {
      doc.rect(totX, y, totW, 22).fill(BLUE);
      doc.fillColor("#ffffff").font("Helvetica-Bold");
    } else {
      doc.fillColor(DARK).font("Helvetica");
    }
    doc.fontSize(10).text(label, totX + 8, y + 6);
    doc.text(value, totX, y + 6, { width: totW - 8, align: "right" });
    y += 24;
  };
  totalRow("Total HT", eur.format(data.subtotal), false);
  totalRow(`TVA (${data.vatRate}%)`, eur.format(data.vatAmount), false);
  totalRow("Total TTC", eur.format(data.total), true);

  // ---- Acquit ----
  if (isInvoice && data.paidAt) {
    y += 6;
    doc.rect(totX, y, totW, 22).fill(GREEN_BG);
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(10);
    doc.text("Net à payer", totX + 8, y + 6);
    doc.text(eur.format(0), totX, y + 6, { width: totW - 8, align: "right" });
    y += 28;
    doc
      .fillColor(GREEN)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        `Facture acquittée — réglée le ${dateFmt.format(data.paidAt)}`,
        M,
        y
      );
    y += 14;
  }

  // ---- Coordonnées bancaires ----
  y += 16;
  // Inutile de réclamer un virement sur une facture déjà réglée.
  if (!data.paidAt && (data.seller.iban || data.seller.bankName)) {
    const bankLines = ["Coordonnées bancaires"];
    if (data.seller.bankName) bankLines.push(String(data.seller.bankName));
    if (data.seller.iban) bankLines.push(`IBAN : ${data.seller.iban}`);
    if (data.seller.bic) bankLines.push(`BIC : ${data.seller.bic}`);
    const bh = bankLines.length * 13 + 12;
    doc.rect(M, y, CONTENT_W, bh).fill(LIGHT);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9).text(bankLines[0], M + 8, y + 6);
    doc.font("Helvetica").text(bankLines.slice(1).join("\n"), M + 8, y + 19);
    y += bh + 12;
  }

  // ---- Notes ----
  if (data.notes) {
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9).text("Notes", M, y);
    y += 13;
    doc.font("Helvetica").fillColor(DARK).text(data.notes, M, y, { width: CONTENT_W });
    y = doc.y + 12;
  }

  // ---- Mentions légales ----
  const legal: string[] = [vatLegalMention(Boolean(data.seller.vatExempt))];
  if (isInvoice) legal.push(LATE_PAYMENT_MENTION);
  if (data.seller.legalMentions) legal.push(String(data.seller.legalMentions));
  const legalText = legal.join("\n");
  doc.font("Helvetica").fontSize(7);
  const legalH = doc.heightOfString(legalText, { width: CONTENT_W });
  // Ancré en bas de page, mais jamais au-delà de la marge basse (sinon pdfkit
  // déclenche un saut de page automatique et coupe le texte en deux).
  const legalY = Math.max(y, PAGE_H - M - legalH - 2);
  doc.fillColor(GREY).text(legalText, M, legalY, {
    width: CONTENT_W,
  });

  doc.end();
  return done;
}
