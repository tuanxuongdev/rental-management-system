import { AlertCircle } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

export type ErrorStateProps = {
  title?: string;
  description?: string;
  reference?: string;
  action?: React.ReactNode;
  className?: string;
};

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again. If the problem continues, contact support with the reference below.',
  reference,
  action,
  className,
}: ErrorStateProps): React.JSX.Element {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
      role="alert"
    >
      <AlertCircle className="mb-4 size-8 text-[var(--danger)]" strokeWidth={1.75} aria-hidden />
      <h3 className="text-base font-semibold leading-6 text-[var(--fg-default)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-5 text-[var(--fg-muted)]">{description}</p>
      {reference ? (
        <p className="mt-3 font-mono text-[12px] text-[var(--fg-subtle)]">Ref: {reference}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
