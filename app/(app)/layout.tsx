import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AppSidebar } from '@/components/app-sidebar';
import { BillReminderBanner } from '@/components/bill-reminder-banner';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { BottomTabBar } from '@/components/bottom-tab-bar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="hidden md:flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="hidden md:flex" />
          <span className="font-semibold md:hidden">fluxo.sh</span>
        </header>
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          <BillReminderBanner />
          {children}
        </main>
      </SidebarInset>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar />
    </SidebarProvider>
  );
}
