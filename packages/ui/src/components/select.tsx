import * as React from 'react';

import { cn } from '../lib/utils';

export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  invalid?: boolean;
  selectSize?: 'sm' | 'md' | 'lg';
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, selectSize = 'md', children, ...props }, ref) => {
    const height = selectSize === 'sm' ? 'h-8 text-[13px]' : selectSize === 'lg' ? 'h-10' : 'h-9';
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'focus-visible:shadow-focus-ring w-full appearance-none rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-9 text-sm text-[var(--fg-default)] shadow-[var(--shadow-xs)] hover:border-[var(--border-strong)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          height,
          invalid &&
            'border-[var(--danger)] focus-visible:shadow-[0_0_0_2px_var(--bg-surface),0_0_0_4px_var(--danger)]',
          className,
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        }}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';
