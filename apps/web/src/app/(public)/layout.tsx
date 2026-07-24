import { PublicHeader } from '@/components/layouts/public-header';

import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <PublicHeader />
      <div className="max-w-form mx-auto flex w-full flex-col px-6 py-12">{children}</div>
    </div>
  );
}
