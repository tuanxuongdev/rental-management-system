import { describe, expect, it } from 'vitest';

import {
  inventoryImportTemplateCsv,
  validateInventoryCsv,
  validateInventoryImportRow,
} from './inventory-import.rules';

describe('inventory-import.rules', () => {
  it('rejects missing required fields', () => {
    const result = validateInventoryImportRow(2, {
      property_code: '',
      unit_code: 'U1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('REQUIRED_FIELD');
    }
  });

  it('accepts a valid whole-unit row', () => {
    const result = validateInventoryImportRow(2, {
      property_code: 'P1',
      property_name: 'House',
      property_type: 'APARTMENT',
      address_line1: '1 Main',
      city: 'Austin',
      country_code: 'US',
      time_zone: 'America/Chicago',
      default_currency: 'USD',
      unit_code: '101',
      unit_name: 'Unit 101',
      unit_type: 'APARTMENT',
      allocation_mode: 'WHOLE_UNIT',
      capacity: '1',
    });
    expect(result.ok).toBe(true);
  });

  it('requires bed fields for BED allocation', () => {
    const result = validateInventoryImportRow(2, {
      property_code: 'P1',
      property_name: 'House',
      property_type: 'BOARDING_HOUSE',
      address_line1: '1 Main',
      city: 'Austin',
      time_zone: 'UTC',
      default_currency: 'USD',
      unit_code: 'S1',
      unit_name: 'Shared',
      unit_type: 'SHARED_ROOM',
      allocation_mode: 'BED',
      capacity: '2',
    });
    expect(result.ok).toBe(false);
  });

  it('parses multi-row CSV via validateInventoryCsv', () => {
    const csv = inventoryImportTemplateCsv();
    const results = validateInventoryCsv(csv);
    expect(results.length).toBe(1);
    expect(results[0]?.ok).toBe(true);
  });
});
