'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { AuthApiError, completeMfaChallenge } from '../../../lib/auth-api';
import { useAuthStore } from '../../../state/auth-store';

function MfaChallengeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const challengeId = params.get('challengeId') ?? '';
  const loginTransactionId = params.get('loginTransactionId') ?? '';
  const [proof, setProof] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await completeMfaChallenge({
        challengeId,
        loginTransactionId,
        method: 'TOTP',
        proof,
      });
      setAccessToken(result.accessToken);
      router.push(result.organization ? '/app' : '/onboarding/organization');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Verification failed.');
    }
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
            value={proof}
            onChange={(event) => setProof(event.target.value)}
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" className="w-full">
          Verify
        </Button>
      </form>
    </main>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-8">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </main>
      }
    >
      <MfaChallengeForm />
    </Suspense>
  );
}
