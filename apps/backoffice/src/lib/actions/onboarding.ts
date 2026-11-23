"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, getScopedProjectWhere } from "@/lib/authz";
import {
  onboardingAnswersSchema,
  ONBOARDING_SECTIONS,
} from "@/lib/onboarding-schema";

export type ActionState = { error?: string; saved?: boolean } | undefined;

const myInfoSchema = z.object({
  billingType: z.enum(["COMPANY", "INDIVIDUAL"]),
  legalName: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  billingEmail: z.string().email("Email invalide").or(z.literal("")).optional(),
  phone: z.string().max(40).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  postalCode: z.string().max(20).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  siret: z.string().max(30).optional(),
  vatNumber: z.string().max(30).optional(),
  legalForm: z.string().max(60).optional(),
});

/** Le client renseigne les infos de SON entreprise (onboarding, étape 1). */
export async function updateMyClientInfoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!user.clientId) return { error: "Aucun client associé." };
  const parsed = myInfoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.client.update({
    where: { id: user.clientId },
    data: {
      billingType: parsed.data.billingType,
      legalName: parsed.data.legalName || null,
      contactName: parsed.data.contactName || null,
      billingEmail: parsed.data.billingEmail || null,
      phone: parsed.data.phone || null,
      addressLine1: parsed.data.addressLine1 || null,
      addressLine2: parsed.data.addressLine2 || null,
      postalCode: parsed.data.postalCode || null,
      city: parsed.data.city || null,
      country: parsed.data.country || null,
      siret: parsed.data.siret || null,
      vatNumber: parsed.data.vatNumber || null,
      legalForm: parsed.data.legalForm || null,
    },
  });
  revalidatePath("/onboarding");
  return { saved: true };
}

function answersFromForm(formData: FormData) {
  const raw: Record<string, string> = {};
  for (const section of ONBOARDING_SECTIONS) {
    for (const field of section.fields) {
      raw[field.name] = String(formData.get(field.name) ?? "");
    }
  }
  return onboardingAnswersSchema.safeParse(raw);
}

async function getEditableOnboarding(projectId: string) {
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: { id: projectId, ...getScopedProjectWhere(user) },
    include: { onboarding: true },
  });
  if (!project) return { error: "Projet introuvable." as const };
  const onboarding =
    project.onboarding ??
    (await db.onboardingResponse.create({ data: { projectId: project.id } }));
  // Le client peut revenir compléter/mettre à jour à tout moment, même après
  // avoir soumis (étapes passables => on ne verrouille pas).
  return { onboarding };
}

export async function saveOnboardingDraftAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const ctx = await getEditableOnboarding(projectId);
  if ("error" in ctx) return { error: ctx.error };

  const parsed = answersFromForm(formData);
  if (!parsed.success) return { error: "Réponses invalides." };

  await db.onboardingResponse.update({
    where: { id: ctx.onboarding.id },
    data: { answers: parsed.data },
  });
  revalidatePath(`/projects/${projectId}/onboarding`);
  return { saved: true };
}

export async function submitOnboardingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const ctx = await getEditableOnboarding(projectId);
  if ("error" in ctx) return { error: ctx.error };

  // Étapes passables : on ne réimpose pas de champs. On fige seulement le statut,
  // sans écraser les réponses déjà enregistrées en brouillon.
  await db.onboardingResponse.update({
    where: { id: ctx.onboarding.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  revalidatePath(`/projects/${projectId}/onboarding`);
  revalidatePath(`/projects/${projectId}`);
  return { saved: true };
}
