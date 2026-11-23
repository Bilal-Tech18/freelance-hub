import { z } from "zod";

/**
 * Questionnaire d'onboarding V1 : une seule définition, versionnée ici.
 * Les réponses sont stockées en Json (OnboardingResponse.answers).
 */

export type OnboardingField = {
  name: keyof OnboardingAnswers;
  label: string;
  type: "text" | "textarea";
  placeholder?: string;
  required?: boolean;
};

export type OnboardingSection = {
  id: string;
  title: string;
  description?: string;
  fields: OnboardingField[];
};

export const onboardingAnswersSchema = z.object({
  activity: z.string().max(2000).default(""),
  goals: z.string().max(2000).default(""),
  audience: z.string().max(2000).default(""),
  existingContent: z.string().max(2000).default(""),
  brandAssets: z.string().max(2000).default(""),
  inspirations: z.string().max(2000).default(""),
  domain: z.string().max(500).default(""),
  hosting: z.string().max(500).default(""),
  accesses: z.string().max(2000).default(""),
  constraints: z.string().max(2000).default(""),
  notes: z.string().max(5000).default(""),
});

export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>;

/** Champs exigés à la soumission (pas au brouillon). */
export const REQUIRED_ON_SUBMIT: (keyof OnboardingAnswers)[] = [
  "activity",
  "goals",
];

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    id: "context",
    title: "Contexte & objectifs",
    fields: [
      {
        name: "activity",
        label: "Votre activité",
        type: "textarea",
        placeholder: "Décrivez votre activité, vos produits/services…",
        required: true,
      },
      {
        name: "goals",
        label: "Objectifs du projet",
        type: "textarea",
        placeholder: "Que doit accomplir ce projet ? (vendre, informer, générer des leads…)",
        required: true,
      },
      {
        name: "audience",
        label: "Votre cible",
        type: "textarea",
        placeholder: "Qui sont vos clients / utilisateurs ?",
      },
    ],
  },
  {
    id: "content",
    title: "Contenus & identité",
    fields: [
      {
        name: "existingContent",
        label: "Contenus existants",
        type: "textarea",
        placeholder: "Textes, photos, vidéos déjà disponibles ? Liens Drive/Dropbox…",
      },
      {
        name: "brandAssets",
        label: "Logo & charte graphique",
        type: "textarea",
        placeholder: "Liens vers votre logo, couleurs, polices, charte…",
      },
      {
        name: "inspirations",
        label: "Références & inspirations",
        type: "textarea",
        placeholder: "Sites que vous aimez (et pourquoi)",
      },
    ],
  },
  {
    id: "technical",
    title: "Technique & accès",
    description:
      "Ne collez jamais de mots de passe ici — partagez-les via un gestionnaire de mots de passe.",
    fields: [
      {
        name: "domain",
        label: "Nom de domaine",
        type: "text",
        placeholder: "exemple.com (déjà acheté ? chez qui ?)",
      },
      {
        name: "hosting",
        label: "Hébergement actuel",
        type: "text",
        placeholder: "OVH, Vercel, aucun…",
      },
      {
        name: "accesses",
        label: "Accès à prévoir",
        type: "textarea",
        placeholder: "Quels accès faudra-t-il partager ? (registrar, CMS, analytics…)",
      },
    ],
  },
  {
    id: "misc",
    title: "Contraintes & remarques",
    fields: [
      {
        name: "constraints",
        label: "Contraintes",
        type: "textarea",
        placeholder: "Deadline, budget, obligations légales, RGPD…",
      },
      {
        name: "notes",
        label: "Autre chose à me dire ?",
        type: "textarea",
      },
    ],
  },
];
