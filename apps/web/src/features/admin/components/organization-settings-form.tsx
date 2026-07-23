'use client';

import { useEffect, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { AuthApiError } from '@/lib/auth-api';

import { useMe } from '../hooks/use-me';
import {
  useOrganizationSettings,
  usePatchOrganizationSettings,
} from '../hooks/use-organization-settings';
import { ADMIN_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function OrganizationSettingsForm(): React.JSX.Element {
  const meQuery = useMe();
  const settingsQuery = useOrganizationSettings();
  const patchSettings = usePatchOrganizationSettings();

  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [defaultLocale, setDefaultLocale] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canView = hasPermission(meQuery.data, ADMIN_PERMISSIONS.organizationProfileView);
  const canUpdate = canMutate(meQuery.data, ADMIN_PERMISSIONS.organizationProfileUpdate);

  useEffect(() => {
    if (settingsQuery.data) {
      setDisplayName(settingsQuery.data.displayName);
      setLegalName(settingsQuery.data.legalName);
      setDefaultLocale(settingsQuery.data.defaultLocale);
      setTimeZone(settingsQuery.data.timeZone);
    }
  }, [settingsQuery.data]);

  if (meQuery.isLoading || settingsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading settings…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view Organization settings.
      </p>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    const message =
      settingsQuery.error instanceof AuthApiError
        ? settingsQuery.error.message
        : 'Unable to load settings.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canUpdate || !settingsQuery.data) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await patchSettings.mutateAsync({
        body: {
          displayName,
          legalName,
          defaultLocale,
          timeZone,
        },
        version: settingsQuery.data.version,
      });
      setSuccess('Settings saved.');
    } catch (caught) {
      setError(
        caught instanceof AuthApiError ? caught.message : 'Unable to save Organization settings.',
      );
    }
  }

  return (
    <form
      className="mx-auto max-w-lg space-y-4"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          required
          disabled={!canUpdate || patchSettings.isPending}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="legalName">Legal name</Label>
        <Input
          id="legalName"
          required
          disabled={!canUpdate || patchSettings.isPending}
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultLocale">Default locale</Label>
        <Input
          id="defaultLocale"
          required
          disabled={!canUpdate || patchSettings.isPending}
          value={defaultLocale}
          onChange={(event) => setDefaultLocale(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="timeZone">Time zone</Label>
        <Input
          id="timeZone"
          required
          disabled={!canUpdate || patchSettings.isPending}
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultCurrency">Default currency</Label>
        <Input id="defaultCurrency" disabled value={settingsQuery.data.defaultCurrency} readOnly />
        <p className="text-muted-foreground text-xs">Currency is not editable in this sprint.</p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-700" role="status">
          {success}
        </p>
      ) : null}

      {canUpdate ? (
        <Button type="submit" disabled={patchSettings.isPending}>
          {patchSettings.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      ) : null}
    </form>
  );
}
