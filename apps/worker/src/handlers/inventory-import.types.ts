/** Shared shape for accepted inventory import row payloads (API dry-run → worker commit). */
export type InventoryImportRowDto = {
  propertyCode: string;
  propertyName: string;
  propertyType: string;
  addressLine1: string;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  timeZone: string;
  defaultCurrency: string;
  buildingCode: string | null;
  unitCode: string;
  unitName: string;
  unitType: string;
  allocationMode: string;
  capacity: number;
  bedCode: string | null;
  bedLabel: string | null;
  amenityCodes: string[];
};
