import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { BottomTabBar } from '@/components/bottom-tab-bar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="hidden md:flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="hidden md:flex" />
          <span className="font-semibold md:hidden">Northstar</span>
        </header>
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">{children}</main>
      </SidebarInset>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar />
    </SidebarProvider>
  );
}
