'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Label } from '@rpm/ui';

import { AuthApiError, switchOrganizationRequest } from '@/lib/auth-api';
import { useAuthStore } from '@/state/auth-store';

import { meQueryKey, useMe } from '../hooks/use-me';

export function OrganizationSwitcher(): React.JSX.Element | null {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const switchingOrganization = useAuthStore((state) => state.switchingOrganization);
  const setSwitchingOrganization = useAuthStore((state) => state.setSwitchingOrganization);
  const meQuery = useMe();
  const [error, setError] = useState<string | null>(null);

  const memberships = meQuery.data?.memberships ?? [];
  const activeOrganizationId = meQuery.data?.organization?.id;

  if (memberships.length <= 1) {
    return null;
  }

  async function onSwitch(organizationId: string): Promise<void> {
    if (!accessToken || organizationId === activeOrganizationId || switchingOrganization) {
      return;
    }

    setError(null);
    setSwitchingOrganization(true);

    try {
      await queryClient.cancelQueries();
      queryClient.clear();

      const result = await switchOrganizationRequest(accessToken, { organizationId });
      setAccessToken(result.accessToken);

      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      await queryClient.refetchQueries({ queryKey: meQueryKey });

      router.push('/app');
    } catch (caught) {
      const message =
        caught instanceof AuthApiError
          ? caught.message
          : 'Unable to switch Organization. Try again.';
      setError(message);
    } finally {
      setSwitchingOrganization(false);
    }
  }

  return (
    <div className="space-y-1 px-3 pb-3">
      <Label htmlFor="organization-switcher" className="text-muted-foreground text-xs">
        Organization
      </Label>
      <select
        id="organization-switcher"
        className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
        value={activeOrganizationId ?? ''}
        disabled={switchingOrganization}
        onChange={(event) => {
          void onSwitch(event.target.value);
        }}
      >
        {memberships.map((membership) => (
          <option key={membership.id} value={membership.organizationId}>
            {membership.organizationDisplayName}
          </option>
        ))}
      </select>
      {switchingOrganization ? (
        <p className="text-muted-foreground text-xs">Switching Organization…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
