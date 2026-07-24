'use client';

import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@rpm/ui';

import { LoginForm } from '@/features/identity/components/login-form';
import { useT } from '@/i18n';

export default function LoginPage() {
  const t = useT();

  return (
    <main className="flex flex-col justify-center">
      <Card padding="lg" className="shadow-sm">
        <CardHeader className="mb-6 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {t('auth.signInTitle')}
          </CardTitle>
          <CardDescription>{t('auth.signInDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginForm />
          <div className="flex flex-col gap-2 text-sm">
            <Link
              className="text-[var(--accent)] underline-offset-4 hover:underline"
              href="/forgot-password"
            >
              {t('auth.forgotPassword')}
            </Link>
            <Link
              className="text-[var(--accent)] underline-offset-4 hover:underline"
              href="/verify-email"
            >
              {t('auth.verifyEmail')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
