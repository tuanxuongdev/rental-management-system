import { AppShell } from '@/components/layouts/app-shell';

import type { ReactNode } from 'react';

export default function AuthenticatedLayout({ children }: { children: ReactNode }): ReactNode {
  return <AppShell>{children}</AppShell>;
}
