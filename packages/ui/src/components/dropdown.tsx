'use client';

import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

import { Button } from './button';

export type DropdownItem = {
  id: string;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
};

export type DropdownProps = {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  label?: string;
};

export function Dropdown({
  trigger,
  items,
  align = 'end',
  label = 'Open menu',
}: DropdownProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </Button>
      {open ? (
        <ul
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[180px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-raised)] p-1 shadow-[var(--shadow-md)]',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) =>
            item.separator ? (
              <li key={item.id} role="separator" className="my-1 h-px bg-[var(--border-default)]" />
            ) : (
              <li key={item.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cn(
                    'focus-visible:shadow-focus-ring flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm hover:bg-[var(--bg-muted)] focus-visible:outline-none disabled:opacity-40',
                    item.danger && 'text-[var(--danger)]',
                  )}
                  onClick={() => {
                    item.onSelect?.();
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Decorative check icon for selected menu rows. */
export function DropdownCheck({ visible }: { visible: boolean }): React.JSX.Element | null {
  if (!visible) {
    return <span className="size-4" />;
  }
  return <Check className="size-4" aria-hidden />;
}
