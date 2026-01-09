import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { TokenMatch } from './types';

const tokenVariants = cva(
  'inline-flex items-center rounded-md px-1.5 py-0.5 text-sm font-medium transition-colors',
  {
    variants: {
      tokenType: {
        prefix: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
        date: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        duration: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
        priority: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
        text: '', // Plain text, no styling
      },
      isPartial: {
        true: 'border border-dashed opacity-70',
        false: '',
      },
      priority: {
        critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
        none: '',
      },
    },
    defaultVariants: {
      tokenType: 'text',
      isPartial: false,
      priority: 'none',
    },
  }
);

interface InputTokenProps extends VariantProps<typeof tokenVariants> {
  token: TokenMatch;
  className?: string;
}

export function InputToken({ token, className }: InputTokenProps) {
  // Determine priority level for priority tokens
  const priorityLevel = token.type === 'priority' && typeof token.value === 'string'
    ? (token.value as 'critical' | 'high' | 'medium' | 'low')
    : 'none';

  return (
    <span
      className={cn(
        tokenVariants({
          tokenType: token.type,
          isPartial: token.isPartial,
          priority: priorityLevel,
        }),
        className
      )}
      data-token-type={token.type}
      data-start={token.start}
      data-end={token.end}
    >
      {token.text}
    </span>
  );
}
