'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

export type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom';
};

export function Tooltip({ content, children, side = 'top' }: TooltipProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {React.cloneElement(children, {
        'aria-describedby': open ? id : undefined,
      } as Record<string, unknown>)}
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-[var(--radius-sm)] bg-[var(--neutral-900)] px-2 py-1 text-[12px] leading-4 text-white shadow-[var(--shadow-md)]',
            side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
