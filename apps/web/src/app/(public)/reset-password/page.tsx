'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useT } from '@/i18n';

import { AuthApiError, resetPasswordRequest } from '../../../lib/auth-api';

function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await resetPasswordRequest(token, newPassword);
      router.push('/login');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : t('auth.resetFailed'));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <form className="bg-card space-y-4 rounded-lg border p-6 shadow-sm" onSubmit={onSubmit}>
        <h1 className="text-2xl font-semibold">{t('auth.resetPasswordTitle')}</h1>
        <div className="space-y-2">
          <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
          <Input
            id="newPassword"
            type="password"
            minLength={12}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" className="w-full">
          {t('auth.updatePassword')}
        </Button>
      </form>
    </main>
  );
}

function ResetPasswordFallback() {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-8">
      <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
