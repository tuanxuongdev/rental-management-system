import { LeaseMoveOut } from '@/features/leasing';

export default async function LeaseMoveOutPage({
  params,
}: {
  params: Promise<{ leaseId: string }>;
}): Promise<React.JSX.Element> {
  const { leaseId } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Move-out</h1>
      <LeaseMoveOut leaseId={leaseId} />
    </div>
  );
}
