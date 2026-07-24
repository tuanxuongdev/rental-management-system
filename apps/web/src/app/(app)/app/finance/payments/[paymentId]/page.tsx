'use client';

import { useParams } from 'next/navigation';

import { PaymentDetail } from '@/features/finance';

export default function PaymentDetailPage(): React.JSX.Element {
  const params = useParams<{ paymentId: string }>();
  return <PaymentDetail paymentId={params.paymentId} />;
}
