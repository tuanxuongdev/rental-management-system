import { AppProviders } from '@/app/providers';
import { ThemeScript } from '@/components/theme/theme-script';
import { LocaleScript } from '@/i18n';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Rental Property Management',
  description: 'Multi-tenant rental property management platform',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <LocaleScript />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
