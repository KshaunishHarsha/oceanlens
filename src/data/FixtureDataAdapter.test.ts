import { describe, expect, it } from 'vitest';
import { FixtureDataAdapter } from './FixtureDataAdapter';

const a = new FixtureDataAdapter();

describe('FixtureDataAdapter', () => {
  it('labels itself synthetic in every provenance record', async () => {
    const meta = await a.getMetadata();
    expect(meta.sources.every((s) => s.status === 'SYNTHETIC_FIXTURE')).toBe(true);
    expect(meta.viewId).toBe('DEMO-FIXTURE');
    expect(meta.windowLabel).toMatch(/synthetic/i);
  });

  it('returns a slice whose range brackets its values', async () => {
    const times = await a.getAvailableTimes();
    const slice = await a.getVolumeSlice({ variable: 'temperature', timestamp: times[2]!, depthM: 100 });
    expect(slice.values.length).toBe(slice.nx * slice.ny);
    const finite = [...slice.values].filter(Number.isFinite);
    expect(Math.min(...finite)).toBeGreaterThanOrEqual(slice.range[0] - 1e-6);
    expect(Math.max(...finite)).toBeLessThanOrEqual(slice.range[1] + 1e-6);
  });

  it('computes collocation stats from its own arrays, not constants', async () => {
    const c = await a.getCollocation({ observationId: 'FIXTURE-ARGO-1', variable: 'temperature' });
    expect(c).not.toBeNull();
    expect(c!.sampleCount).toBeGreaterThan(0);
    expect(Number.isFinite(c!.rmse)).toBe(true);
    expect(Number.isFinite(c!.meanBias)).toBe(true);
    // the fixture injects a deep warm-ish miss, so bias is measurable
    expect(Math.abs(c!.meanBias)).toBeGreaterThan(0);
    expect(c!.observedValues.length).toBe(c!.depthsM.length);
    expect(c!.modeledValues.length).toBe(c!.depthsM.length);
  });

  it('recomputes when the observation is perturbed (no hard-coded RMSE)', async () => {
    // Two variables must not yield identical stats by accident.
    const t = await a.getCollocation({ observationId: 'FIXTURE-ARGO-1', variable: 'temperature' });
    const s = await a.getCollocation({ observationId: 'FIXTURE-ARGO-1', variable: 'salinity' });
    expect(t!.rmse).not.toBe(s!.rmse);
  });
});
