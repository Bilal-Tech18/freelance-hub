import { db } from "@/lib/db";
import { requireMaintainer } from "@/lib/authz";
import { parsePalette } from "@/lib/palette";
import { PaletteForm } from "@/components/settings/palette-form";

export const metadata = { title: "Paramètres" };

export default async function MaintenanceSettingsPage() {
  const user = await requireMaintainer();
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { palette: true },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Connectée en tant que {user.name} ({user.email}).
        </p>
      </div>
      <PaletteForm palette={parsePalette(dbUser?.palette)} />
    </div>
  );
}
