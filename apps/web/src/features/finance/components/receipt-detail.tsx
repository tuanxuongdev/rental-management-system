'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useReceipt } from '../hooks/use-payments';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, hasPermission } from '../utils/permissions';

type ReceiptDetailProps = {
  receiptId: string;
};

export function ReceiptDetail({ receiptId }: ReceiptDetailProps): React.JSX.Element {
  const meQuery = useMe();
  const receiptQuery = useReceipt(receiptId);
  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.paymentsView);

  if (meQuery.isLoading || receiptQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading receipt…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view receipts.
      </p>
    );
  }

  if (receiptQuery.isError || !receiptQuery.data) {
    const message =
      receiptQuery.error instanceof AuthApiError
        ? receiptQuery.error.message
        : 'Unable to load receipt.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const receipt = receiptQuery.data;

  return (
    <div className="mx-auto max-w-lg space-y-4 print:max-w-none">
      <Link
        href={`/app/finance/payments/${receipt.paymentTransactionId}`}
        className="text-muted-foreground text-sm underline print:hidden"
      >
        Back to payment
      </Link>
      <header className="border-border space-y-1 border-b pb-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">Payment receipt</p>
        <h1 className="text-2xl font-semibold tracking-tight">{receipt.receiptNumber}</h1>
        <p className="text-sm">
          Issued {new Date(receipt.issuedAt).toLocaleString()} ·{' '}
          {formatMoney(receipt.amount, receipt.currency)}
        </p>
      </header>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Receipt ID</dt>
          <dd className="font-mono text-xs">{receipt.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payment</dt>
          <dd>
            <Link
              href={`/app/finance/payments/${receipt.paymentTransactionId}`}
              className="font-mono text-xs underline print:no-underline"
            >
              {receipt.paymentTransactionId}
            </Link>
          </dd>
        </div>
      </dl>
      <ButtonPrint />
    </div>
  );
}

function ButtonPrint(): React.JSX.Element {
  return (
    <button
      type="button"
      className="border-border bg-background rounded-md border px-3 py-2 text-sm print:hidden"
      onClick={() => window.print()}
    >
      Print / save PDF
    </button>
  );
}
