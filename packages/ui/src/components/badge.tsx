import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-2 py-0.5 text-[12px] font-medium leading-4',
  {
    variants: {
      variant: {
        neutral: 'bg-[var(--bg-subtle)] text-[var(--fg-muted)]',
        info: 'bg-[var(--info-soft)] text-[var(--info-700,#1d4ed8)]',
        success: 'bg-[var(--success-soft)] text-[var(--success-700)]',
        warning: 'bg-[var(--warning-soft)] text-[var(--warning-700)]',
        danger: 'bg-[var(--danger-soft)] text-[var(--danger-700)]',
        accent: 'bg-[var(--accent-soft)] text-[var(--accent-fg)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    dot?: boolean;
  };

export function Badge({
  className,
  variant,
  dot,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };
