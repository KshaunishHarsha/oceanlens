/* Real-HTTP integration test for the Phase 4A scene's data path: fetches a
 * real VolumeSlice for each renderable variable through the same
 * OceanDataAdapter call ThreeSceneCanvas/useVolumeSlice use, then runs the
 * exact buildSliceTexture() the component uses on it — end-to-end proof the
 * scene's data mapping works on real numbers, without a browser.
 *
 * Skips cleanly without a live backend; run explicitly:
 *   cd backend && uvicorn app.main:app --reload --port 8000   # terminal 1
 *   npm run test:integration                                   # terminal 2
 * (test:integration runs every *.integration.test.ts file). */

import { beforeAll, describe, expect, it } from 'vitest';
import { ApiOceanDataAdapter } from '@/data/ApiOceanDataAdapter';
import { apiBaseUrl } from '@/data/api/client';
import { VARIABLES } from '@/domain/variables';
import { buildSliceTexture, computePlaneWorldSize } from './sliceTexture';

let backendReachable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${apiBaseUrl()}/health`, { signal: AbortSignal.timeout(1500) });
    backendReachable = res.ok;
  } catch {
    backendReachable = false;
  }
});

describe.skipIf(!process.env['OCEANLENS_RUN_INTEGRATION'])('scene data path (live backend)', () => {
  it('builds a real texture from a real temperature slice', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const times = await adapter.getAvailableTimes('temperature');
    expect(times.length).toBeGreaterThan(0);

    const slice = await adapter.getVolumeSlice({
      variable: 'temperature',
      timestamp: times[0]!,
      depthM: 100,
    });
    expect(slice.nx).toBeGreaterThan(0);
    expect(slice.ny).toBeGreaterThan(0);
    // real Bay of Bengal cache: some land cells, some ocean cells
    const validCount = slice.valid.reduce((a, b) => a + b, 0);
    expect(validCount).toBeGreaterThan(0);
    expect(validCount).toBeLessThan(slice.valid.length);

    const tex = buildSliceTexture(slice, 'thermal', VARIABLES.temperature.defaultRange);
    expect(tex.width).toBe(slice.nx);
    expect(tex.height).toBe(slice.ny);
    // every invalid cell must be fully transparent — never a fabricated colour
    for (let i = 0; i < slice.valid.length; i++) {
      if (!slice.valid[i]) expect(tex.data[i * 4 + 3]).toBe(0);
    }

    const size = computePlaneWorldSize(slice.bounds);
    expect(size.width).toBeGreaterThan(0);
    expect(size.depth).toBeGreaterThan(0);
  });

  it('builds a real texture from a real salinity slice', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const times = await adapter.getAvailableTimes('salinity');
    const slice = await adapter.getVolumeSlice({
      variable: 'salinity',
      timestamp: times[0]!,
      depthM: 50,
    });
    const tex = buildSliceTexture(slice, 'haline', VARIABLES.salinity.defaultRange);
    expect(tex.data.length).toBe(slice.nx * slice.ny * 4);
  });

  it('builds a real texture from a real current-speed slice', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const times = await adapter.getAvailableTimes('currentSpeed');
    expect(times.length).toBeGreaterThan(0); // real u/v are in this cache
    const slice = await adapter.getVolumeSlice({
      variable: 'currentSpeed',
      timestamp: times[0]!,
      depthM: 0,
    });
    const tex = buildSliceTexture(slice, 'speed', VARIABLES.currentSpeed.defaultRange);
    expect(tex.data.length).toBe(slice.nx * slice.ny * 4);
  });

  it('never returns a slice for chlorophyll — no synthetic fallback', async () => {
    if (!backendReachable) return;
    const adapter = new ApiOceanDataAdapter();
    const times = await adapter.getAvailableTimes('chlorophyll');
    expect(times).toEqual([]);
    await expect(
      adapter.getVolumeSlice({ variable: 'chlorophyll', timestamp: '2023-09-28T00:00:00Z', depthM: 0 }),
    ).rejects.toThrow();
  });
});
