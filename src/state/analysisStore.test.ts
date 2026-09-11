import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DEPTH_M,
  MAX_EXAGGERATION,
  MIN_EXAGGERATION,
  resetAnalysisStore,
  useAnalysisStore,
} from './analysisStore';

const s = () => useAnalysisStore.getState();

const TIMES = [
  '2023-09-03T00:00:00Z',
  '2023-09-03T03:00:00Z',
  '2023-09-03T06:00:00Z',
  '2023-09-03T09:00:00Z',
];

beforeEach(() => resetAnalysisStore());

describe('time selection', () => {
  it('keeps timestamp and index consistent when times load', () => {
    s().setAvailableTimes(TIMES);
    expect(s().timeIndex).toBe(0);
    expect(s().timestamp).toBe(TIMES[0]);
  });

  it('resolves timestamp from index', () => {
    s().setAvailableTimes(TIMES);
    s().setTimeIndex(2);
    expect(s().timestamp).toBe('2023-09-03T06:00:00Z');
  });

  it('clamps an out-of-range index rather than producing undefined', () => {
    s().setAvailableTimes(TIMES);
    s().setTimeIndex(99);
    expect(s().timeIndex).toBe(3);
    expect(s().timestamp).toBe(TIMES[3]);
  });

  it('has a null timestamp before any data loads', () => {
    expect(s().timestamp).toBeNull();
    s().setTimeIndex(2);
    expect(s().timestamp).toBeNull();
  });

  it('wraps forward so playback loops', () => {
    s().setAvailableTimes(TIMES);
    s().setTimeIndex(3);
    s().stepTime(1);
    expect(s().timeIndex).toBe(0);
  });

  it('wraps backward from the first frame', () => {
    s().setAvailableTimes(TIMES);
    s().stepTime(-1);
    expect(s().timeIndex).toBe(3);
  });

  it('re-clamps the index when a shorter time array loads', () => {
    s().setAvailableTimes(TIMES);
    s().setTimeIndex(3);
    s().setAvailableTimes(TIMES.slice(0, 2));
    expect(s().timeIndex).toBe(1);
    expect(s().timestamp).toBe(TIMES[1]);
  });
});

describe('depth and exaggeration', () => {
  it('clamps depth to the 0–1000 m volume', () => {
    s().setDepth(-40);
    expect(s().depthM).toBe(0);
    s().setDepth(5000);
    expect(s().depthM).toBe(1000);
  });

  it('clamps exaggeration to its supported range', () => {
    s().setVerticalExaggeration(999);
    expect(s().verticalExaggeration).toBe(MAX_EXAGGERATION);
    s().setVerticalExaggeration(0);
    expect(s().verticalExaggeration).toBe(MIN_EXAGGERATION);
  });
});

describe('linked selection', () => {
  it('opens the profile tab when an observation is selected', () => {
    s().setEvidenceTab('provenance');
    s().selectObservation('ARGO-1902594');
    expect(s().selectedObservationId).toBe('ARGO-1902594');
    expect(s().evidenceTab).toBe('profile');
  });

  it('leaves the active tab alone when deselecting', () => {
    s().setEvidenceTab('comparison');
    s().selectObservation(null);
    expect(s().evidenceTab).toBe('comparison');
  });
});

describe('layers and filters', () => {
  it('toggles a layer that was never explicitly set', () => {
    expect(s().layers['satellite.sst']).toBeUndefined();
    s().toggleLayer('satellite.sst');
    expect(s().layers['satellite.sst']).toBe(true);
    s().toggleLayer('satellite.sst');
    expect(s().layers['satellite.sst']).toBe(false);
  });

  it('toggles a platform type without disturbing the others', () => {
    s().togglePlatformType('GLIDER');
    expect(s().filters.platformTypes.GLIDER).toBe(false);
    expect(s().filters.platformTypes.ARGO).toBe(true);
  });

  it('defaults to good-quality-only, which matters for real Argo data', () => {
    expect(s().filters.goodQualityOnly).toBe(true);
  });

  it('defaults both real Argo data centres to on', () => {
    expect(s().filters.dataCentres.IN).toBe(true);
    expect(s().filters.dataCentres.HZ).toBe(true);
  });

  it('toggles one data centre without disturbing the other', () => {
    s().toggleDataCentre('HZ');
    expect(s().filters.dataCentres.HZ).toBe(false);
    expect(s().filters.dataCentres.IN).toBe(true);
  });
});

describe('resetScientificDefaults', () => {
  it('restores scale, opacity, exaggeration and depth but not selection', () => {
    s().setColorScale('log');
    s().setOpacity(0.2);
    s().setVerticalExaggeration(40);
    s().setDepth(800);
    s().selectObservation('ARGO-1902594');

    s().resetScientificDefaults();

    expect(s().colorScale).toBe('linear');
    expect(s().opacity).toBeCloseTo(0.82);
    expect(s().verticalExaggeration).toBe(18);
    expect(s().depthM).toBe(DEFAULT_DEPTH_M);
    expect(s().selectedObservationId).toBe('ARGO-1902594');
  });
});
