import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';
export const REQUIRED_ANY_PERMISSIONS_KEY = 'required_any_permissions';

/** Deny-by-default: handler requires ALL listed permission keys. */
export const RequirePermissions = (...permissions: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/** Handler requires at least ONE of the listed permission keys. */
export const RequireAnyPermissions = (...permissions: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);
