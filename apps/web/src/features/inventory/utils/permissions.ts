import { PERMISSION_KEYS } from '@rpm/contracts';

export { hasPermission, canMutate } from '@/features/admin/utils/permissions';

export const PORTFOLIO_PERMISSIONS = {
  propertiesList: PERMISSION_KEYS.PROPERTIES_LIST,
  propertiesView: PERMISSION_KEYS.PROPERTIES_VIEW,
  propertiesCreate: PERMISSION_KEYS.PROPERTIES_CREATE,
  propertiesUpdate: PERMISSION_KEYS.PROPERTIES_UPDATE,
  propertiesArchive: PERMISSION_KEYS.PROPERTIES_ARCHIVE,
  unitsList: PERMISSION_KEYS.UNITS_LIST,
  unitsView: PERMISSION_KEYS.UNITS_VIEW,
  unitsCreate: PERMISSION_KEYS.UNITS_CREATE,
  unitsUpdate: PERMISSION_KEYS.UNITS_UPDATE,
  unitsArchive: PERMISSION_KEYS.UNITS_ARCHIVE,
  bedsList: PERMISSION_KEYS.BEDS_LIST,
  bedsView: PERMISSION_KEYS.BEDS_VIEW,
  bedsCreate: PERMISSION_KEYS.BEDS_CREATE,
  bedsUpdate: PERMISSION_KEYS.BEDS_UPDATE,
  bedsArchive: PERMISSION_KEYS.BEDS_ARCHIVE,
  occupancyView: PERMISSION_KEYS.OCCUPANCY_VIEW,
  propertyOwnersList: PERMISSION_KEYS.PROPERTY_OWNERS_LIST,
  propertyOwnersView: PERMISSION_KEYS.PROPERTY_OWNERS_VIEW,
  propertyOwnersCreate: PERMISSION_KEYS.PROPERTY_OWNERS_CREATE,
  propertyOwnersUpdate: PERMISSION_KEYS.PROPERTY_OWNERS_UPDATE,
  propertyOwnershipsView: PERMISSION_KEYS.PROPERTY_OWNERSHIPS_VIEW,
  propertyOwnershipsCreate: PERMISSION_KEYS.PROPERTY_OWNERSHIPS_CREATE,
  propertyOwnershipsEnd: PERMISSION_KEYS.PROPERTY_OWNERSHIPS_END,
  managementAgreementsList: PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_LIST,
  managementAgreementsView: PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_VIEW,
  managementAgreementsCreate: PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_CREATE,
  managementAgreementsUpdate: PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_UPDATE,
  managementAgreementsActivate: PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_ACTIVATE,
  managementAgreementsTerminate: PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_TERMINATE,
} as const;

export const OWNER_NON_AUTHORIZING_BANNER =
  'Recording a Property Owner does not grant application login access';

export const AGREEMENT_NON_AUTHORIZING_BANNER =
  'Recording a Property Owner does not grant application login access';
