"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Ligne de tableau entièrement cliquable qui navigue vers `href`. */
export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <TableRow
      onClick={() => router.push(href)}
      className={cn("cursor-pointer hover:bg-muted/50", className)}
    >
      {children}
    </TableRow>
  );
}
