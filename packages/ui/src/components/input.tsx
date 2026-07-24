import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const inputVariants = cva(
  'flex w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--fg-default)] shadow-[var(--shadow-xs)] transition-colors placeholder:text-[var(--fg-subtle)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium',
  {
    variants: {
      inputSize: {
        sm: 'h-8 text-[13px]',
        md: 'h-9',
        lg: 'h-10',
      },
      invalid: {
        true: 'border-[var(--danger)] focus-visible:shadow-[0_0_0_2px_var(--bg-surface),0_0_0_4px_var(--danger)]',
        false: '',
      },
    },
    defaultVariants: {
      inputSize: 'md',
      invalid: false,
    },
  },
);

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> &
  VariantProps<typeof inputVariants>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type = 'text', inputSize, invalid, 'aria-invalid': ariaInvalid, ...props },
    ref,
  ) => {
    const isInvalid = Boolean(invalid) || ariaInvalid === true || ariaInvalid === 'true';
    return (
      <input
        type={type}
        className={cn(inputVariants({ inputSize, invalid: isInvalid, className }))}
        ref={ref}
        aria-invalid={isInvalid || undefined}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { inputVariants };
