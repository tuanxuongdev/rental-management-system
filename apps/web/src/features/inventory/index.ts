export { PropertyScopeSelector } from './components/property-scope-selector';
export { PropertiesList } from './components/properties-list';
export { PropertyDetail } from './components/property-detail';
export { PropertyForm } from './components/property-form';
export { BuildingsList } from './components/buildings-list';
export { UnitsList } from './components/units-list';
export { UnitDetail } from './components/unit-detail';
export { UnitForm } from './components/unit-form';
export { BedsList } from './components/beds-list';
export { AvailabilityLookup } from './components/availability-lookup';

export {
  useProperties,
  useProperty,
  useCreateProperty,
  usePatchProperty,
  useArchiveProperty,
  propertiesQueryKey,
  propertyQueryKey,
} from './hooks/use-properties';
export {
  useBuildings,
  useCreateBuilding,
  usePatchBuilding,
  buildingsQueryKey,
} from './hooks/use-buildings';
export {
  useUnits,
  useUnit,
  useCreateUnit,
  usePatchUnit,
  useArchiveUnit,
  useUpdateUnitStatus,
  unitsQueryKey,
  unitQueryKey,
} from './hooks/use-units';
export { useBeds, useCreateBed, usePatchBed, bedsQueryKey } from './hooks/use-beds';
export { useAvailability, availabilityQueryKey } from './hooks/use-availability';

export {
  PORTFOLIO_PERMISSIONS,
  OWNER_NON_AUTHORIZING_BANNER,
  AGREEMENT_NON_AUTHORIZING_BANNER,
  hasPermission,
  canMutate,
} from './utils/permissions';
