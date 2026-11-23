"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronRight,
  FileText,
  FolderKanban,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogIn,
  PiggyBank,
  Settings,
  ShieldCheck,
  Ticket,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type Group = { title?: string; items: Item[] };

const GROUPS: Group[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/calendar", label: "Calendrier", icon: CalendarDays },
    ],
  },
  {
    title: "Clients & projets",
    items: [
      { href: "/admin/tickets", label: "Tickets", icon: Ticket },
      { href: "/admin/projects", label: "Projets", icon: FolderKanban },
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/vault", label: "Vault", icon: Lock },
    ],
  },
  {
    title: "Pilotage",
    items: [
      { href: "/admin/time", label: "Suivi du temps", icon: Timer },
      { href: "/admin/monitoring", label: "Monitoring", icon: Activity },
      { href: "/admin/connections", label: "Connexions", icon: LogIn },
    ],
  },
  {
    title: "Facturation",
    items: [
      { href: "/admin/documents", label: "Factures & devis", icon: FileText },
      { href: "/admin/finance", label: "CA & impôts", icon: PiggyBank },
      { href: "/admin/referrers", label: "Apporteurs", icon: Handshake },
    ],
  },
  {
    title: "Réglages",
    items: [
      { href: "/admin/settings/api-keys", label: "API keys", icon: KeyRound },
      { href: "/admin/settings/billing", label: "Réglages", icon: Settings },
      { href: "/admin/settings/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/settings/security", label: "Sécurité", icon: ShieldCheck },
    ],
  },
];

const isActive = (pathname: string, { href, exact }: Item) =>
  exact ? pathname === href : pathname.startsWith(href);

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        active ? "bg-white/10 text-white font-medium" : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-emerald-300" : "text-emerald-200/60")} />
      {item.label}
    </Link>
  );
}

/**
 * Groupes repliables : celui de la page courante s'ouvre par défaut, chaque clic
 * ouvre ou referme (choix gardé tant que la sidebar reste montée).
 */
export function AdminNav() {
  const pathname = usePathname();
  const [choices, setChoices] = useState<Record<string, boolean>>({});

  return (
    <nav className="flex-1 space-y-3 px-3 py-2">
      {GROUPS.map((group, gi) => {
        const current = group.items.some((item) => isActive(pathname, item));
        const open = !group.title || (choices[group.title] ?? current);
        return (
          <div key={gi} className="space-y-0.5">
            {group.title && (
              <button
                type="button"
                onClick={() => setChoices((c) => ({ ...c, [group.title!]: !open }))}
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-md px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300/50 hover:text-emerald-200"
              >
                {group.title}
                <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
              </button>
            )}
            {open &&
              group.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
              ))}
          </div>
        );
      })}
    </nav>
  );
}
