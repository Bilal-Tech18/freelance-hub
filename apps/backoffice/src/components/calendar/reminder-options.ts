// Délais de rappel proposés (jours avant l'occurrence) ; "none" = aucun rappel.
export const REMINDERS: { value: string; label: string }[] = [
  { value: "none", label: "Aucun rappel" },
  { value: "0", label: "Le jour même" },
  { value: "1", label: "La veille" },
  { value: "3", label: "3 jours avant" },
  { value: "7", label: "1 semaine avant" },
  { value: "30", label: "1 mois avant" },
];
