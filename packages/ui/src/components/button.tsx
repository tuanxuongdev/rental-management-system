import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-medium transition-[color,background-color,border-color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:shadow-focus-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--shadow-xs)] hover:opacity-90 active:scale-[0.98]',
        primary:
          'bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--shadow-xs)] hover:opacity-90 active:scale-[0.98]',
        secondary:
          'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)] hover:bg-[var(--bg-muted)] hover:border-[var(--border-strong)]',
        outline:
          'border border-[var(--border-default)] bg-transparent text-[var(--fg-default)] hover:bg-[var(--bg-muted)]',
        ghost: 'bg-transparent text-[var(--fg-default)] hover:bg-[var(--bg-muted)]',
        danger:
          'bg-[var(--danger)] text-[var(--fg-inverse)] shadow-[var(--shadow-xs)] hover:bg-[var(--danger-700,#b91c1c)]',
        destructive:
          'bg-[var(--danger)] text-[var(--fg-inverse)] shadow-[var(--shadow-xs)] hover:bg-[var(--danger-700,#b91c1c)]',
        link: 'h-auto rounded-none bg-transparent p-0 text-[var(--accent)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-3.5',
        lg: 'h-10 px-4 font-medium',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
