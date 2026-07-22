import { PlatformStatusPanel } from '@/features/platform';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform status',
  description: 'Development health and meta endpoint status for the empty vertical slice.',
};

export default function StatusPage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <PlatformStatusPanel />
    </main>
  );
}
