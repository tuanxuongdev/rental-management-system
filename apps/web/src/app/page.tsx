import Link from 'next/link';

export default function HomePage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-muted-foreground text-sm font-medium">Rental Property Management</p>
      <h1 className="text-foreground text-4xl font-semibold tracking-tight">Foundation ready</h1>
      <p className="text-muted-foreground max-w-xl text-base">
        Sprint-01 delivery foundation: monorepo, health endpoints, observability baseline, and a
        traced web-to-API vertical slice. Business domains arrive in later sprints.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/status"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium"
        >
          Platform status
        </Link>
        <Link
          href="/app"
          className="border-input bg-background hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          App shell placeholder
        </Link>
      </div>
    </main>
  );
}
