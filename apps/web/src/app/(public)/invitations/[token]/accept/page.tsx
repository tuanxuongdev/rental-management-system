'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { AuthApiError, acceptInvitationRequest, loginRequest } from '@/lib/auth-api';
import { useAuthStore } from '@/state/auth-store';

export default function InvitationAcceptPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [needsLogin] = useState(!accessToken);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAccept(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let activeToken = accessToken;

      if (needsLogin) {
        const loginResult = await loginRequest({ email, password });
        if ('challengeId' in loginResult) {
          setError(
            'Multi-factor authentication is required. Sign in first, then return to this link.',
          );
          return;
        }
        activeToken = loginResult.accessToken;
        setAccessToken(activeToken);
      }

      if (!activeToken) {
        setError('Sign in is required to accept this invitation.');
        return;
      }

      const result = (await acceptInvitationRequest(
        token,
        { displayName: displayName.length > 0 ? displayName : undefined },
        activeToken,
      )) as { accessToken?: string };

      if (result.accessToken) {
        setAccessToken(result.accessToken);
      }

      router.push('/app');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to accept invitation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <form className="bg-card space-y-4 rounded-lg border p-6 shadow-sm" onSubmit={onAccept}>
        <h1 className="text-2xl font-semibold">Accept invitation</h1>
        <p className="text-muted-foreground text-sm">
          Sign in with the invited email address to join the Organization.
        </p>
        {needsLogin ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name (optional)</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Accepting…' : 'Accept invitation'}
        </Button>
        <Link className="text-primary text-sm underline-offset-4 hover:underline" href="/login">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
