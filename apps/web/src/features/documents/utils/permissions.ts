import { PERMISSION_KEYS } from '@rpm/contracts';

export { hasPermission, canMutate } from '@/features/admin/utils/permissions';

export const DOCUMENT_PERMISSIONS = {
  list: PERMISSION_KEYS.DOCUMENTS_LIST,
  view: PERMISSION_KEYS.DOCUMENTS_VIEW,
  upload: PERMISSION_KEYS.DOCUMENTS_UPLOAD,
  delete: PERMISSION_KEYS.DOCUMENTS_DELETE,
} as const;
