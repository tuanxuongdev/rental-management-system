import * as React from 'react';

import { cn } from '../lib/utils';

export type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & {
  label?: string;
};

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, id, checked, defaultChecked, onChange, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const switchId = id ?? generatedId;
    const [internal, setInternal] = React.useState(Boolean(defaultChecked));
    const isControlled = checked !== undefined;
    const on = isControlled ? Boolean(checked) : internal;

    return (
      <label
        className={cn(
          'inline-flex cursor-pointer items-center gap-2',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
        htmlFor={switchId}
      >
        <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={isControlled ? checked : undefined}
            defaultChecked={defaultChecked}
            disabled={disabled}
            aria-checked={on}
            onChange={(event) => {
              if (!isControlled) {
                setInternal(event.target.checked);
              }
              onChange?.(event);
            }}
            {...props}
          />
          <span
            aria-hidden
            className={cn(
              'absolute inset-0 rounded-full transition-colors',
              on ? 'bg-[var(--primary)]' : 'bg-[var(--neutral-300)]',
            )}
          />
          <span
            aria-hidden
            className={cn(
              'absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform',
              on && 'translate-x-4',
            )}
          />
        </span>
        {label ? <span className="text-sm text-[var(--fg-default)]">{label}</span> : null}
      </label>
    );
  },
);
Switch.displayName = 'Switch';
