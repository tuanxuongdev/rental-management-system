import { LeaseRenew } from '@/features/leasing';

export default async function LeaseRenewPage({
  params,
}: {
  params: Promise<{ leaseId: string }>;
}): Promise<React.JSX.Element> {
  const { leaseId } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Renew lease</h1>
      <LeaseRenew leaseId={leaseId} />
    </div>
  );
}
