'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { formatFaturaMonth } from '@/lib/fatura-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { CreditCardIcon } from '@hugeicons/core-free-icons';
import { FaturaDetailSheet } from '@/components/fatura-detail-sheet';
import type { Account } from '@/lib/schema';

type FaturaCardProps = {
  fatura: {
    id: number;
    accountId: number;
    accountName: string;
    yearMonth: string;
    totalAmount: number;
    dueDate: string;
    paidAt: string | null;
    paidFromAccountId: number | null;
  };
  checkingAccounts: Account[];
};

export function FaturaCard({ fatura, checkingAccounts }: FaturaCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const isPaid = !!fatura.paidAt;
  const isOverdue = !fatura.paidAt && new Date(fatura.dueDate) < new Date();

  const status = isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending';

  // Icon color based on status
  const iconColor = status === 'paid'
    ? '#10b981' // green-500
    : status === 'overdue'
    ? '#ef4444' // red-500
    : '#6b7280'; // gray-500

  // Badge styling based on status
  const badgeVariant = status === 'paid' ? 'default' : 'secondary';
  const badgeClass = cn(
    status === 'paid' && 'bg-green-100 text-green-700 border-green-300',
    status === 'overdue' && 'bg-red-100 text-red-700 border-red-300'
  );

  return (
    <>
      <Card
        className={cn(
          "py-0 cursor-pointer transition-all hover:shadow-md",
          status === 'overdue' && 'border-red-300'
        )}
        onClick={() => setDetailOpen(true)}
      >
        <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
          {/* Credit card icon */}
          <div
            className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: iconColor }}
          >
            <HugeiconsIcon icon={CreditCardIcon} strokeWidth={2} size={20} />
          </div>

          {/* Fatura month + due date */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate capitalize">
              {formatFaturaMonth(fatura.yearMonth)}
            </h3>
            <p className="text-xs text-gray-500">
              Vence: {formatDate(fatura.dueDate)}
            </p>
          </div>

          {/* Amount */}
          <div className="text-sm font-semibold shrink-0">
            {formatCurrency(fatura.totalAmount)}
          </div>

          {/* Status badge */}
          <Badge variant={badgeVariant} className={cn('shrink-0', badgeClass)}>
            {status === 'paid' ? 'Paga' : status === 'overdue' ? 'Vencida' : 'Pendente'}
          </Badge>
        </CardContent>
      </Card>

      <FaturaDetailSheet
        faturaId={fatura.id}
        accountName={fatura.accountName}
        yearMonth={fatura.yearMonth}
        checkingAccounts={checkingAccounts}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
