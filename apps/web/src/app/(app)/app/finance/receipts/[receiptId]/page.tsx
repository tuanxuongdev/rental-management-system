'use client';

import { useParams } from 'next/navigation';

import { ReceiptDetail } from '@/features/finance';

export default function ReceiptDetailPage(): React.JSX.Element {
  const params = useParams<{ receiptId: string }>();
  return <ReceiptDetail receiptId={params.receiptId} />;
}
