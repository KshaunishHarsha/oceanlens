import { describe, expect, it } from 'vitest';
import { filterObservations } from './filterObservations';
import { INITIAL_STATE } from './analysisStore';
import type { ObservationProfile } from '@/domain/types';

const SOURCE = {
  id: 'argo.incois',
  datasetName: 'Argo global profiles',
  originator: 'International Argo Program',
  status: 'REAL_CACHED' as const,
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
};

function obs(overrides: Partial<ObservationProfile>): ObservationProfile {
  return {
    id: 'ARGO-0000000-1',
    platformType: 'ARGO',
    platformName: 'ARGO 0000000',
    latitude: 13,
    longitude: 87,
    observedAt: '2023-09-28T00:00:00Z',
    qc: 'GOOD',
    depthsM: [],
    variables: {},
    qcByVariable: {},
    unitByVariable: {},
    identity: {
      wmo: '0000000',
      dataCentre: 'IN',
      cycleNumber: 1,
      dataMode: 'D',
      projectName: null,
      principalInvestigator: null,
      positioningSystem: null,
      instrumentType: null,
      positionQc: 'GOOD',
    },
    provenance: SOURCE,
    ...overrides,
  };
}

const FILTERS = INITIAL_STATE.filters; // platformTypes all on, dataCentres all on, goodQualityOnly true

describe('filterObservations', () => {
  it('keeps every real observation when every filter is permissive', () => {
    const list = [
      obs({ id: 'a', platformType: 'ARGO' }),
      obs({ id: 'b', platformType: 'GLIDER' }),
    ];
    const out = filterObservations(list, { ...FILTERS, goodQualityOnly: false }, new Set());
    expect(out.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('drops a platform type the user has switched off, keeps the rest', () => {
    const list = [obs({ id: 'a', platformType: 'ARGO' }), obs({ id: 'b', platformType: 'CTD' })];
    const filters = {
      ...FILTERS,
      goodQualityOnly: false,
      platformTypes: { ...FILTERS.platformTypes, CTD: false },
    };
    expect(filterObservations(list, filters, new Set()).map((o) => o.id)).toEqual(['a']);
  });

  it('filters by INCOIS vs China Argo data centre independently', () => {
    const list = [
      obs({ id: 'incois', identity: { ...obs({}).identity!, dataCentre: 'IN' } }),
      obs({ id: 'china', identity: { ...obs({}).identity!, dataCentre: 'HZ' } }),
    ];
    const onlyIncois = { ...FILTERS, goodQualityOnly: false, dataCentres: { IN: true, HZ: false } };
    expect(filterObservations(list, onlyIncois, new Set()).map((o) => o.id)).toEqual(['incois']);

    const onlyChina = { ...FILTERS, goodQualityOnly: false, dataCentres: { IN: false, HZ: true } };
    expect(filterObservations(list, onlyChina, new Set()).map((o) => o.id)).toEqual(['china']);
  });

  it('drops SUSPECT and BAD when good-quality-only is on, keeps GOOD and PROBABLY_GOOD', () => {
    const list = [
      obs({ id: 'good', qc: 'GOOD' }),
      obs({ id: 'probably', qc: 'PROBABLY_GOOD' }),
      obs({ id: 'suspect', qc: 'SUSPECT' }),
      obs({ id: 'bad', qc: 'BAD' }),
    ];
    const out = filterObservations(list, { ...FILTERS, goodQualityOnly: true }, new Set());
    expect(out.map((o) => o.id).sort()).toEqual(['good', 'probably'].sort());
  });

  it('shows SUSPECT and BAD once good-quality-only is off — real bad observations are never hidden by default logic', () => {
    const list = [obs({ id: 'suspect', qc: 'SUSPECT' }), obs({ id: 'bad', qc: 'BAD' })];
    const out = filterObservations(list, { ...FILTERS, goodQualityOnly: false }, new Set());
    expect(out.map((o) => o.id).sort()).toEqual(['bad', 'suspect']);
  });

  it('applies collocated-only using the real id set, not the individual observation', () => {
    const list = [obs({ id: 'has-column' }), obs({ id: 'no-column' })];
    const out = filterObservations(
      list,
      { ...FILTERS, goodQualityOnly: false, collocatedOnly: true },
      new Set(['has-column']),
    );
    expect(out.map((o) => o.id)).toEqual(['has-column']);
  });

  it('combines every filter simultaneously', () => {
    const list = [
      obs({ id: 'keep', platformType: 'ARGO', qc: 'GOOD', identity: { ...obs({}).identity!, dataCentre: 'IN' } }),
      obs({ id: 'wrong-platform', platformType: 'CTD' }),
      obs({ id: 'wrong-dac', identity: { ...obs({}).identity!, dataCentre: 'HZ' } }),
      obs({ id: 'wrong-qc', qc: 'BAD' }),
      obs({ id: 'not-collocated' }),
    ];
    const out = filterObservations(list, { ...FILTERS, collocatedOnly: true }, new Set(['keep']));
    expect(out.map((o) => o.id)).toEqual(['keep']);
  });

  it('treats a null identity as neither data centre — visible only when both are on', () => {
    const list = [obs({ id: 'no-identity', identity: null })];
    const bothOn = filterObservations(list, { ...FILTERS, goodQualityOnly: false }, new Set());
    expect(bothOn.map((o) => o.id)).toEqual(['no-identity']);
  });
});
