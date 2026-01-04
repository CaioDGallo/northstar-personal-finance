import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { FAB } from '@/components/fab';
import { BottomTabBar } from '@/components/bottom-tab-bar';
import {
  getCachedAccounts,
  getCachedExpenseCategories,
  getCachedIncomeCategories
} from '@/lib/actions/cached-layout-data';
import { getCurrentUserId } from '@/lib/auth';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentUserId();

  const [accounts, expenseCategories, incomeCategories] = await Promise.all([
    getCachedAccounts(userId),
    getCachedExpenseCategories(userId),
    getCachedIncomeCategories(userId),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="hidden md:flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="hidden md:flex" />
          <span className="font-semibold md:hidden">Northstar</span>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">{children}</main>
      </SidebarInset>

      {/* Desktop FAB - hidden on mobile */}
      <div className="hidden md:block">
        <FAB
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
        />
      </div>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar
        accounts={accounts}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
      />
    </SidebarProvider>
  );
}
