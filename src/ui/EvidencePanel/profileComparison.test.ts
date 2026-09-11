import { describe, expect, it } from 'vitest';
import type { ModelColumn, ObservationProfile } from '@/domain/types';
import {
  buildModeledSeries,
  buildObservedSeries,
  computeChartDomain,
  isProfileChartVariable,
  nearestTimestamp,
  qcMarkerShape,
  selectProfileChartView,
} from './profileComparison';

function makeObservation(overrides?: Partial<ObservationProfile>): ObservationProfile {
  return {
    id: 'argo-1',
    platformType: 'ARGO',
    platformName: 'ARGO 5907083',
    latitude: 13.2,
    longitude: 86.72,
    observedAt: '2023-09-29T14:05:00Z',
    qc: 'GOOD',
    depthsM: [0, 50, 100, 200],
    variables: {
      temperature: [29.1, 24.3, 18.9, null],
      salinity: [33.9, 34.9, 35.1, 35.2],
    },
    qcByVariable: {
      temperature: ['GOOD', 'GOOD', 'SUSPECT', null],
      salinity: ['GOOD', 'GOOD', 'GOOD', 'BAD'],
    },
    unitByVariable: { temperature: '°C', salinity: 'PSU' },
    identity: null,
    provenance: {
      id: 'argo.incois',
      datasetName: 'Argo global profiles',
      originator: 'International Argo Program',
      status: 'REAL_CACHED',
      sourceUrl: null,
      sourceFiles: [],
      retrievedAt: null,
      checksums: {},
      sourceVariables: [],
      sourceUnits: {},
      coordinateSystem: 'WGS84',
      temporal: null,
      depth: null,
      spatial: null,
      qcConvention: null,
      transformations: [],
      licence: null,
      caveats: [],
    },
    ...overrides,
  };
}

function makeColumn(overrides?: Partial<ModelColumn>): ModelColumn {
  return {
    gridId: 'api',
    variable: 'temperature',
    timestamp: '2023-09-29T00:00:00Z',
    at: { latitude: 13.2, longitude: 86.72 },
    depthsM: [0, 50, 100, 200],
    values: [28.9, 24.0, 19.5, 15.1],
    ...overrides,
  };
}

describe('isProfileChartVariable', () => {
  it('supports only temperature and salinity — Argo floats carry no current/chlorophyll sensor', () => {
    expect(isProfileChartVariable('temperature')).toBe(true);
    expect(isProfileChartVariable('salinity')).toBe(true);
    expect(isProfileChartVariable('currentSpeed')).toBe(false);
    expect(isProfileChartVariable('chlorophyll')).toBe(false);
  });
});

describe('qcMarkerShape', () => {
  it('distinguishes GOOD/PROBABLY_GOOD, SUSPECT and BAD by shape, not colour alone', () => {
    expect(qcMarkerShape('GOOD')).toBe('dot');
    expect(qcMarkerShape('PROBABLY_GOOD')).toBe('dot');
    expect(qcMarkerShape('SUSPECT')).toBe('ring');
    expect(qcMarkerShape('BAD')).toBe('cross');
  });
});

describe('nearestTimestamp', () => {
  const candidates = [
    '2023-09-25T00:00:00Z',
    '2023-09-26T00:00:00Z',
    '2023-09-29T00:00:00Z',
    '2023-10-05T00:00:00Z',
  ];

  it('picks the closest real candidate by absolute time difference', () => {
    expect(nearestTimestamp('2023-09-29T14:05:00Z', candidates)).toBe('2023-09-29T00:00:00Z');
  });

  it('picks the closer of two adjacent candidates, not always the earlier one', () => {
    // 2023-09-27 is closer to 09-26 (1 day) than to 09-29 (2 days)
    expect(nearestTimestamp('2023-09-27T00:00:00Z', candidates)).toBe('2023-09-26T00:00:00Z');
  });

  it('returns null only when there are no real candidates — never fabricates one', () => {
    expect(nearestTimestamp('2023-09-29T14:05:00Z', [])).toBeNull();
  });

  it('is exact-match-safe: the returned value is always one of the given candidates', () => {
    const result = nearestTimestamp('1999-01-01T00:00:00Z', candidates);
    expect(candidates).toContain(result);
  });
});

