import { requireAdmin } from "@/lib/authz";
import { AdminNav } from "@/components/nav/admin-nav";
import { DesktopSidebar } from "@/components/nav/desktop-sidebar";
import {
  GlobalSearch,
  GlobalSearchIconButton,
  GlobalSearchTrigger,
} from "@/components/nav/global-search";
import { MobileSidebar } from "@/components/nav/mobile-sidebar";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { SidebarUserMenu } from "@/components/nav/user-menu";

function Brand() {
  return (
    <>
      <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-700 text-emerald-950 text-sm font-bold">
        B
      </div>
      <span className="font-semibold text-sm text-white">Back Office</span>
    </>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="flex h-full overflow-hidden">
      <DesktopSidebar brand={<Brand />}>
        <GlobalSearchTrigger />
        <div className="flex flex-1 flex-col overflow-y-auto scrollbar-none">
          <AdminNav />
        </div>
        <SidebarUserMenu name={user.name} email={user.email} />
      </DesktopSidebar>
      <div className="flex flex-1 flex-col min-w-0 bg-background">
        <header className="flex h-14 shrink-0 items-center gap-1 border-b px-4 md:hidden">
          <MobileSidebar brand={<Brand />}>
            <AdminNav />
            <SidebarUserMenu name={user.name} email={user.email} />
          </MobileSidebar>
          <span className="font-semibold">Back Office</span>
          <GlobalSearchIconButton />
          <ThemeToggle className="size-9 rounded-md hover:bg-accent hover:text-accent-foreground" />
        </header>
        <main className="flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
        <GlobalSearch />
      </div>
    </div>
  );
}
