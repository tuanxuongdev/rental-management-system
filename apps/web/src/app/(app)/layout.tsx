import { AppShell } from '@/components/layouts/app-shell';
import { AuthGuard } from '@/features/identity/components/auth-guard';

import type { ReactNode } from 'react';

export default function AuthenticatedLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
