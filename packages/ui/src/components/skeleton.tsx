import * as React from 'react';

import { cn } from '../lib/utils';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  rounded?: 'sm' | 'md' | 'lg' | 'full';
};

export function Skeleton({
  className,
  rounded = 'sm',
  ...props
}: SkeletonProps): React.JSX.Element {
  const radius =
    rounded === 'full'
      ? 'rounded-full'
      : rounded === 'lg'
        ? 'rounded-[var(--radius-lg)]'
        : rounded === 'md'
          ? 'rounded-[var(--radius-md)]'
          : 'rounded-[var(--radius-sm)]';

  return (
    <div
      className={cn('animate-pulse bg-[var(--bg-subtle)]', radius, className)}
      aria-hidden
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3 w-full', index === lines - 1 && lines > 1 ? 'w-2/3' : undefined)}
        />
      ))}
    </div>
  );
}
