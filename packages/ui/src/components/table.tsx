import * as React from 'react';

import { cn } from '../lib/utils';

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        'w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]',
        className,
      )}
    >
      <table className="w-full caption-bottom text-sm" {...props} />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return <thead className={cn('bg-[var(--bg-subtle)] [&_tr]:border-b', className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>): React.JSX.Element {
  return (
    <tr
      className={cn(
        'border-b border-[var(--border-default)] transition-colors hover:bg-[var(--bg-muted)] data-[state=selected]:bg-[var(--accent-soft)]',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <th
      className={cn(
        'h-11 px-3 text-left align-middle text-[13px] font-medium text-[var(--fg-muted)]',
        className,
      )}
      {...props}
    />
  );
}

export type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export function TableCell({ className, numeric, ...props }: TableCellProps): React.JSX.Element {
  return (
    <td
      className={cn(
        'h-12 px-3 align-middle text-[var(--fg-default)]',
        numeric && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>): React.JSX.Element {
  return <caption className={cn('mt-3 text-sm text-[var(--fg-muted)]', className)} {...props} />;
}
