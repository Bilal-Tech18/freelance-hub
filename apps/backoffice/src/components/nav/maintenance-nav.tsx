"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Lock,
  Settings,
  Ticket,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const ITEMS: Item[] = [
  { href: "/maintenance", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/maintenance/tickets", label: "Tickets", icon: Ticket },
  { href: "/maintenance/vault", label: "Vault", icon: Lock },
  { href: "/maintenance/settings", label: "Paramètres", icon: Settings },
];

export function MaintenanceNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-white/10 text-white font-medium"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-white/50")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
