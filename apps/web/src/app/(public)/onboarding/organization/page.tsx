'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { AuthApiError, createOrganizationRequest } from '../../../../lib/auth-api';
import { useAuthStore } from '../../../../state/auth-store';

export default function OrganizationSetupPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      router.push('/login');
      return;
    }

    try {
      const result = await createOrganizationRequest(accessToken, { displayName });
      setAccessToken(result.accessToken);
      router.push('/app');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to create Organization.');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <form className="bg-card space-y-4 rounded-lg border p-6 shadow-sm" onSubmit={onSubmit}>
        <h1 className="text-2xl font-semibold">Create your Organization</h1>
        <div className="space-y-2">
          <Label htmlFor="displayName">Organization name</Label>
          <Input
            id="displayName"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
    </main>
  );
}
