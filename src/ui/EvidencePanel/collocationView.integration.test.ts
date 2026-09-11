/* Real-HTTP integration test for the Phase 5A step 2 comparison tab's data
 * path: fetches the selected observation's real collocation result through
 * the same OceanDataAdapter call useCollocation.ts uses, then runs the
 * exact selectCollocationView() the component uses on it.
 *
 * Skips cleanly without a live backend; run explicitly:
 *   cd backend && uvicorn app.main:app --reload --port 8000   # terminal 1
 *   npm run test:integration                                   # terminal 2 */

import { beforeAll, describe, expect, it } from 'vitest';
import { ApiOceanDataAdapter } from '@/data/ApiOceanDataAdapter';
import { ApiResponseError } from '@/data/api/client';
import { apiBaseUrl } from '@/data/api/client';
import { selectCollocationView } from './collocationView';

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
  'collocation data path (live backend)',
  () => {
    it('returns a real, non-fabricated RMSE/bias for a known-good real profile', async () => {
      if (!backendReachable) return;
      const adapter = new ApiOceanDataAdapter();
      const result = await adapter.getCollocation({
        observationId: 'ARGO-5907083-2',
        variable: 'temperature',
      });
      expect(result).not.toBeNull();
      expect(result!.sampleCount).toBeGreaterThan(0);
      expect(Number.isFinite(result!.rmse)).toBe(true);
      expect(Number.isFinite(result!.meanBias)).toBe(true);
      // matches the Phase 2.5-documented, cross-checked real value in
      // CLAUDE.md/docs/data-contract.md — asserted with tolerance since the
      // cache could legitimately be regenerated.
      expect(result!.rmse).toBeCloseTo(0.2434, 1);
      expect(result!.meanBias).toBeCloseTo(0.1816, 1);
      expect(result!.bands.length).toBeGreaterThan(0);
      expect(result!.interpretation.length).toBeGreaterThan(0);
      expect(result!.unit).toBe('°C');
      expect(result!.observationTimestamp).toBeTruthy();
      expect(result!.source?.datasetName).toBeTruthy();

      const view = selectCollocationView({
        variableSupported: true,
        variableName: 'Sea-water temperature',
        status: 'ready',
        error: null,
        sampleCount: result!.sampleCount,
      });
      expect(view).toEqual({ kind: 'ready' });
    });

    it('returns null/unavailable statistics (never zero) for the real all-BAD-QC profile', async () => {
      if (!backendReachable) return;
      const adapter = new ApiOceanDataAdapter();
      const result = await adapter.getCollocation({
        observationId: 'ARGO-4903776-2',
        variable: 'temperature',
      });
      expect(result).not.toBeNull();
      expect(result!.sampleCount).toBe(0);
      expect(Number.isFinite(result!.rmse)).toBe(false); // NaN, not 0
      expect(Number.isFinite(result!.meanBias)).toBe(false);
      for (const band of result!.bands) {
        expect(Number.isFinite(band.rmse)).toBe(false);
        expect(Number.isFinite(band.meanDelta)).toBe(false);
      }
      // position/time metadata is still real even with zero valid levels
      expect(Number.isFinite(result!.horizontalDistanceKm)).toBe(true);
      expect(Number.isFinite(result!.timeOffsetHours)).toBe(true);

      const view = selectCollocationView({
        variableSupported: true,
        variableName: 'Sea-water temperature',
        status: 'ready',
        error: null,
        sampleCount: result!.sampleCount,
      });
      expect(view).toEqual({ kind: 'no-valid-levels' });
    });

    it('returns a real, distinct result when the selection changes to a different observation', async () => {
      if (!backendReachable) return;
      const adapter = new ApiOceanDataAdapter();
      const a = await adapter.getCollocation({
        observationId: 'ARGO-5907083-2',
        variable: 'temperature',
      });
      const observations = await adapter.getObservations({});
      const other = observations.find((o) => o.id !== 'ARGO-5907083-2' && o.qc !== 'BAD');
      expect(other).toBeDefined();
      const b = await adapter.getCollocation({ observationId: other!.id, variable: 'temperature' });
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a!.observationId).not.toBe(b!.observationId);
      // real positions differ (or at minimum the id/timestamp genuinely does)
      expect(a!.observationTimestamp).not.toBe(b!.observationTimestamp);
    });

    it('backend hardening: currentSpeed collocation now fails honestly (422) through the adapter, instead of returning a fabricated result', async () => {
      if (!backendReachable) return;
      const adapter = new ApiOceanDataAdapter();
      // The app itself never calls this (isCollocationVariable gates it),
      // but the adapter/backend boundary must still be honest if it ever
      // is — see the Phase-5A backend hardening pass in CLAUDE.md.
      let caught: unknown;
      try {
        await adapter.getCollocation({
          observationId: 'ARGO-5907083-2',
          variable: 'currentSpeed',
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ApiResponseError);
      expect((caught as ApiResponseError).status).toBe(422);
    });

    it('salinity collocation is also real and independently computed from temperature\'s', async () => {
      if (!backendReachable) return;
      const adapter = new ApiOceanDataAdapter();
      const temp = await adapter.getCollocation({
        observationId: 'ARGO-5907083-2',
        variable: 'temperature',
      });
      const sal = await adapter.getCollocation({
        observationId: 'ARGO-5907083-2',
        variable: 'salinity',
      });
      expect(temp).not.toBeNull();
      expect(sal).not.toBeNull();
      expect(sal!.unit).toBe('PSU');
      expect(sal!.rmse).not.toBe(temp!.rmse);
    });
  },
);
