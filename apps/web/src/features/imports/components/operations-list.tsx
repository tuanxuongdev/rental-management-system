'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useOperations } from '../hooks/use-operations';
import { IMPORT_PERMISSIONS, hasPermission } from '../utils/permissions';

function formatCounts(counts: Record<string, number> | undefined): string {
  if (!counts) {
    return '—';
  }
  const parts = Object.entries(counts)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `${key}: ${value}`);
  return parts.length > 0 ? parts.join(', ') : '—';
}

export function OperationsList(): React.JSX.Element {
  const meQuery = useMe();
  const operationsQuery = useOperations({ limit: 50 });
  const canView = hasPermission(meQuery.data, IMPORT_PERMISSIONS.operationsRead);

  if (meQuery.isLoading || operationsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading operations…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view operations.
      </p>
    );
  }

  if (operationsQuery.isError) {
    const message =
      operationsQuery.error instanceof AuthApiError
        ? operationsQuery.error.message
        : 'Unable to load operations.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const jobs = operationsQuery.data?.data ?? [];

  if (jobs.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">No import or export jobs yet.</p>
        {hasPermission(meQuery.data, IMPORT_PERMISSIONS.importsInventory) ? (
          <p className="text-muted-foreground text-sm">
            Start from{' '}
            <Link href="/app/admin/imports" className="underline-offset-4 hover:underline">
              Admin → Imports
            </Link>
            .
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Refreshing every few seconds while this page is open.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-border border-b">
              <th className="px-2 py-2 font-medium">Kind</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Counts</th>
              <th className="px-2 py-2 font-medium">Created</th>
              <th className="px-2 py-2 font-medium">Updated</th>
              <th className="px-2 py-2 font-medium">Id</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-border border-b">
                <td className="px-2 py-2">{job.kind}</td>
                <td className="px-2 py-2">{job.type}</td>
                <td className="px-2 py-2">{job.status}</td>
                <td className="px-2 py-2 text-xs">{formatCounts(job.counts)}</td>
                <td className="px-2 py-2">{new Date(job.createdAt).toLocaleString()}</td>
                <td className="px-2 py-2">{new Date(job.updatedAt).toLocaleString()}</td>
                <td className="px-2 py-2 font-mono text-xs">{job.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
