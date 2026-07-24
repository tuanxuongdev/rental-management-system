import { LeaseMoveIn } from '@/features/leasing';

export default async function LeaseMoveInPage({
  params,
}: {
  params: Promise<{ leaseId: string }>;
}): Promise<React.JSX.Element> {
  const { leaseId } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Move-in</h1>
      <LeaseMoveIn leaseId={leaseId} />
    </div>
  );
}
