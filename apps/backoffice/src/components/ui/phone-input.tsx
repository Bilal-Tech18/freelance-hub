"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Indicatifs courants (francophone d'abord). value = indicatif.
const DIAL_CODES: { code: string; label: string; flag: string }[] = [
  { code: "+33", label: "France", flag: "🇫🇷" },
  { code: "+32", label: "Belgique", flag: "🇧🇪" },
  { code: "+41", label: "Suisse", flag: "🇨🇭" },
  { code: "+352", label: "Luxembourg", flag: "🇱🇺" },
  { code: "+1", label: "USA / Canada", flag: "🇺🇸" },
  { code: "+44", label: "Royaume-Uni", flag: "🇬🇧" },
  { code: "+212", label: "Maroc", flag: "🇲🇦" },
  { code: "+213", label: "Algérie", flag: "🇩🇿" },
  { code: "+216", label: "Tunisie", flag: "🇹🇳" },
  { code: "+49", label: "Allemagne", flag: "🇩🇪" },
  { code: "+34", label: "Espagne", flag: "🇪🇸" },
  { code: "+39", label: "Italie", flag: "🇮🇹" },
  { code: "+351", label: "Portugal", flag: "🇵🇹" },
];

function splitPhone(full: string | null | undefined): { code: string; number: string } {
  if (!full) return { code: "+33", number: "" };
  const match = DIAL_CODES.map((d) => d.code)
    .sort((a, b) => b.length - a.length)
    .find((c) => full.startsWith(c));
  if (match) return { code: match, number: full.slice(match.length).trim() };
  return { code: "+33", number: full };
}

export function PhoneInput({
  name = "phone",
  defaultValue,
  id,
}: {
  name?: string;
  defaultValue?: string | null;
  id?: string;
}) {
  const initial = useMemo(() => splitPhone(defaultValue), [defaultValue]);
  const [code, setCode] = useState(initial.code);
  const [number, setNumber] = useState(initial.number);

  const full = number.trim() ? `${code} ${number.trim()}` : "";

  return (
    <div className="flex gap-2">
      <input type="hidden" name={name} value={full} />
      <Select value={code} onValueChange={setCode}>
        <SelectTrigger className="w-[110px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIAL_CODES.map((d) => (
            <SelectItem key={d.code} value={d.code}>
              {d.flag} {d.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="6 12 34 56 78"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        className="flex-1"
      />
    </div>
  );
}
