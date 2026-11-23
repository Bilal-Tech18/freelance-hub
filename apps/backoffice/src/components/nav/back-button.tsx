"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Flèche "retour". Si `href` est fourni, va vers le parent ; sinon retour
 * historique. Placer en haut des pages de détail / formulaire.
 */
export function BackButton({
  href,
  label = "Retour",
}: {
  href?: string;
  label?: string;
}) {
  const router = useRouter();
  const className =
    "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1";

  if (href) {
    return (
      <Link href={href} className={className}>
        <ChevronLeft className="size-4" />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => router.back()} className={className}>
      <ChevronLeft className="size-4" />
      {label}
    </button>
  );
}
