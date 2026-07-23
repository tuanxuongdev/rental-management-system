'use client';

import { useParams } from 'next/navigation';

import { ManagementAgreementDetail } from '@/features/parties';

export default function PortfolioAgreementDetailPage(): React.JSX.Element {
  const params = useParams<{ agreementId: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Management agreement</h1>
        <p className="text-muted-foreground text-sm">Agreement detail, activate, and terminate.</p>
      </div>
      <ManagementAgreementDetail agreementId={params.agreementId} />
    </div>
  );
}
