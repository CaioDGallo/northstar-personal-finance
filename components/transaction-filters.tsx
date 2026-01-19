'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
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
  SearchIcon,
  Cancel01Icon,
  FilterIcon,
} from '@hugeicons/core-free-icons';
import { ActiveFilterBadges } from '@/components/active-filter-badges';
import type { Account, Category } from '@/lib/schema';

type TransactionFiltersProps = {
  variant: 'expense' | 'income';
  accounts: Account[];
  categories: Category[];
  setSearchQuery: (query: string) => void;
  categoryFilter: string;
  accountFilter: string;
  statusFilter: string;
  onCategoryChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  currentMonth: string;
};

export function TransactionFilters({
  variant,
  accounts,
  categories,
  setSearchQuery,
  categoryFilter,
  accountFilter,
  statusFilter,
  onCategoryChange,
  onAccountChange,
  onStatusChange,
  currentMonth,
}: TransactionFiltersProps) {
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

  function updateFilter(key: string, value: string) {
    const normalizedValue = value && value !== 'all' ? value : 'all';
    if (key === 'category') {
      onCategoryChange(normalizedValue);
    } else if (key === 'account') {
      onAccountChange(normalizedValue);
    } else if (key === 'status') {
      onStatusChange(normalizedValue);
    }
  }

  function handleSearchOpen() {
    setIsSearching(true);
  }

  function handleSearchClose() {
    setIsSearching(false);
    setLocalSearchValue('');
  }

  // Get active filter data for badges
  const activeCategory =
    categoryFilter && categoryFilter !== 'all'
      ? categories.find((c) => c.id.toString() === categoryFilter) || null
      : null;
  const activeAccount =
    accountFilter && accountFilter !== 'all'
      ? accounts.find((a) => a.id.toString() === accountFilter) || null
      : null;
  const activeStatus =
    statusFilter && statusFilter !== 'all'
      ? {
        value: statusFilter,
        label:
          statusFilter === 'pending'
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
      {/* Row 1: Search + Filter toggle */}
      <div className="flex items-center justify-end gap-1">
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
          // Filter mode
          <>
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
          </>
        )}
      </div>

      {/* Row 2: Collapsible filter selects - VERTICAL LAYOUT */}
      {isExpanded && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <Label className="shrink-0 text-sm">{t('category')}</Label>
            <Select
              value={categoryFilter || 'all'}
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
              value={accountFilter || 'all'}
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
              value={statusFilter || 'all'}
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
