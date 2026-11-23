import { db } from "@/lib/db";
import { requireMaintainer } from "@/lib/authz";
import { buildMaintenanceThemeCss, parsePalette } from "@/lib/palette";
import { MaintenanceNav } from "@/components/nav/maintenance-nav";
import { DesktopSidebar } from "@/components/nav/desktop-sidebar";
import { MobileSidebar } from "@/components/nav/mobile-sidebar";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { SidebarUserMenu } from "@/components/nav/user-menu";

function Brand({ color }: { color: string }) {
  return (
    <>
      <div
        className="flex size-7 items-center justify-center rounded-md text-sm font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${color}, #00000055)` }}
      >
        M
      </div>
      <span className="font-semibold text-sm text-white">Maintenance</span>
    </>
  );
}

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireMaintainer();
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { palette: true },
  });
  const palette = parsePalette(dbUser?.palette);
  const brand = <Brand color={palette.c2} />;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Palette perso : surcharge les variables du thème sur tout l'espace
          (style global, mais ce layout n'est rendu que sous /maintenance). */}
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: buildMaintenanceThemeCss(palette) }}
      />
      <DesktopSidebar brand={brand} className="bg-sidebar bg-none">
        <div className="flex flex-1 flex-col overflow-y-auto scrollbar-none">
          <MaintenanceNav />
        </div>
        <SidebarUserMenu name={user.name} email={user.email} />
      </DesktopSidebar>
      <div className="flex flex-1 flex-col min-w-0 bg-background">
        <header className="flex h-14 shrink-0 items-center gap-1 border-b px-4 md:hidden">
          <MobileSidebar brand={brand} className="bg-sidebar bg-none">
            <MaintenanceNav />
            <SidebarUserMenu name={user.name} email={user.email} />
          </MobileSidebar>
          <span className="font-semibold">Maintenance</span>
          <ThemeToggle className="ml-auto size-9 rounded-md hover:bg-accent hover:text-accent-foreground" />
        </header>
        <main className="flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
      </div>
    </div>
  );
}
