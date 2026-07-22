import Link from 'next/link';

import { LoginForm } from '../../../features/identity/components/login-form';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="bg-card space-y-6 rounded-lg border p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Access your Organization workspace securely.
          </p>
        </div>
        <LoginForm />
        <div className="flex flex-col gap-2 text-sm">
          <Link className="text-primary underline-offset-4 hover:underline" href="/forgot-password">
            Forgot password
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/verify-email">
            Verify email
          </Link>
        </div>
      </div>
    </main>
  );
}
