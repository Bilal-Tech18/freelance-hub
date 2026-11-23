import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { SidebarUserMenu } from "@/components/nav/user-menu";
import { PortalNav } from "@/components/nav/portal-nav";
import { MobileSidebar } from "@/components/nav/mobile-sidebar";

function Brand() {
  return (
    <>
      <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-700 text-emerald-950 text-sm font-bold">
        B
      </div>
      <span className="font-semibold text-sm text-white">Espace client</span>
    </>
  );
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Le portail est l'espace client : un mainteneur a le sien.
  if (user.role === "MAINTAINER") redirect("/maintenance");

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden md:flex w-60 shrink-0 flex-col text-sidebar-foreground bg-[linear-gradient(180deg,#0a1f18,#0f3b2c)]">
        <div className="flex items-center gap-2 px-4 py-3.5">
          <Brand />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto scrollbar-none">
          <PortalNav />
        </div>
        <SidebarUserMenu name={user.name} email={user.email} />
      </aside>
      <div className="flex flex-1 flex-col min-w-0 bg-background">
        <header className="flex h-14 shrink-0 items-center gap-1 border-b px-4 md:hidden">
          <MobileSidebar brand={<Brand />}>
            <PortalNav />
            <SidebarUserMenu name={user.name} email={user.email} />
          </MobileSidebar>
          <span className="font-semibold">Espace client</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-7">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
