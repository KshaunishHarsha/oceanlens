/* A render smoke test — not a full component test suite (out of scope for
 * this phase), just a guard that the App tree constructs and renders to a
 * string without throwing, across every dataStore status the shell must
 * handle (idle/loading, error, ready-with-data, selected observation across
 * all tabs, briefing/outreach modes). No browser automation is available in
 * this environment, so this is the practical alternative to "does it mount
 * without a console error." */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { App } from './App';
import { resetAnalysisStore, useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import type { DatasetMetadata, ObservationProfile } from '@/domain/types';
import type { LayerRegistry } from '@/domain/layers';

const METADATA: DatasetMetadata = {
  title: 'OceanLens India',
  demonstrationWindow: { start: '2023-09-25T00:00:00Z', end: '2023-10-05T00:00:00Z' },
  windowLabel: 'Historical demonstration window',
  region: { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 },
  regionName: 'Bay of Bengal',
  sources: [],
  viewId: 'DEMO-OCN-2023-0925-BB',
  generatedAt: '2026-09-11T00:00:00Z',
};

const OBSERVATION: ObservationProfile = {
  id: 'ARGO-5907083-2',
  platformType: 'ARGO',
  platformName: 'ARGO 5907083',
  latitude: 13.2,
  longitude: 86.7167,
  observedAt: '2023-09-29T14:05:34.000Z',
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
    projectName: 'Argo INDIA',
    principalInvestigator: null,
    positioningSystem: null,
    instrumentType: null,
    positionQc: 'GOOD',
  },
  provenance: {
    id: 'argo.incois',
    datasetName: 'Argo global profiles',
    originator: 'International Argo Program',
    status: 'REAL_CACHED',
    sourceUrl: 'https://data-argo.ifremer.fr/dac/',
    sourceFiles: [],
    retrievedAt: '2026-09-10T11:19:09.588Z',
    checksums: {},
    sourceVariables: [],
    sourceUnits: {},
    coordinateSystem: 'WGS84',
    temporal: null,
    depth: null,
    spatial: null,
    qcConvention: 'Argo QC flag scale',
    transformations: ['converted pressure to depth'],
    licence: null,
    caveats: [],
  },
};

const EMPTY_LAYERS = {} as LayerRegistry;
const TIMES = ['2023-09-25T00:00:00.000Z', '2023-09-26T00:00:00.000Z', '2023-09-27T00:00:00.000Z'];

function setReady(overrides: Partial<ReturnType<typeof useDataStore.getState>> = {}) {
  useDataStore.setState({
    status: 'ready',
    error: null,
    adapter: null,
    metadata: METADATA,
    layers: EMPTY_LAYERS,
    observations: [OBSERVATION],
    variableAvailability: { temperature: true, salinity: true, currentSpeed: true, chlorophyll: false },
    ...overrides,
  });
  useAnalysisStore.getState().setAvailableTimes(TIMES);
}

afterEach(() => {
  resetAnalysisStore();
  useDataStore.setState({
    status: 'idle',
    error: null,
    adapter: null,
    metadata: null,
    layers: null,
    observations: [],
    variableAvailability: {},
  });
  vi.unstubAllGlobals();
});

describe('App shell render smoke test', () => {
  it('renders the idle/loading state without throwing', () => {
    // The data-loading effect fires after render in a real browser, not
    // during SSR; stub fetch anyway so nothing unstubbed leaks between tests.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network in SSR smoke test')));
    expect(() => renderToString(createElement(App))).not.toThrow();
  });

  it('renders the error state without throwing', () => {
    useDataStore.setState({
      status: 'error',
      error: 'OceanLens backend unreachable at http://localhost:8000',
    });
    expect(() => renderToString(createElement(App))).not.toThrow();
  });

  it('renders the ready state with real-shaped data without throwing', () => {
    setReady();
    expect(() => renderToString(createElement(App))).not.toThrow();
  });

  it('renders with an observation selected, across all three tabs, without throwing', () => {
    setReady();
    useAnalysisStore.getState().selectObservation('ARGO-5907083-2');
    for (const tab of ['profile', 'comparison', 'provenance'] as const) {
      useAnalysisStore.getState().setEvidenceTab(tab);
      expect(() => renderToString(createElement(App))).not.toThrow();
    }
  });

  it('renders briefing and outreach modes without throwing', () => {
    setReady();
    useAnalysisStore.getState().setMode('briefing');
    expect(() => renderToString(createElement(App))).not.toThrow();
    useAnalysisStore.getState().setMode('outreach');
    expect(() => renderToString(createElement(App))).not.toThrow();
  });

  it('renders with chlorophyll selected (unavailable variable) without throwing', () => {
    setReady();
    useAnalysisStore.getState().setVariable('chlorophyll');
    expect(() => renderToString(createElement(App))).not.toThrow();
  });

  it('renders with every data-centre and platform-type filter combination without throwing', () => {
    setReady();
    useAnalysisStore.getState().toggleDataCentre('HZ');
    useAnalysisStore.getState().togglePlatformType('GLIDER');
    expect(() => renderToString(createElement(App))).not.toThrow();
  });
});
