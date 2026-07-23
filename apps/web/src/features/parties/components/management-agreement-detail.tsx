'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import {
  AGREEMENT_NON_AUTHORIZING_BANNER,
  PORTFOLIO_PERMISSIONS,
  canMutate,
  hasPermission,
} from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';

import {
  useActivateManagementAgreement,
  useManagementAgreement,
  useTerminateManagementAgreement,
} from '../hooks/use-management-agreements';

export function ManagementAgreementDetail({
  agreementId,
}: {
  agreementId: string;
}): React.JSX.Element {
  const meQuery = useMe();
  const agreementQuery = useManagementAgreement(agreementId);
  const activateAgreement = useActivateManagementAgreement(agreementId);
  const terminateAgreement = useTerminateManagementAgreement(agreementId);
  const [terminateTo, setTerminateTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.managementAgreementsView);
  const canActivate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.managementAgreementsActivate);
  const canTerminate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.managementAgreementsTerminate);

  if (meQuery.isLoading || agreementQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading agreement…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this agreement.
      </p>
    );
  }

  if (agreementQuery.isError || !agreementQuery.data) {
    const message =
      agreementQuery.error instanceof AuthApiError
        ? agreementQuery.error.message
        : 'Agreement not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const agreement = agreementQuery.data;

  async function onActivate(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      await activateAgreement.mutateAsync({ version: agreement.version });
      setSuccess('Agreement activated.');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to activate agreement.');
    }
  }

  async function onTerminate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await terminateAgreement.mutateAsync({
        body: {
          effectiveTo: new Date(terminateTo).toISOString(),
          reason,
        },
        version: agreement.version,
      });
      setSuccess('Agreement terminated.');
      setReason('');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to terminate agreement.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm" role="note">
        {AGREEMENT_NON_AUTHORIZING_BANNER}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{agreement.agreementNumber}</h2>
          <p className="text-muted-foreground text-sm">Status: {agreement.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/portfolio/properties/${agreement.propertyId}`}
            className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Property
          </Link>
          {canActivate ? (
            <Button onClick={() => void onActivate()} disabled={activateAgreement.isPending}>
              Activate
            </Button>
          ) : null}
        </div>
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

      <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Effective from</dt>
          <dd>{agreement.effectiveFrom}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Effective to</dt>
          <dd>{agreement.effectiveTo ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Grants login access</dt>
          <dd>{agreement.grantsLoginAccess ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Notes</dt>
          <dd>{agreement.notes ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Version</dt>
          <dd>{agreement.version}</dd>
        </div>
      </dl>

      {canTerminate ? (
        <form className="max-w-md space-y-3" onSubmit={(event) => void onTerminate(event)}>
          <h3 className="text-sm font-semibold">Terminate agreement</h3>
          <div className="space-y-1">
            <Label htmlFor="effectiveTo">Effective to</Label>
            <Input
              id="effectiveTo"
              type="datetime-local"
              value={terminateTo}
              onChange={(event) => setTerminateTo(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="terminateReason">Reason (required)</Label>
            <Input
              id="terminateReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            variant="destructive"
            disabled={terminateAgreement.isPending || !reason.trim()}
          >
            {terminateAgreement.isPending ? 'Terminating…' : 'Terminate'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
