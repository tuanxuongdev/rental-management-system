'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { AuthApiError, loginRequest } from '../../../lib/auth-api';
import { useAuthStore } from '../../../state/auth-store';

export function LoginForm() {
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
      const message =
        caught instanceof AuthApiError
          ? caught.message
          : 'Unable to sign in right now. Try again later.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
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
        <Label htmlFor="password">Password</Label>
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
        <Label htmlFor="organizationId">Organization ID (optional)</Label>
        <Input
          id="organizationId"
          name="organizationId"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
