import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

const alertVariants = cva('flex gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm', {
  variants: {
    variant: {
      info: 'border-[var(--border-default)] bg-[var(--info-soft)] text-[var(--fg-default)]',
      success: 'border-transparent bg-[var(--success-soft)] text-[var(--fg-default)]',
      warning: 'border-transparent bg-[var(--warning-soft)] text-[var(--fg-default)]',
      danger: 'border-transparent bg-[var(--danger-soft)] text-[var(--fg-default)]',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
} as const;

export type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    title?: string;
  };

export function Alert({
  className,
  variant = 'info',
  title,
  children,
  role,
  ...props
}: AlertProps): React.JSX.Element {
  const Icon = icons[variant ?? 'info'];
  const alertRole = role ?? (variant === 'danger' || variant === 'warning' ? 'alert' : 'status');
  return (
    <div className={cn(alertVariants({ variant, className }))} role={alertRole} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0 text-current opacity-80" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium leading-5">{title}</p> : null}
        {children ? <div className="leading-5 text-[var(--fg-muted)]">{children}</div> : null}
      </div>
    </div>
  );
}

export { alertVariants };
