/**
 * Pure inventory import CSV validation (no Prisma / Nest).
 * Sprint-06 handoff column mapping → validated DTO or row error.
 */

export const PROPERTY_TYPES = ['APARTMENT', 'BOARDING_HOUSE', 'MIXED', 'OTHER'] as const;
export const UNIT_TYPES = ['APARTMENT', 'STUDIO', 'PRIVATE_ROOM', 'SHARED_ROOM'] as const;
export const ALLOCATION_MODES = ['WHOLE_UNIT', 'BED', 'CAPACITY'] as const;

export type PropertyTypeValue = (typeof PROPERTY_TYPES)[number];
export type UnitTypeValue = (typeof UNIT_TYPES)[number];
export type AllocationModeValue = (typeof ALLOCATION_MODES)[number];

export type InventoryImportRowDto = {
  propertyCode: string;
  propertyName: string;
  propertyType: PropertyTypeValue;
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
  unitType: UnitTypeValue;
  allocationMode: AllocationModeValue;
  capacity: number;
  bedCode: string | null;
  bedLabel: string | null;
  amenityCodes: string[];
};

export type InventoryImportRowError = {
  ok: false;
  rowNumber: number;
  reason: string;
  code: string;
  raw: Record<string, string>;
};

export type InventoryImportRowSuccess = {
  ok: true;
  rowNumber: number;
  dto: InventoryImportRowDto;
  raw: Record<string, string>;
};

export type InventoryImportRowResult = InventoryImportRowSuccess | InventoryImportRowError;

const CANONICAL_HEADERS = [
  'property_code',
  'property_name',
  'property_type',
  'address_line1',
  'city',
  'region',
  'postal_code',
  'country_code',
  'time_zone',
  'default_currency',
  'building_code',
  'unit_code',
  'unit_name',
  'unit_type',
  'allocation_mode',
  'capacity',
  'bed_code',
  'bed_label',
  'amenity_codes',
] as const;

function trim(value: string | undefined): string {
  return (value ?? '').trim();
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

/** Split CSV text into data rows (skips blank lines). First non-blank line is header. */
export function parseInventoryCsv(csvText: string): {
  headers: string[];
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
} {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerCells = parseCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const rows: Array<{ rowNumber: number; cells: Record<string, string> }> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]!);
    const cells: Record<string, string> = {};
    for (let c = 0; c < headerCells.length; c += 1) {
      cells[headerCells[c]!] = values[c] ?? '';
    }
    rows.push({ rowNumber: i + 1, cells });
  }

  return { headers: headerCells, rows };
}