describe('buildObservedSeries', () => {
  it('extracts only real, non-null, QC-tagged levels for the requested variable', () => {
    const obs = makeObservation();
    const series = buildObservedSeries(obs, 'temperature');
    // depth 200's value AND qc are both null -> dropped, never zero-filled
    expect(series).toEqual([
      { depthM: 0, value: 29.1, qc: 'GOOD' },
      { depthM: 50, value: 24.3, qc: 'GOOD' },
      { depthM: 100, value: 18.9, qc: 'SUSPECT' },
    ]);
  });

  it('keeps a real BAD level rather than hiding it', () => {
    const obs = makeObservation();
    const series = buildObservedSeries(obs, 'salinity');
    expect(series.find((p) => p.depthM === 200)).toEqual({ depthM: 200, value: 35.2, qc: 'BAD' });
  });

  it('returns empty for a variable the observation never fetched (e.g. currents)', () => {
    const obs = makeObservation();
    expect(buildObservedSeries(obs, 'currentSpeed')).toEqual([]);
  });
});

describe('buildModeledSeries', () => {
  it('extracts real non-null model levels', () => {
    expect(buildModeledSeries(makeColumn())).toEqual([
      { depthM: 0, value: 28.9 },
      { depthM: 50, value: 24.0 },
      { depthM: 100, value: 19.5 },
      { depthM: 200, value: 15.1 },
    ]);
  });

  it('skips null levels rather than interpolating a fabricated value', () => {
    const column = makeColumn({ values: [28.9, null, 19.5, null] });
    expect(buildModeledSeries(column)).toEqual([
      { depthM: 0, value: 28.9 },
      { depthM: 100, value: 19.5 },
    ]);
  });

  it('returns empty for a null column (no real comparison available)', () => {
    expect(buildModeledSeries(null)).toEqual([]);
  });
});

describe('computeChartDomain', () => {
  it('returns null when there is nothing real to plot', () => {
    expect(computeChartDomain([], [])).toBeNull();
  });

  it('spans the real data extent with a small pad, not the variable default range', () => {
    const observed = buildObservedSeries(makeObservation(), 'temperature');
    const domain = computeChartDomain(observed, []);
    expect(domain).not.toBeNull();
    // real min/max here are 18.9..29.1 — must NOT snap to the 16..30 default range
    expect(domain!.valueMin).toBeGreaterThan(16);
    expect(domain!.valueMax).toBeLessThan(30);
    expect(domain!.valueMin).toBeLessThan(18.9);
    expect(domain!.valueMax).toBeGreaterThan(29.1);
  });

  it('depth axis extends slightly past the deepest real level, never less', () => {
    const observed = buildObservedSeries(makeObservation(), 'temperature');
    const domain = computeChartDomain(observed, []);
    expect(domain!.depthMaxM).toBeGreaterThanOrEqual(100);
  });
});

describe('selectProfileChartView', () => {
  it('flags an unsupported variable before ever considering fetch status', () => {
    const view = selectProfileChartView({
      variableSupported: false,
      variableName: 'Chlorophyll-a',
      status: 'ready',
      error: null,
      observedCount: 5,
    });
    expect(view).toEqual({ kind: 'unavailable-variable', variableName: 'Chlorophyll-a' });
  });

  it('shows loading for idle/loading status', () => {
    for (const status of ['idle', 'loading'] as const) {
      expect(
        selectProfileChartView({
          variableSupported: true,
          variableName: 'Sea-water temperature',
          status,
          error: null,
          observedCount: 0,
        }),
      ).toEqual({ kind: 'loading' });
    }
  });

  it('surfaces a real fetch error, never silently falling to ready', () => {
    const view = selectProfileChartView({
      variableSupported: true,
      variableName: 'Sea-water temperature',
      status: 'error',
      error: 'backend unreachable',
      observedCount: 0,
    });
    expect(view).toEqual({ kind: 'error', message: 'backend unreachable' });
  });

  it('reports no-valid-levels for a genuinely empty real result (e.g. all-QC-failed profile)', () => {
    const view = selectProfileChartView({
      variableSupported: true,
      variableName: 'Sea-water temperature',
      status: 'ready',
      error: null,
      observedCount: 0,
    });
    expect(view).toEqual({ kind: 'no-valid-levels' });
  });

  it('is ready once there is at least one real observed level', () => {
    const view = selectProfileChartView({
      variableSupported: true,
      variableName: 'Sea-water temperature',
      status: 'ready',
      error: null,
      observedCount: 1,
    });
    expect(view).toEqual({ kind: 'ready' });
  });
});
