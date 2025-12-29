'use client';

import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/icon-picker';
import { markEntryPaid, markEntryPending, deleteExpense } from '@/lib/actions/expenses';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon } from '@hugeicons/core-free-icons';

type ExpenseCardProps = {
  entry: {
    id: number;
    amount: number;
    dueDate: string;
    paidAt: string | null;
    installmentNumber: number;
    transactionId: number;
    description: string;
    totalInstallments: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  };
};

export function ExpenseCard({ entry }: ExpenseCardProps) {
  const isPaid = !!entry.paidAt;

  const handleMarkPaid = async () => {
    await markEntryPaid(entry.id);
  };

  const handleMarkPending = async () => {
    await markEntryPending(entry.id);
  };

  const handleDelete = async () => {
    await deleteExpense(entry.transactionId);
  };

  return (
    <Card className="relative">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-4">
          {/* Category icon */}
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: entry.categoryColor }}
          >
            <CategoryIcon icon={entry.categoryIcon} />
          </div>

          {/* Details */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{entry.description}</h3>
              {entry.totalInstallments > 1 && (
                <Badge variant="secondary">
                  {entry.installmentNumber}/{entry.totalInstallments}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span>{entry.categoryName}</span>
              <span>•</span>
              <span>{entry.accountName}</span>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-semibold">{formatCurrency(entry.amount)}</div>
            <div className="text-sm text-gray-500">
              {new Date(entry.dueDate).toLocaleDateString('pt-BR')}
            </div>
            <div className="mt-1">
              <Badge
                variant={isPaid ? 'default' : 'outline'}
                className={isPaid ? 'bg-green-100 text-green-800' : ''}
              >
                {isPaid ? 'Paid' : 'Pending'}
              </Badge>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isPaid ? (
                <DropdownMenuItem onClick={handleMarkPending}>
                  Mark as Pending
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleMarkPaid}>
                  Mark as Paid
                </DropdownMenuItem>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    Delete Transaction
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all {entry.totalInstallments} installment
                      {entry.totalInstallments > 1 ? 's' : ''} for &quot;{entry.description}&quot;.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
