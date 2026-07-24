'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../lib/utils';

import { Button } from './button';

const sizeClass = {
  sm: 'max-w-[400px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[900px]',
} as const;

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof sizeClass;
  /** When true, Esc / overlay click do not close (e.g. destructive confirm). */
  preventDismiss?: boolean;
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  preventDismiss = false,
}: ModalProps): React.JSX.Element | null {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !preventDismiss) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange, preventDismiss]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[rgba(15,23,42,0.45)]"
        onClick={() => {
          if (!preventDismiss) {
            onOpenChange(false);
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative z-10 flex max-h-[min(90vh,800px)] w-full flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface-raised)] shadow-[var(--shadow-lg)]',
          sizeClass[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-base font-semibold leading-6">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-[var(--fg-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {!preventDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <X />
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
