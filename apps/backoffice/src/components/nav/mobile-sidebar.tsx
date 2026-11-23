"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Tiroir plein écran pour la navigation sur mobile (hamburger).
 * Se referme automatiquement à chaque changement de page.
 */
export function MobileSidebar({
  brand,
  children,
  className,
}: {
  brand: React.ReactNode;
  children: React.ReactNode;
  /** Permet de surcharger le fond (ex. espace maintenance thémé). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden -ml-2"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className={cn(
          "data-[side=left]:w-full data-[side=left]:sm:max-w-none gap-0 border-r-0 p-0 text-sidebar-foreground bg-[linear-gradient(180deg,#0a1f18,#0f3b2c)] [&_[data-slot=sheet-close]]:text-white/70 [&_[data-slot=sheet-close]]:hover:text-white",
          className
        )}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex items-center gap-2 px-4 py-3.5">{brand}</div>
        <div className="flex flex-1 flex-col overflow-y-auto scrollbar-none">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
