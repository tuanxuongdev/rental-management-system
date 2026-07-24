import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const cardVariants = cva(
  'rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]',
  {
    variants: {
      variant: {
        default: 'shadow-[var(--shadow-xs)]',
        surface: 'shadow-[var(--shadow-xs)]',
        interactive:
          'shadow-[var(--shadow-xs)] transition-shadow hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)] focus-within:shadow-focus-ring',
        metric: 'p-5 shadow-[var(--shadow-xs)]',
        exception: 'border-l-4 border-l-[var(--warning)] shadow-[var(--shadow-xs)]',
        flat: 'shadow-none',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-5',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  },
);

export type CardProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, padding, ...props }: CardProps): React.JSX.Element {
  return <div className={cn(cardVariants({ variant, padding, className }))} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h3 className={cn('text-base font-semibold leading-6 tracking-tight', className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-sm text-[var(--fg-muted)]', className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn(className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        'mt-4 flex items-center justify-end gap-2 border-t border-[var(--border-default)] pt-4',
        className,
      )}
      {...props}
    />
  );
}

export { cardVariants };
