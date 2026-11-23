export type CredentialProvider =
  | "RENDER"
  | "VERCEL"
  | "AZURE"
  | "AWS"
  | "GCP"
  | "OVH"
  | "CLOUDFLARE"
  | "GITHUB"
  | "GITLAB"
  | "CLOUDINARY"
  | "STRIPE"
  | "DOMAIN_REGISTRAR"
  | "DATABASE"
  | "SMTP_EMAIL"
  | "CMS"
  | "ANALYTICS"
  | "SOCIAL"
  | "FTP_SSH"
  | "OTHER";

export type CredentialField = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
};

type ProviderMeta = {
  label: string;
  hint: string;
  fields: CredentialField[];
};

const LOGIN_PASSWORD: CredentialField[] = [
  { key: "url", label: "URL de connexion", type: "text" },
  { key: "login", label: "Identifiant / email", type: "text" },
  { key: "password", label: "Mot de passe", type: "password" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const API_KEY: CredentialField[] = [
  { key: "apiKey", label: "Clé API", type: "password" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const PROVIDERS: Record<CredentialProvider, ProviderMeta> = {
  RENDER: { label: "Render", hint: "Accès au compte Render (hébergement)", fields: LOGIN_PASSWORD },
  VERCEL: { label: "Vercel", hint: "Accès au compte Vercel", fields: LOGIN_PASSWORD },
  AZURE: { label: "Microsoft Azure", hint: "Accès au portail Azure", fields: LOGIN_PASSWORD },
  AWS: {
    label: "Amazon AWS",
    hint: "Clés IAM ou accès console",
    fields: [
      { key: "accessKeyId", label: "Access Key ID", type: "text" },
      { key: "secretAccessKey", label: "Secret Access Key", type: "password" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  GCP: { label: "Google Cloud", hint: "Accès à la console GCP", fields: LOGIN_PASSWORD },
  OVH: { label: "OVHcloud", hint: "Accès au manager OVH", fields: LOGIN_PASSWORD },
  CLOUDFLARE: { label: "Cloudflare", hint: "Accès / token Cloudflare", fields: LOGIN_PASSWORD },
  GITHUB: { label: "GitHub", hint: "Accès au dépôt / organisation", fields: LOGIN_PASSWORD },
  GITLAB: { label: "GitLab", hint: "Accès au dépôt GitLab", fields: LOGIN_PASSWORD },
  CLOUDINARY: { label: "Cloudinary", hint: "Identifiants médias Cloudinary", fields: API_KEY },
  STRIPE: { label: "Stripe", hint: "Clés API Stripe", fields: API_KEY },
  DOMAIN_REGISTRAR: {
    label: "Registrar / nom de domaine",
    hint: "Là où le domaine est acheté (OVH, Gandi, GoDaddy…)",
    fields: LOGIN_PASSWORD,
  },
  DATABASE: {
    label: "Base de données",
    hint: "Chaîne de connexion ou identifiants",
    fields: [
      { key: "connectionString", label: "Connection string", type: "password" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  SMTP_EMAIL: { label: "Email / SMTP", hint: "Boîte email ou serveur d'envoi", fields: LOGIN_PASSWORD },
  CMS: { label: "CMS", hint: "WordPress, Webflow, Strapi…", fields: LOGIN_PASSWORD },
  ANALYTICS: { label: "Analytics", hint: "Google Analytics, Plausible…", fields: LOGIN_PASSWORD },
  SOCIAL: { label: "Réseaux sociaux", hint: "Comptes réseaux à gérer", fields: LOGIN_PASSWORD },
  FTP_SSH: {
    label: "FTP / SSH",
    hint: "Accès serveur",
    fields: [
      { key: "host", label: "Hôte", type: "text" },
      { key: "port", label: "Port", type: "text" },
      { key: "login", label: "Utilisateur", type: "text" },
      { key: "password", label: "Mot de passe / clé", type: "password" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  OTHER: {
    label: "Autre",
    hint: "Tout autre accès",
    fields: LOGIN_PASSWORD,
  },
};

export const PROVIDER_LIST = Object.entries(PROVIDERS).map(([value, meta]) => ({
  value: value as CredentialProvider,
  label: meta.label,
}));

export function providerLabel(p: string): string {
  return PROVIDERS[p as CredentialProvider]?.label ?? p;
}

export function providerFields(p: string): CredentialField[] {
  return PROVIDERS[p as CredentialProvider]?.fields ?? PROVIDERS.OTHER.fields;
}

/** Champs "secret" à masquer par défaut à l'affichage. */
export function isSecretField(field: CredentialField): boolean {
  return field.type === "password";
}
