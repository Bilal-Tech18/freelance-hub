"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Bell, FolderKanban, Lock, Ticket, type LucideIcon } from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/projects", label: "Mes projets", icon: FolderKanban },
  { href: "/tickets", label: "Mes tickets", icon: Ticket },
  { href: "/vault", label: "Mes accès", icon: Lock },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

/** Navigation verticale de l'espace client (sidebar desktop + tiroir mobile). */
export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
              active
                ? "bg-white/10 text-white font-medium"
                : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-emerald-300" : "text-emerald-200/60"
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
