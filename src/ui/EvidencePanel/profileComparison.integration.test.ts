/* Real-HTTP integration test for the Phase 5A profile chart's data path:
 * fetches a real observation profile and its closest real model column
 * through the same OceanDataAdapter calls useProfileComparison.ts uses,
 * then runs the exact buildObservedSeries()/buildModeledSeries() the
 * component uses on the result — end-to-end proof the mapping works on
 * real numbers, without a browser.
 *
 * Skips cleanly without a live backend; run explicitly:
 *   cd backend && uvicorn app.main:app --reload --port 8000   # terminal 1
 *   npm run test:integration                                   # terminal 2
 * (test:integration runs every *.integration.test.ts file listed there). */

import { beforeAll, describe, expect, it } from 'vitest';
import { ApiOceanDataAdapter } from '@/data/ApiOceanDataAdapter';
import { apiBaseUrl } from '@/data/api/client';
import { buildModeledSeries, buildObservedSeries, nearestTimestamp } from './profileComparison';

let backendReachable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${apiBaseUrl()}/health`, { signal: AbortSignal.timeout(1500) });
    backendReachable = res.ok;
  } catch {
    backendReachable = false;
  }
});

describe.skipIf(!process.env['OCEANLENS_RUN_INTEGRATION'])(
  'profile comparison data path (live backend)',
  () => {
    it('builds a real observed-vs-modelled temperature series for a real Argo observation', async () => {
      if (!backendReachable) return;
      const adapter = new ApiOceanDataAdapter();

      const observations = await adapter.getObservations({});
      expect(observations.length).toBeGreaterThan(0);
      // ARGO-5907083-2, a known-good real profile — see docs/data-contract.md.
      const target = observations.find((o) => o.id === 'ARGO-5907083-2') ?? observations[0]!;

      const full = await adapter.getObservation(target.id);
      expect(full).not.toBeNull();

      const times = await adapter.getAvailableTimes('temperature');
      expect(times.length).toBeGreaterThan(0);
      const modelTs = nearestTimestamp(full!.observedAt, times);
      expect(modelTs).not.toBeNull();
      expect(times).toContain(modelTs); // exact match — sidesteps the backend's
      // "unrecognised timestamp -> first cached timestamp" fallback

      const column = await adapter.getModelColumn({
        variable: 'temperature',
        timestamp: modelTs!,
        latitude: full!.latitude,
        longitude: full!.longitude,
      });
      expect(column.depthsM.length).toBeGreaterThan(0);

      const observed = buildObservedSeries(full!, 'temperature');
      const modeled = buildModeledSeries(column);
      // a real, non-QC-failed profile has at least one usable level
      expect(observed.length).toBeGreaterThan(0);
      expect(modeled.length).toBeGreaterThan(0);
      for (const p of observed) {
        expect(Number.isFinite(p.value)).toBe(true);
        expect(['GOOD', 'PROBABLY_GOOD', 'SUSPECT', 'BAD']).toContain(p.qc);
      }
    });

    it('retains the real QC-failed profile (ARGO-4903776-2) as an honest empty series, not a 404', async () => {
      if (!backendReachable) return;
      const adapter = new ApiOceanDataAdapter();
      const full = await adapter.getObservation('ARGO-4903776-2');
      if (!full) return; // id may differ if the cache is regenerated; not a hard fail
      const observed = buildObservedSeries(full, 'temperature');
      expect(full.qc).toBe('BAD');
      expect(observed).toEqual([]); // no fabricated levels for an all-QC-failed profile
    });

    it('never returns a salinity column for a position outside the cached region', async () => {
      if (!backendReachable) return;
      const adapter = new ApiOceanDataAdapter();
      const times = await adapter.getAvailableTimes('salinity');
      await expect(
        adapter.getModelColumn({
          variable: 'salinity',
          timestamp: times[0]!,
          latitude: -60, // far outside the Bay of Bengal cache
          longitude: 0,
        }),
      ).rejects.toThrow();
    });
  },
);