/** Apply optional column mapping (source header → canonical header). */
export function applyColumnMapping(
  cells: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  if (Object.keys(mapping).length === 0) {
    return cells;
  }

  const mapped: Record<string, string> = { ...cells };
  for (const [source, target] of Object.entries(mapping)) {
    const sourceKey = source.trim().toLowerCase();
    const targetKey = target.trim().toLowerCase();
    if (sourceKey in cells) {
      mapped[targetKey] = cells[sourceKey] ?? '';
    }
  }
  return mapped;
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

/**
 * Validate a single CSV row into a DTO or structured error.
 * Does not touch the database — referential / scope checks live in application services.
 */
export function validateInventoryImportRow(
  rowNumber: number,
  rawCells: Record<string, string>,
  mapping: Record<string, string> = {},
): InventoryImportRowResult {
  const cells = applyColumnMapping(rawCells, mapping);
  const raw = { ...cells };

  const propertyCode = trim(cells.property_code);
  const propertyName = trim(cells.property_name);
  const propertyTypeRaw = trim(cells.property_type).toUpperCase();
  const addressLine1 = trim(cells.address_line1);
  const city = trim(cells.city);
  const region = trim(cells.region) || null;
  const postalCode = trim(cells.postal_code) || null;
  const countryCode = (trim(cells.country_code) || 'US').toUpperCase();
  const timeZone = trim(cells.time_zone);
  const defaultCurrency = (trim(cells.default_currency) || 'USD').toUpperCase();
  const buildingCode = trim(cells.building_code) || null;
  const unitCode = trim(cells.unit_code);
  const unitName = trim(cells.unit_name);
  const unitTypeRaw = trim(cells.unit_type).toUpperCase();
  const allocationModeRaw = trim(cells.allocation_mode).toUpperCase();
  const capacityRaw = trim(cells.capacity);
  const bedCode = trim(cells.bed_code) || null;
  const bedLabel = trim(cells.bed_label) || null;
  const amenityCodesRaw = trim(cells.amenity_codes);

  const fail = (reason: string, code: string): InventoryImportRowError => ({
    ok: false,
    rowNumber,
    reason,
    code,
    raw,
  });

  if (!propertyCode) {
    return fail('property_code is required', 'REQUIRED_FIELD');
  }
  if (!propertyName) {
    return fail('property_name is required', 'REQUIRED_FIELD');
  }
  if (!isOneOf(propertyTypeRaw, PROPERTY_TYPES)) {
    return fail(`property_type must be one of ${PROPERTY_TYPES.join(', ')}`, 'INVALID_ENUM');
  }
  if (!addressLine1) {
    return fail('address_line1 is required', 'REQUIRED_FIELD');
  }
  if (!city) {
    return fail('city is required', 'REQUIRED_FIELD');
  }
  if (countryCode.length !== 2) {
    return fail('country_code must be ISO-3166-1 alpha-2', 'INVALID_FORMAT');
  }
  if (!timeZone) {
    return fail('time_zone is required', 'REQUIRED_FIELD');
  }
  if (defaultCurrency.length !== 3) {
    return fail('default_currency must be ISO-4217', 'INVALID_FORMAT');
  }
  if (!unitCode) {
    return fail('unit_code is required', 'REQUIRED_FIELD');
  }
  if (!unitName) {
    return fail('unit_name is required', 'REQUIRED_FIELD');
  }
  if (!isOneOf(unitTypeRaw, UNIT_TYPES)) {
    return fail(`unit_type must be one of ${UNIT_TYPES.join(', ')}`, 'INVALID_ENUM');
  }
  if (!isOneOf(allocationModeRaw, ALLOCATION_MODES)) {
    return fail(`allocation_mode must be one of ${ALLOCATION_MODES.join(', ')}`, 'INVALID_ENUM');
  }

  let capacity = 1;
  if (capacityRaw.length > 0) {
    const parsed = Number.parseInt(capacityRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fail('capacity must be a positive integer', 'INVALID_FORMAT');
    }
    capacity = parsed;
  }

  if (
    (allocationModeRaw === 'BED' || allocationModeRaw === 'CAPACITY') &&
    capacityRaw.length === 0
  ) {
    return fail('capacity is required for BED and CAPACITY allocation modes', 'REQUIRED_FIELD');
  }

  if (allocationModeRaw === 'BED') {
    if (!bedCode) {
      return fail('bed_code is required when allocation_mode=BED', 'REQUIRED_FIELD');
    }
    if (!bedLabel) {
      return fail('bed_label is required when allocation_mode=BED', 'REQUIRED_FIELD');
    }
  } else if (bedCode || bedLabel) {
    return fail('bed_code/bed_label only allowed when allocation_mode=BED', 'INVALID_COMBINATION');
  }

  const amenityCodes =
    amenityCodesRaw.length === 0
      ? []
      : amenityCodesRaw
          .split(/[|;]/)
          .map((code) => code.trim())
          .filter((code) => code.length > 0);

  return {
    ok: true,
    rowNumber,
    raw,
    dto: {
      propertyCode,
      propertyName,
      propertyType: propertyTypeRaw,
      addressLine1,
      city,
      region,
      postalCode,
      countryCode,
      timeZone,
      defaultCurrency,
      buildingCode,
      unitCode,
      unitName,
      unitType: unitTypeRaw,
      allocationMode: allocationModeRaw,
      capacity,
      bedCode,
      bedLabel,
      amenityCodes,
    },
  };
}

export function validateInventoryCsv(
  csvText: string,
  mapping: Record<string, string> = {},
): InventoryImportRowResult[] {
  const parsed = parseInventoryCsv(csvText);
  if (parsed.headers.length === 0) {
    return [
      {
        ok: false,
        rowNumber: 1,
        reason: 'CSV is empty',
        code: 'EMPTY_CSV',
        raw: {},
      },
    ];
  }

  const hasPropertyCode = parsed.headers.includes('property_code') || 'property_code' in mapping;
  if (!hasPropertyCode && Object.keys(mapping).length === 0) {
    const missing = CANONICAL_HEADERS.filter((h) => !parsed.headers.includes(h));
    if (missing.includes('property_code') || missing.includes('unit_code')) {
      // Still attempt per-row validation — rows will fail required checks.
    }
  }

  if (parsed.rows.length === 0) {
    return [
      {
        ok: false,
        rowNumber: 2,
        reason: 'CSV has headers but no data rows',
        code: 'EMPTY_CSV',
        raw: {},
      },
    ];
  }

  return parsed.rows.map((row) => validateInventoryImportRow(row.rowNumber, row.cells, mapping));
}

export function inventoryImportTemplateCsv(): string {
  const header = CANONICAL_HEADERS.join(',');
  const example = [
    'P-DEMO',
    'Demo Property',
    'APARTMENT',
    '100 Main St',
    'Austin',
    'TX',
    '78701',
    'US',
    'America/Chicago',
    'USD',
    '',
    '101',
    'Unit 101',
    'APARTMENT',
    'WHOLE_UNIT',
    '1',
    '',
    '',
    '',
  ].join(',');
  return `${header}\n${example}\n`;
}
