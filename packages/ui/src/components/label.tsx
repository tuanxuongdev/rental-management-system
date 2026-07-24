import * as React from 'react';

import { cn } from '../lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps): React.JSX.Element {
  return (
    <label
      className={cn(
        'text-[13px] font-medium leading-[18px] text-[var(--fg-default)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
