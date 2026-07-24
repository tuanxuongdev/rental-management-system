'use client';

import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useParallelComparison } from '../hooks/use-reconciliation';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, canMutate } from '../utils/permissions';

export function ComparisonsWorkspace(): React.JSX.Element {
  const meQuery = useMe();
  const compareMutation = useParallelComparison();
  const canPerform = canMutate(meQuery.data, FINANCE_PERMISSIONS.reconciliationPerform);
  const [billingRunId, setBillingRunId] = useState('');
  const [sourceAmount, setSourceAmount] = useState('0.0000');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState<string | null>(null);

  if (!canPerform) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to run parallel comparisons.
      </p>
    );
  }

  async function onCompare(): Promise<void> {
    setError(null);
    try {
      await compareMutation.mutateAsync({
        billingRunId: billingRunId.trim(),
        sourceTotals: [{ label: 'approved-source', amount: sourceAmount.trim(), currency }],
      });
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Comparison failed.');
    }
  }

  const result = compareMutation.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Parallel billing comparison</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="billingRunId">Billing run ID</Label>
          <Input
            id="billingRunId"
            value={billingRunId}
            onChange={(e) => setBillingRunId(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sourceAmount">Source total</Label>
          <Input
            id="sourceAmount"
            value={sourceAmount}
            onChange={(e) => setSourceAmount(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
          />
        </div>
        <Button type="button" onClick={() => void onCompare()}>
          Compare
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="space-y-2 text-sm">
          <p>
            Billing total {formatMoney(result.billingTotal, result.currency)} · Within tolerance:{' '}
            {result.withinTolerance ? 'yes' : 'no'}
          </p>
          <ul>
            {result.variances.map((row) => (
              <li key={row.label}>
                {row.label}: variance {formatMoney(row.varianceAmount, row.currency)} (
                {row.withinTolerance ? 'ok' : 'exception'})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
