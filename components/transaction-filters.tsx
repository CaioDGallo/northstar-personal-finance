'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  SearchIcon,
  Cancel01Icon,
  FilterIcon,
} from '@hugeicons/core-free-icons';
import { addMonths } from '@/lib/utils';
import { ActiveFilterBadges } from '@/components/active-filter-badges';
import type { Account, Category } from '@/lib/schema';

type TransactionFiltersProps = {
  variant: 'expense' | 'income';
  accounts: Account[];
  categories: Category[];
  currentMonth: string;
  setSearchQuery: (query: string) => void;
};

export function TransactionFilters({
  variant,
  accounts,
  categories,
  currentMonth,
  setSearchQuery,
}: TransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('filters');
  const tTransaction = useTranslations(variant === 'expense' ? 'expenses' : 'income');

  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchValue);
    }, 200);

    return () => clearTimeout(timer);
  }, [localSearchValue, setSearchQuery]);

  // Clear search when month changes
  const prevMonthRef = useRef(currentMonth);
  useEffect(() => {
    if (prevMonthRef.current !== currentMonth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSearchValue('');
      setIsSearching(false);
      prevMonthRef.current = currentMonth;
    }
  }, [currentMonth]);

  function navigateMonth(direction: -1 | 1) {
    const newMonth = addMonths(currentMonth, direction);
    const params = new URLSearchParams(searchParams);
    params.set('month', newMonth);
    const route = variant === 'expense' ? '/expenses' : '/income';
    router.push(`${route}?${params.toString()}`);
  }

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const route = variant === 'expense' ? '/expenses' : '/income';
    router.push(`${route}?${params.toString()}`);
  }

  function handleSearchOpen() {
    setIsSearching(true);
  }

  function handleSearchClose() {
    setIsSearching(false);
    setLocalSearchValue('');
  }

  const [year, month] = currentMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString(locale, {
    month: 'long',
    year: 'numeric',
  });

  // Get active filter data for badges
  const categoryId = searchParams.get('category');
  const accountId = searchParams.get('account');
  const statusValue = searchParams.get('status');

  const activeCategory = categoryId
    ? categories.find((c) => c.id.toString() === categoryId) || null
    : null;
  const activeAccount = accountId
    ? accounts.find((a) => a.id.toString() === accountId) || null
    : null;
  const activeStatus =
    statusValue && statusValue !== 'all'
      ? {
        value: statusValue,
        label:
          statusValue === 'pending'
            ? tTransaction('pending')
            : variant === 'expense'
              ? tTransaction('paid')
              : tTransaction('received'),
      }
      : null;

  const hasActiveFilters = Boolean(activeCategory || activeAccount || activeStatus);

  const statusOptions =
    variant === 'expense'
      ? [
        { value: 'pending', label: tTransaction('pending') },
        { value: 'paid', label: tTransaction('paid') },
      ]
      : [
        { value: 'pending', label: tTransaction('pending') },
        { value: 'received', label: tTransaction('received') },
      ];

  return (
    <div className="mb-6 space-y-3">
      {/* Row 1: Month picker + Search + Filter toggle */}
      <div className="flex items-center justify-between">
        {isSearching ? (
          // Search mode
          <div className="flex w-full items-center gap-2">
            <Button onClick={handleSearchClose} variant="hollow" size="icon" className="touch-manipulation" aria-label="Cancelar busca">
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
            <Input
              type="text"
              placeholder={tTransaction('searchPlaceholder')}
              value={localSearchValue}
              onChange={(e) => setLocalSearchValue(e.target.value)}
              className="flex-1"
              autoFocus={typeof window !== 'undefined' && window.innerWidth >= 768}
              spellCheck={false}
            />
          </div>
        ) : (
          // Month picker mode
          <>
            <div className="flex items-center gap-3">
              <Button onClick={() => navigateMonth(-1)} variant="hollow" size="icon" className="touch-manipulation" aria-label="Mês anterior">
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
              </Button>
              <span className="min-w-48 text-center text-lg font-medium capitalize">
                {monthName}
              </span>
              <Button onClick={() => navigateMonth(1)} variant="hollow" size="icon" className="touch-manipulation" aria-label="Próximo mês">
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button onClick={handleSearchOpen} variant="hollow" size="icon" className="touch-manipulation" aria-label="Pesquisar">
                <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
              </Button>
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                variant="hollow"
                size="icon"
                className={`touch-manipulation ${hasActiveFilters ? 'text-primary' : ''}`}
                aria-label={isExpanded ? 'Fechar filtros' : 'Abrir filtros'}
                aria-expanded={isExpanded}
              >
                <HugeiconsIcon icon={FilterIcon} strokeWidth={2} />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Row 2: Collapsible filter selects - VERTICAL LAYOUT */}
      {isExpanded && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <Label className="shrink-0 text-sm">{t('category')}</Label>
            <Select
              value={searchParams.get('category') || 'all'}
              onValueChange={(value) => updateFilter('category', value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="shrink-0 text-sm">{t('account')}</Label>
            <Select
              value={searchParams.get('account') || 'all'}
              onValueChange={(value) => updateFilter('account', value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('allAccounts')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allAccounts')}</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="shrink-0 text-sm">{t('status')}</Label>
            <Select
              value={searchParams.get('status') || 'all'}
              onValueChange={(value) => updateFilter('status', value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t('allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatus')}</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Row 3: Active filter badges (only shown when filters active) */}
      {hasActiveFilters && (
        <ActiveFilterBadges
          category={activeCategory ? { id: activeCategory.id, name: activeCategory.name } : null}
          account={activeAccount ? { id: activeAccount.id, name: activeAccount.name } : null}
          status={activeStatus}
          onClearCategory={() => updateFilter('category', 'all')}
          onClearAccount={() => updateFilter('account', 'all')}
          onClearStatus={() => updateFilter('status', 'all')}
        />
      )}
    </div>
  );
}
