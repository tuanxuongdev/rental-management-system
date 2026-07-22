'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { AuthApiError, completeMfaChallenge } from '../../../lib/auth-api';
import { useAuthStore } from '../../../state/auth-store';

export default function MfaChallengePage() {
  const router = useRouter();
  const pendingMfa = useAuthStore((state) => state.pendingMfa);
  const setPendingMfa = useAuthStore((state) => state.setPendingMfa);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const [proof, setProof] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingMfa === null) {
      router.replace('/login');
    }
  }, [pendingMfa, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pendingMfa === null) {
      return;
    }

    try {
      const result = await completeMfaChallenge({
        challengeId: pendingMfa.challengeId,
        loginTransactionId: pendingMfa.loginTransactionId,
        method: 'TOTP',
        proof,
      });
      setPendingMfa(null);
      setAccessToken(result.accessToken);
      router.push(result.organization ? '/app' : '/onboarding/organization');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Verification failed.');
    }
  }

  if (pendingMfa === null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-8">
        <p className="text-muted-foreground text-sm">Redirecting to sign in…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <form className="bg-card space-y-4 rounded-lg border p-6 shadow-sm" onSubmit={onSubmit}>
        <h1 className="text-2xl font-semibold">Multi-factor authentication</h1>
        <div className="space-y-2">
          <Label htmlFor="proof">Authentication code</Label>
          <Input
            id="proof"
            inputMode="numeric"
            required
            autoComplete="one-time-code"
            value={proof}
            onChange={(event) => setProof(event.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full">
          Verify
        </Button>
      </form>
    </main>
  );
}
