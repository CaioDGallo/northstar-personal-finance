import { ExpenseForm } from '@/components/expense-form';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';

export async function FAB() {
  const [accounts, categories] = await Promise.all([getAccounts(), getCategories()]);

  return (
    <ExpenseForm
      accounts={accounts}
      categories={categories}
      trigger={
        <Button
          size="lg"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 shadow-lg"
          aria-label="Add expense"
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-6" />
        </Button>
      }
    />
  );
}
