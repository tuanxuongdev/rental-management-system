'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Input, Label } from '@rpm/ui';

const loginSkeletonSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginSkeletonValues = z.infer<typeof loginSkeletonSchema>;

/**
 * Authentication UI skeleton only.
 * Does not call an API, store tokens, or establish a session.
 */
export default function LoginPage(): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSkeletonValues>({
    resolver: zodResolver(loginSkeletonSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (_values) => {
    // Intentionally empty — real auth arrives in later sprints.
    await Promise.resolve();
  });

  return (
    <div className="border-border bg-card space-y-6 rounded-lg border p-6 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Skeleton form. No authentication is performed.
        </p>
      </div>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" {...register('email')} />
          {errors.email ? <p className="text-destructive text-sm">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-destructive text-sm">{errors.password.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Continue
        </Button>
      </form>
      <p className="text-muted-foreground text-center text-sm">
        <Link href="/" className="underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
