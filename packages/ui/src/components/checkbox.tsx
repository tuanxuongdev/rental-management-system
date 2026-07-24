import * as React from 'react';

import { cn } from '../lib/utils';

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'focus-visible:shadow-focus-ring size-4 shrink-0 rounded-[var(--radius-xs)] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--primary)] accent-[var(--primary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = 'Checkbox';
