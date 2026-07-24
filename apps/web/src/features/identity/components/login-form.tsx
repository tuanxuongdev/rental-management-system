'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, Button, Input, Label } from '@rpm/ui';

import { useT } from '@/i18n';
import { AuthApiError, loginRequest } from '@/lib/auth-api';
import { useAuthStore } from '@/state/auth-store';

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setPendingMfa = useAuthStore((state) => state.setPendingMfa);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await loginRequest({
        email,
        password,
        organizationId: organizationId.trim().length > 0 ? organizationId.trim() : undefined,
      });

      if ('challengeId' in result) {
        setPendingMfa({
          challengeId: result.challengeId,
          loginTransactionId: result.loginTransactionId,
        });
        router.push('/mfa');
        return;
      }

      setPendingMfa(null);
      setAccessToken(result.accessToken);
      router.push(result.organization ? '/app' : '/onboarding/organization');
    } catch (caught) {
      const message = caught instanceof AuthApiError ? caught.message : t('auth.signInUnavailable');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">{t('common.email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('common.password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="organizationId">{t('auth.organizationIdOptional')}</Label>
        <Input
          id="organizationId"
          name="organizationId"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
      </div>
      {error ? (
        <Alert variant="danger" title={t('auth.signInFailed')}>
          {error}
        </Alert>
      ) : null}
      <Button className="w-full" type="submit" loading={loading}>
        {t('auth.signIn')}
      </Button>
    </form>
  );
}
