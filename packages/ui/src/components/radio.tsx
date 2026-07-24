import * as React from 'react';

import { cn } from '../lib/utils';

export type RadioProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="radio"
        className={cn(
          'focus-visible:shadow-focus-ring size-4 shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] accent-[var(--primary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Radio.displayName = 'Radio';

export type RadioGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical';
};

export function RadioGroup({
  className,
  orientation = 'vertical',
  ...props
}: RadioGroupProps): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      className={cn(
        'flex gap-3',
        orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap items-center',
        className,
      )}
      {...props}
    />
  );
}
