import { IMPORT_PERMISSION_KEYS, PERMISSION_KEYS } from '@rpm/contracts';

export { hasPermission, canMutate } from '@/features/admin/utils/permissions';

export const IMPORT_PERMISSIONS = {
  importsInventory: IMPORT_PERMISSION_KEYS.IMPORTS_INVENTORY,
  exportsInventory: IMPORT_PERMISSION_KEYS.EXPORTS_INVENTORY,
  operationsRead: IMPORT_PERMISSION_KEYS.OPERATIONS_READ,
  unitsUpdate: PERMISSION_KEYS.UNITS_UPDATE,
} as const;
