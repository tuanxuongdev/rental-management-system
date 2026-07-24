'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useT } from '@/i18n';

import { AuthApiError, verifyEmailRequest } from '../../../lib/auth-api';

function VerifyEmailForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const tokenFromUrl = params.get('token') ?? '';
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await verifyEmailRequest(token, password.length > 0 ? password : undefined);
      router.push('/login');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : t('auth.verificationFailed'));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <form className="bg-card space-y-4 rounded-lg border p-6 shadow-sm" onSubmit={onSubmit}>
        <h1 className="text-2xl font-semibold">{t('auth.verifyEmailTitle')}</h1>
        <div className="space-y-2">
          <Label htmlFor="token">{t('auth.verificationToken')}</Label>
          <Input
            id="token"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.setPasswordNewAccounts')}</Label>
          <Input
            id="password"
            type="password"
            minLength={12}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" className="w-full">
          {t('auth.verifyEmail')}
        </Button>
      </form>
    </main>
  );
}

function VerifyEmailFallback() {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-8">
      <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
