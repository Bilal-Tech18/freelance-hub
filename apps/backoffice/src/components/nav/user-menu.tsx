"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

/** Pied de sidebar : identité + déconnexion, sur fond sombre. */
export function SidebarUserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();

  async function logout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="truncate text-xs text-emerald-100/60">{email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        title="Se déconnecter"
        className="shrink-0 text-emerald-100/70 hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
