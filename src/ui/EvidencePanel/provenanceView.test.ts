import { describe, expect, it } from 'vitest';
import { unavailable, type DataSourceDescriptor } from '@/domain/provenance';
import {
  formatRetrievedAt,
  formatSourceVariables,
  formatTemporalCoverage,
  modelLayerIdForVariable,
} from './provenanceView';

function realSource(overrides?: Partial<DataSourceDescriptor>): DataSourceDescriptor {
  return {
    id: 'argo.incois',
    datasetName: 'Argo global profiles',
    originator: 'International Argo Program',
    status: 'REAL_CACHED',
    sourceUrl: 'https://data-argo.ifremer.fr/dac/',
    sourceFiles: ['D5907083_002.nc'],
    retrievedAt: '2026-09-10T11:19:09.588Z',
    checksums: {},
    sourceVariables: ['PRES', 'TEMP', 'PSAL', '*_QC'],
    sourceUnits: { PRES: 'decibar', TEMP: 'degree_Celsius', PSAL: 'psu (PSS-78)' },
    coordinateSystem: 'WGS84 lat/lon; pressure decibar converted to depth (m)',
    temporal: { start: '2023-09-25T00:00:00Z', end: '2023-10-05T00:00:00Z', cadence: 'per float cycle' },
    depth: null,
    spatial: null,
    qcConvention: 'Argo QC flag scale',
    transformations: ['Converted PRES (decibar) to depth (m) via UNESCO 1983'],
    licence: 'Argo data are freely available',
    caveats: ['19 of 28 profiles are INCOIS'],
    ...overrides,
  };
}

describe('modelLayerIdForVariable', () => {
  it('maps temperature and salinity to their own HYCOM model layers', () => {
    expect(modelLayerIdForVariable('temperature')).toBe('model.temperature');
    expect(modelLayerIdForVariable('salinity')).toBe('model.salinity');
  });

  it('maps currentSpeed to the real HYCOM currents layer', () => {
    expect(modelLayerIdForVariable('currentSpeed')).toBe('model.currents');
  });

  it('maps chlorophyll to its own (currently unavailable) satellite layer, not a HYCOM one — chlorophyll has no model field', () => {
    expect(modelLayerIdForVariable('chlorophyll')).toBe('satellite.chlorophyll');
  });

  it('every OceanVariable maps to a distinct layer id, so the tab never silently reuses the wrong source', () => {
    const ids = (['temperature', 'salinity', 'currentSpeed', 'chlorophyll'] as const).map(
      modelLayerIdForVariable,
    );
    expect(new Set(ids).size).toBe(4);
  });
});

describe('formatSourceVariables', () => {
  it('pairs a source variable with its declared unit when known', () => {
    const s = realSource();
    expect(formatSourceVariables(s)).toBe(
      'PRES (decibar), TEMP (degree_Celsius), PSAL (psu (PSS-78)), *_QC',
    );
  });

  it('lists a variable bare when no unit is declared for it (never invents one)', () => {
    const s = realSource({ sourceVariables: ['TEMP_QC'], sourceUnits: {} });
    expect(formatSourceVariables(s)).toBe('TEMP_QC');
  });

  it('returns an em dash for a source with no declared variables (e.g. an unavailable layer)', () => {
    expect(formatSourceVariables(unavailable('x', 'X', 'NOT_AVAILABLE_MVP', []))).toBe('—');
  });
});

describe('formatTemporalCoverage', () => {
  it('formats a real coverage window with its cadence', () => {
    const t = { start: '2023-09-25T00:00:00Z', end: '2023-10-05T00:00:00Z', cadence: 'daily' };
    expect(formatTemporalCoverage(t)).toBe('2023-09-25 → 2023-10-05 (daily)');
  });

  it('returns an em dash for no coverage — never a fabricated date range', () => {
    expect(formatTemporalCoverage(null)).toBe('—');
  });
});

describe('formatRetrievedAt', () => {
  it('formats a real retrieval timestamp', () => {
    expect(formatRetrievedAt('2026-09-10T11:19:09.588Z')).toBe('2026-09-10 11:19 UTC');
  });

  it('returns an em dash for a null retrieval date (synthetic/unavailable sources)', () => {
    expect(formatRetrievedAt(null)).toBe('—');
  });
});

describe('honesty: an unavailable/planned source never gets a fabricated field', () => {
  it('the unavailable() fixture used across the app carries no invented originator, URL, or transformations', () => {
    const s = unavailable('satellite.chlorophyll', 'Satellite chlorophyll-a', 'PLANNED_EXTENSION', [
      'Real ocean-colour products exist but are not yet prepared into the cache.',
    ]);
    expect(s.originator).toBe('—');
    expect(s.sourceUrl).toBeNull();
    expect(s.retrievedAt).toBeNull();
    expect(s.transformations).toEqual([]);
    expect(formatSourceVariables(s)).toBe('—');
    expect(formatRetrievedAt(s.retrievedAt)).toBe('—');
    expect(formatTemporalCoverage(s.temporal)).toBe('—');
    // the real, honest reason is still present — not silence, not a fake reason
    expect(s.caveats[0]).toContain('not yet prepared');
  });
});
