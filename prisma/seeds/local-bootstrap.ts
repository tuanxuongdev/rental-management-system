/**
 * Local-only bootstrap user for development.
 *
 * Creates (idempotent) a verified LOCAL credential user so you can log in at
 * http://localhost:3000/login and create an Organization via onboarding.
 *
 * Usage (from repo root, after migrate):
 *   pnpm seed:local-bootstrap
 *
 * Defaults (override with env):
 *   LOCAL_BOOTSTRAP_EMAIL=owner@localhost.dev
 *   LOCAL_BOOTSTRAP_PASSWORD=LocalDevPassword123!
 *
 * Does not create Organizations, leases, or money data.
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function main(): Promise<void> {
  const email = (process.env.LOCAL_BOOTSTRAP_EMAIL ?? 'owner@localhost.dev').trim().toLowerCase();
  const password = process.env.LOCAL_BOOTSTRAP_PASSWORD ?? 'LocalDevPassword123!';

  if (password.length < 12) {
    throw new Error('LOCAL_BOOTSTRAP_PASSWORD must be at least 12 characters');
  }

  const existing = await prisma.user.findUnique({
    where: { normalizedEmail: email },
  });

  if (existing !== null) {
    console.log(
      JSON.stringify({
        ok: true,
        skipped: true,
        email,
        userId: existing.id,
        message:
          'Bootstrap user already exists — use login, then /onboarding/organization if needed.',
      }),
    );
    return;
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);
  const user = await prisma.user.create({
    data: {
      email,
      normalizedEmail: email,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      credentials: {
        create: { provider: 'LOCAL', passwordHash },
      },
    },
  });

  console.log(
    JSON.stringify({
      ok: true,
      created: true,
      email,
      userId: user.id,
      passwordHint: 'See LOCAL_BOOTSTRAP_PASSWORD / docs/local-development.md',
      next: 'Start API (RBAC seeds on boot), login, create Organization at /onboarding/organization',
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
