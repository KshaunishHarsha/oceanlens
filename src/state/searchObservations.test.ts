import { describe, expect, it } from 'vitest';
import type { ObservationProfile } from '@/domain/types';
import { MAX_SEARCH_RESULTS, searchObservations } from './searchObservations';

function makeObs(overrides: Partial<ObservationProfile>): ObservationProfile {
  return {
    id: 'ARGO-5907083-2',
    platformType: 'ARGO',
    platformName: 'ARGO 5907083',
    latitude: 13.2,
    longitude: 86.72,
    observedAt: '2023-09-29T14:05:00Z',
    qc: 'GOOD',
    depthsM: [],
    variables: {},
    qcByVariable: {},
    unitByVariable: {},
    identity: {
      wmo: '5907083',
      dataCentre: 'IN',
      cycleNumber: 2,
      dataMode: 'D',
      projectName: null,
      principalInvestigator: null,
      positioningSystem: null,
      instrumentType: null,
      positionQc: null,
    },
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

const OBSERVATIONS: readonly ObservationProfile[] = [
  makeObs({ id: 'ARGO-5907083-2', platformName: 'ARGO 5907083' }),
  makeObs({
    id: 'ARGO-2902770-132',
    platformName: 'ARGO 2902770',
    identity: {
      wmo: '2902770',
      dataCentre: 'HZ',
      cycleNumber: 132,
      dataMode: 'D',
      projectName: null,
      principalInvestigator: null,
      positioningSystem: null,
      instrumentType: null,
      positionQc: null,
    },
  }),
  makeObs({ id: 'ARGO-4903776-2', platformName: 'ARGO 4903776', qc: 'BAD', identity: null }),
];

describe('searchObservations', () => {
  it('matches by the real WMO number', () => {
    const result = searchObservations(OBSERVATIONS, '5907083');
    expect(result.map((o) => o.id)).toEqual(['ARGO-5907083-2']);
  });

  it('matches by the display platform name, case-insensitively', () => {
    const result = searchObservations(OBSERVATIONS, 'argo 2902770');
    expect(result.map((o) => o.id)).toEqual(['ARGO-2902770-132']);
  });

  it('matches by the full real observation id', () => {
    const result = searchObservations(OBSERVATIONS, 'ARGO-4903776-2');
    expect(result.map((o) => o.id)).toEqual(['ARGO-4903776-2']);
  });

  it('matches a bare partial number substring across id/name', () => {
    const result = searchObservations(OBSERVATIONS, '2902770');
    expect(result.map((o) => o.id)).toEqual(['ARGO-2902770-132']);
  });

  it('does not fabricate a match for an observation with no real identity — searches id/name only', () => {
    // ARGO-4903776-2 has identity: null; searching a substring that only
    // exists in a WOULD-BE wmo must not match it or crash.
    const result = searchObservations(OBSERVATIONS, '9999999');
    expect(result).toEqual([]);
  });

  it('returns nothing for an empty or whitespace-only query — never "show everything"', () => {
    expect(searchObservations(OBSERVATIONS, '')).toEqual([]);
    expect(searchObservations(OBSERVATIONS, '   ')).toEqual([]);
  });

  it('returns nothing (not an error) when no real observation matches', () => {
    expect(searchObservations(OBSERVATIONS, 'not-a-real-float')).toEqual([]);
  });

  it('caps results at MAX_SEARCH_RESULTS, keeping the dropdown short', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      makeObs({ id: `ARGO-TEST-${i}`, platformName: `ARGO TEST${i}`, identity: null }),
    );
    const result = searchObservations(many, 'ARGO TEST');
    expect(result.length).toBe(MAX_SEARCH_RESULTS);
  });
});
