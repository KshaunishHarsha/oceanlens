/* Real-HTTP integration tests against a running FastAPI backend.
 *
 * Skip cleanly (with a clear message) when no backend is reachable — this
 * suite is not part of `npm test`'s always-green guarantee, and adds no
 * subprocess orchestration to the test runner. Run it explicitly once the
 * backend is up:
 *
 *   cd backend && uvicorn app.main:app --reload --port 8000   # terminal 1
 *   npm run test:integration                                   # terminal 2
 *
 * Mirrors the `describe.skipIf` pattern already used in
 * src/data/realCache.test.ts for the same reason: a fresh clone or CI run
 * with only `npm test` must never fail because an optional live dependency
 * isn't running. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiOceanDataAdapter } from './ApiOceanDataAdapter';
import { apiBaseUrl } from './api/client';

let backendReachable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${apiBaseUrl()}/health`, { signal: AbortSignal.timeout(1500) });
    backendReachable = res.ok;
  } catch {
    backendReachable = false;
  }
  if (!backendReachable) {
    // eslint-disable-next-line no-console
    console.warn(
      `[integration] No backend reachable at ${apiBaseUrl()} — skipping ` +
        `ApiOceanDataAdapter integration tests. Start it with ` +
        `\`cd backend && uvicorn app.main:app --reload --port 8000\` to run them.`,
    );
  }
});

afterAll(() => {
  // nothing to tear down — this suite makes no writes
});

describe.skipIf(!process.env['OCEANLENS_RUN_INTEGRATION'])('ApiOceanDataAdapter (live backend)', () => {
  // The outer skipIf keeps this out of a bare `npm test`. Inner guards below
  // still degrade gracefully if the flag is set but the backend isn't up.

  it('reaches a live backend and reports real cached data', async () => {
    if (!backendReachable) return; // see beforeAll warning
    const adapter = new ApiOceanDataAdapter();
    const meta = await adapter.getMetadata();
    expect(meta.viewId).toMatch(/^DEMO-/);
    expect(meta.sources.length).toBeGreaterThan(0);
  });

  it('returns a real Argo observation list', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const obs = await adapter.getObservations({});
    expect(obs.length).toBeGreaterThan(0);
    expect(obs.every((o) => o.platformType === 'ARGO')).toBe(true);
  });

  it('returns a real temperature slice', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const times = await adapter.getAvailableTimes('temperature');
    expect(times.length).toBeGreaterThan(0);
    const slice = await adapter.getVolumeSlice({
      variable: 'temperature',
      timestamp: times[0]!,
      depthM: 100,
    });
    const finite = [...slice.values].filter(Number.isFinite);
    expect(finite.length).toBeGreaterThan(0);
  });

  it('computes a real collocation from the live backend', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const obs = await adapter.getObservations({ dataCentres: ['IN'] });
    const withColumn = obs.find((o) => o.id !== 'ARGO-4903776-2');
    expect(withColumn).toBeTruthy();
    const result = await adapter.getCollocation({
      observationId: withColumn!.id,
      variable: 'temperature',
    });
    expect(result).not.toBeNull();
    expect(Number.isFinite(result!.rmse) || Number.isNaN(result!.rmse)).toBe(true);
  });

  it('reports chlorophyll as genuinely unavailable, not a synthetic 200', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const times = await adapter.getAvailableTimes('chlorophyll');
    expect(times).toEqual([]);
  });

  it('runs the exact sequence useDataStore.initialize() runs, end-to-end, against the live backend', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const [metadata, layers, observations, variableTimes] = await Promise.all([
      adapter.getMetadata(),
      adapter.getLayerRegistry(),
      adapter.getObservations({}),
      Promise.all(
        (['temperature', 'salinity', 'currentSpeed', 'chlorophyll'] as const).map((v) =>
          adapter.getAvailableTimes(v),
        ),
      ),
    ]);

    expect(metadata.viewId).toBe('DEMO-OCN-2023-0925-BB');
    expect(metadata.windowLabel).toBe('Historical demonstration window');
    expect(observations.length).toBe(28);
    expect(observations.filter((o) => o.identity?.dataCentre === 'IN').length).toBe(19);

    const [tempTimes, salTimes, currentTimes, chlTimes] = variableTimes;
    expect(tempTimes!.length).toBe(11);
    expect(salTimes!.length).toBe(11);
    expect(currentTimes!.length).toBe(11); // real u/v are in this cache
    expect(chlTimes).toEqual([]); // genuinely unavailable, not fabricated

    expect(layers['obs.argo']!.source.status).toBe('REAL_CACHED');
    expect(layers['model.temperature']!.source.status).toBe('PRECOMPUTED_FROM_REAL');
    const unsupported = ['obs.bgc', 'obs.glider', 'obs.ctd', 'satellite.sst', 'satellite.chlorophyll', 'advisory.incois', 'ml.anomaly'] as const;
    for (const id of unsupported) {
      expect(['NOT_AVAILABLE_MVP', 'PLANNED_EXTENSION']).toContain(layers[id]!.source.status);
    }
  });
});
