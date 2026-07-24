import { Inbox } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      <div className="mb-4 text-[var(--fg-muted)]">
        {icon ?? <Inbox className="size-8" strokeWidth={1.75} aria-hidden />}
      </div>
      <h3 className="text-base font-semibold leading-6 text-[var(--fg-default)]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-5 text-[var(--fg-muted)]">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
