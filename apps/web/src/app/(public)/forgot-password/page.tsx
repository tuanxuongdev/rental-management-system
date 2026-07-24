'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useT } from '@/i18n';

import { AuthApiError, forgotPasswordRequest } from '../../../lib/auth-api';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await forgotPasswordRequest(email);
      setMessage(t('auth.forgotPasswordSent'));
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : t('auth.requestFailed'));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <form className="bg-card space-y-4 rounded-lg border p-6 shadow-sm" onSubmit={onSubmit}>
        <h1 className="text-2xl font-semibold">{t('auth.forgotPasswordTitle')}</h1>
        <div className="space-y-2">
          <Label htmlFor="email">{t('common.email')}</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {message ? <p role="status">{message}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" className="w-full">
          {t('auth.sendResetLink')}
        </Button>
        <Link href="/login">{t('auth.backToSignIn')}</Link>
      </form>
    </main>
  );
}
