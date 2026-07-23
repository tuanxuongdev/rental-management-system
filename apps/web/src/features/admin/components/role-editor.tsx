'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { AuthApiError } from '@/lib/auth-api';

import { useMe } from '../hooks/use-me';
import { useCreateRole, usePatchRole, usePermissionsCatalog, useRole } from '../hooks/use-roles';
import {
  ADMIN_PERMISSIONS,
  canMutate,
  hasDangerousPermissionCombination,
  SOD_WARNING_TEXT,
} from '../utils/permissions';

type RoleEditorProps = {
  mode: 'create' | 'edit';
  roleId?: string;
};

export function RoleEditor({ mode, roleId }: RoleEditorProps): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const permissionsQuery = usePermissionsCatalog();
  const roleQuery = useRole(roleId ?? '');
  const createRole = useCreateRole();
  const patchRole = usePatchRole(roleId ?? '');

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const isEdit = mode === 'edit';
  const canCreate = canMutate(meQuery.data, ADMIN_PERMISSIONS.rolesCreate);
  const canUpdate = canMutate(meQuery.data, ADMIN_PERMISSIONS.rolesUpdate);
  const canSubmit = isEdit ? canUpdate : canCreate;

  useEffect(() => {
    if (isEdit && roleQuery.data) {
      setKey(roleQuery.data.key);
      setName(roleQuery.data.name);
      setDescription(roleQuery.data.description ?? '');
      setSelectedKeys(roleQuery.data.permissionKeys ?? []);
    }
  }, [isEdit, roleQuery.data]);

  const sodWarning = useMemo(
    () => (hasDangerousPermissionCombination(selectedKeys) ? SOD_WARNING_TEXT : null),
    [selectedKeys],
  );

  const permissions = permissionsQuery.data?.data ?? [];
  const isSystemRole = Boolean(roleQuery.data?.isSystem);
  const readOnly = isSystemRole || !canSubmit;

  if (meQuery.isLoading || permissionsQuery.isLoading || (isEdit && roleQuery.isLoading)) {
    return <p className="text-muted-foreground text-sm">Loading role editor…</p>;
  }

  if (isEdit && roleQuery.isError) {
    const message =
      roleQuery.error instanceof AuthApiError ? roleQuery.error.message : 'Role not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  if (!canSubmit && !isSystemRole) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to {isEdit ? 'update' : 'create'} roles.
      </p>
    );
  }

  function togglePermission(permissionKey: string, disabled: boolean): void {
    if (disabled || readOnly) {
      return;
    }
    setSelectedKeys((current) =>
      current.includes(permissionKey)
        ? current.filter((item) => item !== permissionKey)
        : [...current, permissionKey],
    );
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setWarnings([]);

    if (selectedKeys.length === 0) {
      setError('Select at least one permission.');
      return;
    }

    try {
      if (isEdit && roleId && roleQuery.data) {
        const result = await patchRole.mutateAsync({
          body: {
            name,
            description: description.trim().length > 0 ? description : null,
            permissionKeys: selectedKeys,
          },
          version: roleQuery.data.version,
        });
        setWarnings(result.warnings ?? []);
        router.push('/app/admin/roles');
        return;
      }

      const result = await createRole.mutateAsync({
        key,
        name,
        description: description.trim().length > 0 ? description : undefined,
        permissionKeys: selectedKeys,
      });
      setWarnings(result.warnings ?? []);
      router.push(`/app/admin/roles/${result.id}`);
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to save role.');
    }
  }

  const pending = createRole.isPending || patchRole.isPending;

  return (
    <form
      className="mx-auto max-w-2xl space-y-6"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
      {isSystemRole ? (
        <p className="text-muted-foreground text-sm" role="status">
          System roles are read-only. Clone by creating a custom role with the permissions you need.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="role-key">Key</Label>
        <Input
          id="role-key"
          required={!isEdit}
          disabled={isEdit || readOnly}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="custom_role_key"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-name">Name</Label>
        <Input
          id="role-name"
          required
          disabled={readOnly}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-description">Description</Label>
        <Input
          id="role-description"
          disabled={readOnly}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Permissions</legend>
        <ul className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
          {permissions.map((permission) => {
            const disabled =
              readOnly ||
              permission.isPlatform ||
              permission.isOwnerOnly ||
              !permission.assignable ||
              !meQuery.data?.permissionKeys.includes(permission.key);
            return (
              <li key={permission.id} className="flex items-start gap-2">
                <input
                  id={`perm-${permission.id}`}
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={selectedKeys.includes(permission.key)}
                  disabled={disabled}
                  onChange={() => togglePermission(permission.key, disabled)}
                />
                <Label htmlFor={`perm-${permission.id}`} className="font-normal">
                  <span className="font-mono text-xs">{permission.key}</span>
                  <span className="text-muted-foreground block text-xs">
                    {permission.description}
                    {permission.isPlatform || permission.isOwnerOnly
                      ? ' (not assignable to custom roles)'
                      : null}
                  </span>
                </Label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {sodWarning ? (
        <p className="text-sm text-amber-700" role="alert">
          {sodWarning}
        </p>
      ) : null}

      {warnings.map((warning) => (
        <p key={warning} className="text-sm text-amber-700" role="alert">
          {warning}
        </p>
      ))}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save role' : 'Create role'}
        </Button>
      ) : null}
    </form>
  );
}
